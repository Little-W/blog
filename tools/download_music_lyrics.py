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
import sys
from collections import Counter
from pathlib import Path
from typing import Any

from import_new_music import (
    DEFAULT_ASSET_REPO,
    DEFAULT_RAW_URL,
    DEFAULT_REFERENCE,
    DEFAULT_SOURCE_DIR,
    classify_track,
    deduplicate_tracks,
    exclude_off_vocal_tracks,
    scan_selected_roots,
    select_new_roots,
)
from music_library_gui import DEFAULT_DATA_DIR, LibraryConfig, Track, export_database


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
    parser.add_argument('--asset-repo', type=Path, default=DEFAULT_ASSET_REPO)
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument('--raw-url', default=DEFAULT_RAW_URL)
    parser.add_argument('--lddc-root', type=Path, default=DEFAULT_LDDC_ROOT)
    parser.add_argument('--min-score', type=float, default=68.0, help='LDDC 自动匹配最低分数。')
    parser.add_argument('--limit', type=int, default=0, help='仅处理前 N 首，0 表示全部。')
    parser.add_argument('--overwrite', action='store_true', help='覆盖已有 LRC。')
    parser.add_argument('--apply', action='store_true', help='执行网络请求；默认仅输出处理清单。')
    parser.add_argument('--report', type=Path, help='写入 JSON 结果。')
    return parser.parse_args()


def add_lddc_to_path(lddc_root: Path) -> None:
    package_root = lddc_root / 'LDDC'
    if not package_root.is_dir():
        raise ValueError(f'未找到 LDDC 源码目录：{package_root}')
    if str(lddc_root) not in sys.path:
        sys.path.insert(0, str(lddc_root))


def prepare_tracks(source_dir: Path, reference: Path) -> list[Track]:
    tracks = scan_selected_roots(source_dir, select_new_roots(source_dir, reference))
    for track in tracks:
        classify_track(track)
    tracks, _ = exclude_off_vocal_tracks(tracks)
    tracks, _ = deduplicate_tracks(tracks)
    return tracks


def lyric_target(track: Track, asset_repo: Path) -> Path:
    return asset_repo / track.output_directory / f'{track.display_name}.lrc'


def is_obvious_instrumental(track: Track) -> bool:
    text = f'{track.title} {track.artist}'.casefold()
    return (
        track.artist.casefold() in INSTRUMENTAL_ARTISTS
        or any(marker in text for marker in ('instrumental', 'off vocal', 'offvocal', 'monologue', 'inst.'))
    )


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
    tracks = prepare_tracks(args.source_dir, args.reference)
    if args.limit:
        tracks = tracks[:args.limit]
    print(f'候选曲目：{len(tracks)} 首。')
    if not args.apply:
        print('这是预览；确认后增加 --apply 下载歌词。')
        return 0

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
    for index, track in enumerate(tracks, start=1):
        target = lyric_target(track, args.asset_repo)
        print(f'[{index}/{len(tracks)}] {track.display_name}')
        if target.is_file() and not args.overwrite:
            track.lyrics = target
            results.append({'source': track.source_relative.as_posix(), 'status': 'existing', 'detail': target.as_posix()})
            continue
        try:
            status, detail = fetch_lyrics(track, target, args.min_score)
        except Exception as error:  # One failed provider request must not stop the batch.
            status, detail = 'failed', f'{error.__class__.__name__}: {error}'
        if status == 'success':
            track.lyrics = target
        print(f'  {status}: {detail}')
        results.append({'source': track.source_relative.as_posix(), 'status': status, 'detail': detail})

    config = LibraryConfig(
        source_dir=args.source_dir,
        mp3_repo_dir=args.asset_repo,
        sq_repo_dir=args.asset_repo,
        data_dir=args.data_dir,
        mp3_raw_url=args.raw_url,
        sq_raw_url=args.raw_url,
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
