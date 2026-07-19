#!/usr/bin/env python3
"""Import newly added local albums into the site's unified music asset repo.

The source folders are selected by filesystem modification time.  This fits a
download library where an older release may have been added after the previous
website import.  A dry run is the default; pass ``--apply`` to transcode,
copy, and update JSONL.  ``--push-assets`` then commits and pushes the asset
repository, while ``--push-blog`` commits and pushes only the data files in
the blog repository.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable

from music_library_gui import (
    AUDIO_EXTENSIONS,
    DEFAULT_DATA_DIR,
    HEADER_PREFIX,
    LibraryConfig,
    Track,
    export_database,
    read_jsonl_records,
    read_track,
    write_jsonl_records,
    process_tracks,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = Path('/media/2/音乐')
DEFAULT_REFERENCE = DEFAULT_SOURCE_DIR / '[Hi-Res][230308]ReoNa 2ndアルバム「HUMAN」[96kHz／24bit][FLAC]'
DEFAULT_ASSET_REPO = Path('/media/6/旧项目/网站/music')
DEFAULT_RAW_URL = 'https://hf-mirror.com/datasets/Yusen/music/resolve/main'

# New playlist records are intentionally limited to collection and singer
# groups. The ACG group is reserved for vocal theme releases, such as OP/ED
# singles. Soundtrack and collection tracks stay only in their own collection.
TAG_DEFINITIONS = (
    (62, 161, 'Girls und Panzer Music Collection'),
    (63, 162, '秽翼的尤斯蒂娅OST'),
    (64, 26, 'ChouCho'),
    (65, 36, 'ヰ世界情緒'),
)
DEFAULT_TAGS = (1,)
ACG_TAGS = (1, 3)
GUP_TAGS = (1, 62)
GUP_ACG_TAGS = (1, 3, 62)
EUSTIA_TAGS = (1, 63)
EUSTIA_ACG_TAGS = (1, 3, 63)
CHOUCHO_TAGS = (1, 64)
ISEKAI_JOUCHO_TAGS = (1, 65)
YAMA_NO_SUSUME_ARTIST = 'あおい（井口裕香）＆ひなた（阿澄佳奈）'
OFF_VOCAL_RE = re.compile(r'off[\s._-]*vocal', re.IGNORECASE)
INSTRUMENTAL_RE = re.compile(r'(?:\(|（|\[|\s)(?:instrumental|inst\.?)(?:\)|）|\]|\s|$)', re.IGNORECASE)
THEME_RELEASE_RE = re.compile(r'(?:主題歌|(?<![A-Za-z])(?:OP|ED)(?:テーマ|曲|[「『（(）)\s]|$))', re.IGNORECASE)
THEME_SINGLE_RE = re.compile(r'(?:^|/)(?:OP|ED)\s+Single(?:/|$)', re.IGNORECASE)


def belongs_to_acg_vocal_releases(track: Track) -> bool:
    """Return whether a track is a vocal theme or separate singer release.

    Soundtrack tracks are deliberately excluded even when their metadata has a
    performer name.  An instrumental accompaniment is not a vocal release.
    """
    source = track.source_relative.as_posix()
    album = track.album or ''
    title = track.title or ''
    if INSTRUMENTAL_RE.search(title):
        return False
    if THEME_RELEASE_RE.search(source) or THEME_SINGLE_RE.search(source):
        return True
    if 'original charactersong series' in album.casefold():
        return True
    # 「Grand symphony」is a separate singer single; the file name itself does
    # not carry an OP/ED marker.
    return Path(source).parts[0].startswith('「Grand symphony」') and album.casefold() == 'grand symphony'


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='将下载目录中新增加的音乐导入网站资源库。')
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_SOURCE_DIR, help='本地音乐根目录。')
    parser.add_argument('--reference', type=Path, default=DEFAULT_REFERENCE, help='上一次导入的参考目录。')
    parser.add_argument('--asset-repo', type=Path, default=DEFAULT_ASSET_REPO, help='HQ、SQ 共用的 Git 资源仓库。')
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA_DIR, help='博客 static/data 目录。')
    parser.add_argument('--raw-url', default=DEFAULT_RAW_URL, help='资源下载 URL 前缀。')
    parser.add_argument('--apply', action='store_true', help='执行转码、复制和 JSONL 写入；默认仅预览。')
    parser.add_argument('--overwrite', action='store_true', help='覆盖资源仓库中的同名文件。')
    parser.add_argument('--push-assets', action='store_true', help='资源处理完成后提交并推送资源仓库。')
    parser.add_argument('--push-blog', action='store_true', help='资料写入完成后提交并推送博客资料文件。')
    parser.add_argument('--report', type=Path, help='将导入清单写为 JSON。')
    return parser.parse_args()


def select_new_roots(source_dir: Path, reference: Path) -> list[Path]:
    if not source_dir.is_dir():
        raise ValueError(f'音乐根目录不存在：{source_dir}')
    if not reference.is_dir():
        raise ValueError(f'参考目录不存在：{reference}')
    threshold = reference.stat().st_mtime_ns
    return sorted(
        (item for item in source_dir.iterdir() if item.is_dir() and item != reference and item.stat().st_mtime_ns > threshold),
        key=lambda item: (item.stat().st_mtime_ns, item.name.casefold()),
    )


def scan_selected_roots(source_dir: Path, roots: Iterable[Path]) -> list[Track]:
    tracks: list[Track] = []
    for root in roots:
        for path in sorted(root.rglob('*')):
            if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS:
                tracks.append(read_track(path, source_dir))
    if not tracks:
        raise ValueError('选中的新目录中没有找到支持的音频文件。')
    return tracks


def classify_track(track: Track) -> None:
    source_text = track.source_relative.as_posix().casefold()
    if '色違いの翼' in track.source_relative.as_posix() and not track.artist:
        track.artist = YAMA_NO_SUSUME_ARTIST
    if (
        'girls und panzer' in source_text
        or 'ガールズ&パンツァー' in track.source_relative.as_posix()
        or 'grand symphony' in source_text
    ):
        track.tag_ids = GUP_ACG_TAGS if belongs_to_acg_vocal_releases(track) else GUP_TAGS
    elif '秽翼的尤斯蒂娅' in track.source_relative.as_posix() or '穢翼のユースティア' in track.source_relative.as_posix():
        track.tag_ids = EUSTIA_ACG_TAGS if belongs_to_acg_vocal_releases(track) else EUSTIA_TAGS
    elif 'secretgarden' in source_text:
        track.tag_ids = CHOUCHO_TAGS
    elif 'ヰ世界情緒' in track.source_relative.as_posix() or '世界情緒' in track.source_relative.as_posix():
        track.tag_ids = ISEKAI_JOUCHO_TAGS
    else:
        track.tag_ids = ACG_TAGS if belongs_to_acg_vocal_releases(track) else DEFAULT_TAGS


def exclude_off_vocal_tracks(tracks: list[Track]) -> tuple[list[Track], list[dict[str, str]]]:
    """Do not publish accompaniment-only tracks to the website library."""
    kept: list[Track] = []
    excluded: list[dict[str, str]] = []
    for track in tracks:
        text = f'{track.title} {track.source.name}'
        if OFF_VOCAL_RE.search(text):
            excluded.append({
                'title': track.title,
                'artist': track.artist,
                'source': track.source_relative.as_posix(),
            })
        else:
            kept.append(track)
    return kept, excluded


def deduplicate_tracks(tracks: list[Track]) -> tuple[list[Track], list[dict[str, str]]]:
    kept: list[Track] = []
    known: dict[tuple[str, str], Track] = {}
    skipped: list[dict[str, str]] = []
    for track in tracks:
        if not track.title.strip() or not track.artist.strip():
            raise ValueError(f'无法确定歌名或歌手：{track.source}')
        previous = known.get(track.key)
        if previous:
            skipped.append({
                'title': track.title,
                'artist': track.artist,
                'kept': previous.source_relative.as_posix(),
                'skipped': track.source_relative.as_posix(),
            })
            continue
        known[track.key] = track
        kept.append(track)
    return kept, skipped


def ensure_tag_catalog(data_dir: Path) -> list[str]:
    path = data_dir / 'music_tag.0.jsonl'
    records = read_jsonl_records(path, 'music_tag')
    existing_ids = {record.get('tag_id') for record in records}
    existing_names = {record.get('tag_name') for record in records}
    additions: list[str] = []
    for tag_id, tag_order, tag_name in TAG_DEFINITIONS:
        if tag_id in existing_ids or tag_name in existing_names:
            continue
        records.append({'tag_id': tag_id, 'tag_order': tag_order, 'tag_name': tag_name})
        additions.append(tag_name)
    if additions:
        write_jsonl_records(path, 'music_tag', records)
    return additions


def git(repo: Path, *arguments: str) -> str:
    completed = subprocess.run(
        ['git', '-C', str(repo), *arguments],
        text=True,
        capture_output=True,
        check=False,
    )
    output = '\n'.join(part for part in (completed.stdout.strip(), completed.stderr.strip()) if part)
    if completed.returncode:
        raise RuntimeError(output or f'git 退出码 {completed.returncode}')
    return output


def ensure_clean_repo(repo: Path) -> None:
    if not (repo / '.git').is_dir():
        raise ValueError(f'不是 Git 仓库：{repo}')
    if git(repo, 'status', '--porcelain'):
        raise RuntimeError(f'资源仓库存在未提交修改：{repo}')


def commit_and_push_assets(repo: Path, track_count: int) -> None:
    # The caller verifies that the repository is clean before import. At this
    # point every new file belongs to the current import run.
    git(repo, 'add', '--all')
    staged = subprocess.run(['git', '-C', str(repo), 'diff', '--cached', '--quiet'], check=False)
    if staged.returncode == 0:
        return
    git(repo, 'commit', '-m', f'音乐资源：新增 {track_count} 首曲目（MP3 与原始音频）')
    git(repo, 'push', 'origin', 'main')


def commit_and_push_blog(data_dir: Path, track_count: int) -> None:
    repo = PROJECT_ROOT
    paths = [
        data_dir / 'music_hq.0.jsonl',
        data_dir / 'music_sq.0.jsonl',
        data_dir / 'music_tag.0.jsonl',
    ]
    relative_paths = [str(path.relative_to(repo)) for path in paths]
    staged = subprocess.run(
        ['git', '-C', str(repo), 'diff', '--quiet', 'HEAD', '--', *relative_paths],
        check=False,
    )
    if staged.returncode == 0:
        return
    git(repo, 'commit', '--only', '-m', f'音乐：新增 {track_count} 首曲目资料与分类', '--', *relative_paths)
    git(repo, 'push', 'origin', 'main')


def write_report(
    path: Path,
    roots: list[Path],
    tracks: list[Track],
    skipped: list[dict[str, str]],
    off_vocal: list[dict[str, str]],
) -> None:
    data = {
        'source_roots': [item.as_posix() for item in roots],
        'track_count': len(tracks),
        'tag_counts': {
            ','.join(map(str, key)): value
            for key, value in sorted(Counter(track.tag_ids for track in tracks).items())
        },
        'duplicates_skipped': skipped,
        'off_vocal_excluded': off_vocal,
        'tracks': [
            {
                'source': track.source_relative.as_posix(),
                'title': track.title,
                'artist': track.artist,
                'album': track.album,
                'list': list(track.tag_ids),
                'cover': track.cover_relative().as_posix() if track.cover_relative() else None,
            }
            for track in tracks
        ],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> int:
    args = parse_arguments()
    if (args.push_assets or args.push_blog) and not args.apply:
        raise ValueError('--push-assets 与 --push-blog 需要同时使用 --apply。')
    roots = select_new_roots(args.source_dir, args.reference)
    tracks = scan_selected_roots(args.source_dir, roots)
    for track in tracks:
        classify_track(track)
    tracks, off_vocal = exclude_off_vocal_tracks(tracks)
    tracks, skipped = deduplicate_tracks(tracks)
    print(f'参考目录：{args.reference.name}')
    print(f'待导入目录：{len(roots)} 个；音频：{len(tracks)} 首；跳过 Off Vocal：{len(off_vocal)} 首；跳过重复曲目：{len(skipped)} 首。')
    for root in roots:
        print(f'  - {root.name}')
    print('分类统计：')
    for tag_ids, count in sorted(Counter(track.tag_ids for track in tracks).items()):
        print(f'  {list(tag_ids)}：{count} 首')
    if args.report:
        write_report(args.report, roots, tracks, skipped, off_vocal)
        print(f'已写入清单：{args.report}')
    if not args.apply:
        print('这是预览；确认后增加 --apply 执行导入。')
        return 0

    if not args.asset_repo.is_dir():
        raise ValueError(f'资源仓库目录不存在：{args.asset_repo}')
    if args.push_assets:
        ensure_clean_repo(args.asset_repo)
    config = LibraryConfig(
        source_dir=args.source_dir,
        mp3_repo_dir=args.asset_repo,
        sq_repo_dir=args.asset_repo,
        data_dir=args.data_dir,
        mp3_raw_url=args.raw_url,
        sq_raw_url=args.raw_url,
        list_ids=ACG_TAGS,
        overwrite=args.overwrite,
    )
    process_tracks(tracks, config, transcode=True, copy_source=True, progress=print)
    additions = ensure_tag_catalog(args.data_dir)
    hq_count, sq_count = export_database(tracks, config, print)
    print(f'已更新资料：HQ {hq_count} 首，SQ {sq_count} 首。')
    if additions:
        print(f'已新增分类：{ "、".join(additions) }。')
    if args.push_assets:
        commit_and_push_assets(args.asset_repo, len(tracks))
        print('资源仓库已推送。')
    if args.push_blog:
        commit_and_push_blog(args.data_dir, len(tracks))
        print('博客资料已推送。')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as error:
        print(f'导入失败：{error}', file=sys.stderr)
        raise SystemExit(1)
