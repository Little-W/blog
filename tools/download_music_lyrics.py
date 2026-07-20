#!/usr/bin/env python3
"""Fetch timed LRC files for newly imported music through the local LDDC checkout.

LDDC provides the source selection, search scoring and lyric conversion. This
wrapper keeps generated ``.lrc`` files beside the matching MP3 in the unified
asset repository, then updates the site's JSONL records with the resulting
download address. Existing lyric files are retained unless ``--overwrite`` is
specified, so the command is safe to resume after failed network requests.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlsplit

from import_new_music import (
    DEFAULT_ASSET_REPO,
    DEFAULT_RAW_URL,
    DEFAULT_REFERENCE,
    DEFAULT_SOURCE_DIR,
    batch_asset_repo,
    batch_raw_url,
    classify_track,
    filter_tracks,
    load_known_tags,
    scan_source_tracks,
    validate_track_tags,
)
from music_library_gui import (
    DEFAULT_DATA_DIR,
    LibraryConfig,
    Track,
    export_database,
    read_jsonl_records,
    write_jsonl_records,
)


DEFAULT_LDDC_ROOT = Path('/media/6/旧项目/网站/LDDC')
INSTRUMENTAL_ARTISTS = {
    'shiro hamaguchi', 'hamaguchi shirou', 'tokyo philharmonic orchestra',
    'various artists', 'luigi denza', 'hiroshi yoshioka', 'yoji noi',
    'noritaka izumi', 'h-stk', 'yuuki kimura', 'kana yabuki, hiroshi sasaki',
    'koshiro honda', 'masumi ito', 'mito', 'satou juunichi', 'itou masumi',
    'kyohei yamamoto', 'unknown (traditional)', 'william steffe',
    'john philip sousa', 'kurt wiehle', 'herms niel',
    'lev konstantinovich knipper', 'matvej isaakovich blanter',
    'steffe john william', 'sousa john philip', 'hoffman', 'niel herms',
    'knipper lev konstantinovich', 'blanter matvej isaakovich', 'rino',
}


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='通过本地 LDDC 为新导入音乐下载 LRC 歌词。')
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument('--reference', type=Path, default=DEFAULT_REFERENCE)
    parser.add_argument('--all-source-files', action='store_true')
    parser.add_argument('--asset-repo', type=Path, default=DEFAULT_ASSET_REPO)
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument('--raw-url', default=DEFAULT_RAW_URL)
    parser.add_argument('--lddc-root', type=Path, default=DEFAULT_LDDC_ROOT)
    parser.add_argument('--min-score', type=float, default=68.0, help='LDDC 自动匹配最低分数。')
    parser.add_argument('--offset', type=int, default=0, help='跳过前 N 首候选曲目，便于分批恢复。')
    parser.add_argument('--limit', type=int, default=0, help='仅处理前 N 首，0 表示全部。')
    parser.add_argument('--overwrite', action='store_true', help='覆盖已有 LRC。')
    parser.add_argument(
        '--repair-missing',
        action='store_true',
        help='直接检查 JSONL 中缺少 lrc 的条目，并从资源仓库的已下载音频补写歌词。',
    )
    parser.add_argument('--apply', action='store_true', help='执行网络请求；默认仅输出处理清单。')
    parser.add_argument('--report', type=Path, help='写入 JSON 结果。')
    return parser.parse_args()


def add_lddc_to_path(lddc_root: Path) -> None:
    package_root = lddc_root / 'LDDC'
    if not package_root.is_dir():
        raise ValueError(f'未找到 LDDC 源码目录：{package_root}')
    if str(lddc_root) not in sys.path:
        sys.path.insert(0, str(lddc_root))


def prepare_tracks(source_dir: Path, reference: Path, all_source_files: bool, data_dir: Path) -> tuple[str, list[Path], list[Track]]:
    source_mode, roots, tracks = scan_source_tracks(source_dir, reference, all_source_files)
    tag_ids_by_name = load_known_tags(data_dir)
    for track in tracks:
        classify_track(track, tag_ids_by_name)
    tracks, _, _ = filter_tracks(tracks)
    validate_track_tags(tracks, tag_ids_by_name)
    return source_mode, roots, tracks


def lyric_target(track: Track, asset_repo: Path) -> Path:
    return asset_repo / track.output_directory / f'{track.display_name}.lrc'


def is_obvious_instrumental(track: Track) -> bool:
    text = f'{track.title} {track.artist}'.casefold()
    return (
        track.artist.casefold() in INSTRUMENTAL_ARTISTS
        or any(marker in text for marker in ('instrumental', 'off vocal', 'offvocal', 'monologue', 'inst.'))
    )


def asset_relative_from_url(url: Any) -> Path | None:
    """Resolve a Hugging Face dataset URL to a relative asset path."""
    if not isinstance(url, str):
        return None
    marker = '/datasets/Yusen/music/resolve/main/'
    path = urlsplit(url).path
    index = path.find(marker)
    if index < 0:
        return None
    relative = Path(unquote(path[index + len(marker):]))
    if not relative.parts or relative.is_absolute() or '..' in relative.parts:
        return None
    return relative


def prepare_missing_lyric_repairs(data_dir: Path, asset_repo: Path) -> list[tuple[int, Track, Path]]:
    """Build repair jobs from HQ records without an LRC URL.

    The normal import workflow starts from `/media/2/音乐`.  This mode is for
    repairing a published collection after that source directory is offline:
    the unified asset repository already contains the MP3 and cover files.
    """
    records = read_jsonl_records(data_dir / 'music_hq.0.jsonl', 'music_hq')
    jobs: list[tuple[int, Track, Path]] = []
    dated_asset_repo = batch_asset_repo(asset_repo)
    for record in records:
        if record.get('lrc'):
            continue
        mid = record.get('mid')
        url = record.get('url')
        relative = asset_relative_from_url(url)
        if not isinstance(mid, int) or not isinstance(url, str) or not url:
            continue
        source_relative = relative or Path(unquote(urlsplit(url).path)).name or Path(f'{mid}.mp3')
        source = asset_repo / relative if relative is not None else Path('/tmp') / f'music-lyrics-{mid}.mp3'
        if not source.is_file():
            # Older records still point at the retired Bitbucket repositories.
            # LDDC only needs title/artist metadata, so keep those jobs and
            # write their newly fetched LRC into the current dated batch.
            source = Path('/tmp') / f'music-lyrics-{mid}.mp3'
        track = Track(
            source=source,
            source_relative=source_relative,
            title=str(record.get('title') or '').strip(),
            artist=str(record.get('author') or '').strip(),
            album=str(record.get('album') or '').strip(),
            cover=None,
            lyrics=None,
        )
        if not track.title or not track.artist:
            print(f'跳过 mid={mid}：缺少歌名或歌手。')
            continue
        if relative is not None and source.is_file():
            target = source.with_suffix('.lrc')
        else:
            safe_name = re.sub(r'[^0-9A-Za-z一-龥ぁ-んァ-ヶ._ -]+', '_', track.display_name).strip()[:160]
            target = dated_asset_repo / 'legacy-lyrics' / f'{mid} - {safe_name}.lrc'
        jobs.append((mid, track, target))
    return jobs


def write_repaired_lyrics(
    data_dir: Path,
    asset_repo: Path,
    raw_url: str,
    repaired: dict[int, Path],
) -> tuple[int, int]:
    """Write successful repair targets to both HQ and SQ JSONL collections."""
    if not repaired:
        return 0, 0
    relative_urls = {
        mid: raw_url.rstrip('/') + '/' + quote(path.relative_to(asset_repo).as_posix(), safe='/')
        for mid, path in repaired.items()
    }
    changed_counts: list[int] = []
    for name in ('music_hq', 'music_sq'):
        path = data_dir / f'{name}.0.jsonl'
        records = read_jsonl_records(path, name)
        changed = 0
        for record in records:
            mid = record.get('mid')
            if mid in relative_urls and not record.get('lrc'):
                record['lrc'] = relative_urls[mid]
                changed += 1
        if changed:
            write_jsonl_records(path, name, records)
        changed_counts.append(changed)
    return changed_counts[0], changed_counts[1]


def fetch_lyrics(track: Track, target: Path, min_score: float) -> tuple[str, str]:
    """Use LDDC's scored multi-source lookup and write standard line LRC."""
    from LDDC.common.models import LyricsFormat, SongInfo, Source
    from LDDC.core.auto_fetch import auto_fetch

    if is_obvious_instrumental(track):
        return 'skipped', '器乐或独白曲目'
    info = SongInfo(Source.Local, title=track.title, artist=track.artist, album=track.album or None)
    lyrics = auto_fetch(
        info=info,
        min_score=min_score,
        sources=(Source.QM, Source.KG, Source.NE, Source.LRCLIB),
    )
    if lyrics.is_inst():
        return 'skipped', 'LDDC 标记为器乐曲'
    content = lyrics.to(lyrics_format=LyricsFormat.LINEBYLINELRC, langs=['orig', 'ts'])
    content = '\n'.join(line.rstrip() for line in content.splitlines()) + '\n'
    if not content.strip():
        return 'failed', 'LDDC 返回空歌词'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')
    return 'success', str(lyrics.info.source.name)


def write_report(path: Path, results: list[dict[str, Any]]) -> None:
    summary = Counter(result['status'] for result in results)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({'summary': dict(summary), 'results': results}, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def main() -> int:
    args = parse_arguments()
    if args.offset < 0 or args.limit < 0:
        raise ValueError('offset 和 limit 不能为负数。')
    repair_jobs: list[tuple[int, Track, Path]] = []
    if args.repair_missing:
        repair_jobs = prepare_missing_lyric_repairs(args.data_dir, args.asset_repo)
        if args.offset:
            repair_jobs = repair_jobs[args.offset:]
        if args.limit:
            repair_jobs = repair_jobs[:args.limit]
        print(f'JSONL 中待补歌词：{len(repair_jobs)} 首。')
        tracks = [track for _, track, _ in repair_jobs]
    else:
        source_mode, roots, tracks = prepare_tracks(args.source_dir, args.reference, args.all_source_files, args.data_dir)
        if args.offset:
            tracks = tracks[args.offset:]
        if args.limit:
            tracks = tracks[:args.limit]
        print(f'模式：{source_mode}；候选曲目：{len(tracks)} 首。')
    if not args.apply:
        print('这是预览；确认后增加 --apply 下载歌词。')
        return 0

    dated_asset_repo = batch_asset_repo(args.asset_repo)
    dated_raw_url = batch_raw_url(args.raw_url)

    add_lddc_to_path(args.lddc_root)
    try:
        from PySide6.QtCore import QCoreApplication
    except ImportError as error:
        raise RuntimeError(
            'LDDC 运行环境缺少 PySide6-Essentials。请先按 LDDC/requirements.txt 安装依赖。'
        ) from error
    application = QCoreApplication.instance() or QCoreApplication([])
    _ = application  # Keep the event dispatcher alive while LDDC runs requests.

    results: list[dict[str, Any]] = []
    repaired: dict[int, Path] = {}
    iterable = repair_jobs if args.repair_missing else [(None, track, lyric_target(track, args.asset_repo)) for track in tracks]
    for index, (mid, track, target) in enumerate(iterable, start=1):
        print(f'[{index}/{len(tracks)}] {track.display_name}')
        if target.is_file() and not args.overwrite:
            track.lyrics = target
            if isinstance(mid, int):
                repaired[mid] = target
            results.append({'mid': mid, 'source': track.source_relative.as_posix(), 'status': 'existing', 'detail': target.as_posix()})
            continue
        try:
            status, detail = fetch_lyrics(track, target, args.min_score)
        except Exception as error:  # One failed provider request must not stop the batch.
            status, detail = 'failed', f'{error.__class__.__name__}: {error}'
        if status == 'success':
            track.lyrics = target
            if isinstance(mid, int):
                repaired[mid] = target
        print(f'  {status}: {detail}')
        results.append({'mid': mid, 'source': track.source_relative.as_posix(), 'status': status, 'detail': detail})

    if args.repair_missing:
        hq_count, sq_count = write_repaired_lyrics(args.data_dir, dated_asset_repo, dated_raw_url, repaired)
        print(f'已补写歌词资料：HQ {hq_count} 条，SQ {sq_count} 条。')
    else:
        config = LibraryConfig(
            source_dir=args.source_dir,
            mp3_repo_dir=dated_asset_repo,
            sq_repo_dir=dated_asset_repo,
            data_dir=args.data_dir,
            mp3_raw_url=dated_raw_url,
            sq_raw_url=dated_raw_url,
            list_ids=(1, 3),
            overwrite=False,
        )
        hq_count, sq_count = export_database(tracks, config, print)
    summary = Counter(result['status'] for result in results)
    print(f'完成：{dict(summary)}；资料总数 HQ {hq_count}、SQ {sq_count}。')
    if args.report:
        write_report(args.report, results)
        print(f'已写入结果：{args.report}')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as error:
        print(f'歌词处理失败：{error}', file=sys.stderr)
        raise SystemExit(1)
