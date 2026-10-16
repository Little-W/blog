#!/usr/bin/env python3
"""纯终端歌词下载脚本：只依赖 LDDC（PySide6）与标准库。

`download_music_lyrics.py` 会在顶层导入 `music_library_gui`（PyQt6），而 LDDC
内部使用 PySide6；两个 Qt 绑定无法在同一进程共存（Qt 版本不同会导致
`undefined symbol`）。本脚本不导入任何 PyQt6 模块，直接读写 JSONL 并调用 LDDC，
因此可在只安装 PySide6 的环境里运行。

默认从 HQ 资料中挑选缺少 ``lrc`` 的曲目，按资源仓库 URL 推导 MP3 相对路径，
将 ``.lrc`` 写在与 MP3 同名同目录的位置，再把歌词 URL 写回 HQ 与 SQ 资料。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlsplit

HEADER_PREFIX = '#filetype:JSON-streaming '
URL_MARKER = '/datasets/Yusen/music/resolve/main/'
DEFAULT_ASSET_REPO = Path('/media/6/旧项目/网站/music')
DEFAULT_DATA_DIR = Path('/media/6/旧项目/网站/my-website/static/data')
DEFAULT_RAW_URL = 'https://hf-mirror.com/datasets/Yusen/music/resolve/main'
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

SOURCE_NAMES = ('qm', 'kg', 'ne', 'lrclib')
LANG_NAMES = ('orig', 'ts', 'roma')
CREDIT_KEYWORDS = (
    '词：', '曲：', '词:', '曲:', '作词', '作曲', '编曲', '編曲', '制作', '演唱',
    '歌手', '混音', '母带', '吉他', 'ベース', 'ギター', 'ドラム', 'プロデュース',
    'ミックス', 'マスタリング', '录音', '和声', 'OP：', 'SP：',
)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='纯终端通过 LDDC 下载 LRC 歌词。')
    parser.add_argument('--asset-repo', type=Path, default=DEFAULT_ASSET_REPO)
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument('--raw-url', default=DEFAULT_RAW_URL)
    parser.add_argument('--lddc-root', type=Path, default=DEFAULT_LDDC_ROOT)
    parser.add_argument('--mid', type=int, action='append', default=None, help='仅处理指定 mid，可重复。')
    parser.add_argument('--sources', default='qm,kg,ne,lrclib', help='逗号分隔的音源顺序：qm,kg,ne,lrclib。')
    parser.add_argument('--langs', default='orig,ts', help='逗号分隔的输出语言：orig,ts,roma（如 orig,ts 生成双语）。')
    parser.add_argument('--strip-credits', action='store_true', help='删除开头的时间戳制作者信息行（词/曲/编曲等）。')
    parser.add_argument('--min-score', type=float, default=68.0, help='LDDC 自动匹配最低分数。')
    parser.add_argument('--offset', type=int, default=0, help='跳过前 N 首候选曲目。')
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


def read_jsonl_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), start=1):
        if not line.startswith('{'):
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f'{path}:{line_number} 不是有效 JSON：{error.msg}') from error
        if not isinstance(record, dict):
            raise ValueError(f'{path}:{line_number} 不是对象。')
        records.append(record)
    return records


def write_jsonl_records(path: Path, class_name: str, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    header = f'{HEADER_PREFIX}{json.dumps({"type": "Class", "class": class_name}, ensure_ascii=False, separators=(",", ":"))}'
    content = '\n'.join([header, *(json.dumps(record, ensure_ascii=False, separators=(',', ':')) for record in records)]) + '\n'
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False) as output:
        output.write(content)
        temporary = Path(output.name)
    temporary.replace(path)


def asset_relative_from_url(url: Any) -> Path | None:
    if not isinstance(url, str) or not url:
        return None
    path = urlsplit(url).path
    index = path.find(URL_MARKER)
    if index < 0:
        return None
    relative = Path(unquote(path[index + len(URL_MARKER):]))
    if not relative.parts or relative.is_absolute() or '..' in relative.parts:
        return None
    return relative


def raw_url(base: str, relative: Path) -> str:
    return f'{base.rstrip("/")}/{quote(relative.as_posix(), safe="/")}'


def is_obvious_instrumental(title: str, artist: str) -> bool:
    text = f'{title} {artist}'.casefold()
    return (
        artist.casefold() in INSTRUMENTAL_ARTISTS
        or any(marker in text for marker in ('instrumental', 'off vocal', 'offvocal', 'monologue', 'inst.'))
    )


def parse_sources(value: str) -> tuple[str, ...]:
    names = [piece.strip().lower() for piece in value.split(',') if piece.strip()]
    invalid = [name for name in names if name not in SOURCE_NAMES]
    if invalid:
        raise ValueError(f'未知音源：{", ".join(invalid)}；可选：{", ".join(SOURCE_NAMES)}。')
    return tuple(dict.fromkeys(names)) or SOURCE_NAMES


def parse_langs(value: str) -> list[str]:
    names = [piece.strip().lower() for piece in value.split(',') if piece.strip()]
    invalid = [name for name in names if name not in LANG_NAMES]
    if invalid:
        raise ValueError(f'未知语言：{", ".join(invalid)}；可选：{", ".join(LANG_NAMES)}。')
    return list(dict.fromkeys(names)) or ['orig']


def is_credit_line(text: str, title: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    if re.match(r'^\S.*?\s+-\s+.+\s*$', stripped) and stripped.startswith(title.split(' - ')[0].strip()):
        return True
    if re.match(r'^.+\s+-\s+.+$', stripped) and len(stripped) <= 60 and not re.search(r'[，。！？、♪♡]', stripped):
        return True
    return any(keyword in stripped for keyword in CREDIT_KEYWORDS)


def strip_leading_credits(lines: list[str], title: str) -> list[str]:
    """保留标签头，仅删除正文开头的时间戳制作者信息行。"""
    timestamp = re.compile(r'^\[\d{1,2}:\d{2}')
    start = next((i for i, line in enumerate(lines) if timestamp.match(line)), len(lines))
    header = lines[:start]
    body = lines[start:]
    index = 0
    for index, line in enumerate(body):
        text = timestamp.sub('', line).strip()
        if not is_credit_line(text, title):
            return [*header, *body[index:]]
    return header


def retag(content: str, title: str, artist: str, album: str | None) -> str:
    """把 LDDC 生成的标签替换为资料中的歌名/歌手/专辑，并移除 offset。"""
    result: list[str] = []
    for line in content.splitlines():
        if line.startswith('[ti:'):
            result.append(f'[ti:{title}]')
        elif line.startswith('[ar:'):
            result.append(f'[ar:{artist}]')
        elif line.startswith('[al:'):
            result.append(f'[al:{album or title}]')
        elif line.startswith('[offset:'):
            continue
        else:
            result.append(line)
    return '\n'.join(result)


def fetch_lyrics(
    title: str,
    artist: str,
    album: str | None,
    min_score: float,
    sources: tuple[str, ...],
    langs: list[str],
    strip_credits: bool,
) -> tuple[str, str, str | None]:
    """返回 (status, detail, content)；成功时 content 为逐行 LRC。"""
    from LDDC.common.models import LyricsFormat, SongInfo, Source
    from LDDC.core.auto_fetch import auto_fetch

    if is_obvious_instrumental(title, artist):
        return 'skipped', '器乐或独白曲目', None
    source_map = {'qm': Source.QM, 'kg': Source.KG, 'ne': Source.NE, 'lrclib': Source.LRCLIB}
    wanted = tuple(source_map[name] for name in sources)
    info = SongInfo(Source.Local, title=title, artist=artist, album=album or None)
    lyrics = auto_fetch(info=info, min_score=min_score, sources=wanted)
    if lyrics.is_inst():
        titles = dict.fromkeys(
            value
            for value in (
                info.title,
                info.title.replace('～', '~'),
                info.title.replace('Ver.', 'Version'),
            )
            if value
        )
        fallback_sources = tuple(source for source in wanted if source != Source.QM) or wanted
        for value in titles:
            fallback = auto_fetch(
                info=SongInfo(Source.Local, title=value, artist=artist),
                min_score=min_score,
                sources=fallback_sources,
            )
            if not fallback.is_inst():
                lyrics = fallback
                break
    if lyrics.is_inst():
        return 'skipped', 'LDDC 标记为器乐曲', None
    content = lyrics.to(lyrics_format=LyricsFormat.LINEBYLINELRC, langs=langs)
    if strip_credits:
        content = '\n'.join(strip_leading_credits(content.splitlines(), title))
    content = retag(content, title, artist, album)
    content = '\n'.join(line.rstrip() for line in content.splitlines()).strip('\n') + '\n'
    if not content.strip():
        return 'failed', 'LDDC 返回空歌词', None
    return 'success', str(lyrics.info.source.name), content


def read_album_tag(mp3_path: Path) -> str | None:
    if not mp3_path.is_file():
        return None
    try:
        from mutagen import File as MutagenFile

        audio = MutagenFile(mp3_path, easy=True)
        tags = getattr(audio, 'tags', None) or {}
    except Exception:
        return None
    for key in ('album', 'ALBUM'):
        values = tags.get(key)
        if isinstance(values, list) and values:
            return str(values[0]).strip() or None
        if isinstance(values, str) and values.strip():
            return values.strip()
    return None


def build_jobs(
    data_dir: Path,
    asset_repo: Path,
    selected_mids: set[int] | None,
    include_existing: bool = False,
) -> list[tuple[int, str, str, str | None, Path]]:
    """从 HQ 资料中挑选缺少 lrc 的曲目，返回 (mid, title, artist, album, lrc_relative)。"""
    records = read_jsonl_records(data_dir / 'music_hq.0.jsonl')
    jobs: list[tuple[int, str, str, str | None, Path]] = []
    for record in records:
        if record.get('lrc') and not include_existing:
            continue
        mid = record.get('mid')
        if not isinstance(mid, int):
            continue
        if selected_mids is not None and mid not in selected_mids:
            continue
        relative = asset_relative_from_url(record.get('url'))
        if relative is None:
            print(f'跳过 mid={mid}：无法解析资源相对路径。')
            continue
        title = str(record.get('title') or '').strip()
        artist = str(record.get('author') or '').strip()
        album = str(record.get('album') or '').strip() or None
        if album is None:
            album = read_album_tag(asset_repo / relative.with_suffix('.mp3'))
        if not title or not artist:
            print(f'跳过 mid={mid}：缺少歌名或歌手。')
            continue
        jobs.append((mid, title, artist, album, relative.with_suffix('.lrc')))
    return jobs


def write_report(path: Path, results: list[dict[str, Any]]) -> None:
    summary = Counter(result['status'] for result in results)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({'summary': dict(summary), 'results': results}, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def update_jsonl(data_dir: Path, raw_url_base: str, written: dict[int, Path]) -> tuple[int, int]:
    if not written:
        return 0, 0
    relative_urls = {
        mid: raw_url(raw_url_base, path)
        for mid, path in written.items()
    }
    counts: list[int] = []
    for name in ('music_hq', 'music_sq'):
        path = data_dir / f'{name}.0.jsonl'
        records = read_jsonl_records(path)
        changed = 0
        for record in records:
            mid = record.get('mid')
            if mid in relative_urls and not record.get('lrc'):
                record['lrc'] = relative_urls[mid]
                changed += 1
        if changed:
            write_jsonl_records(path, name, records)
        counts.append(changed)
    return counts[0], counts[1]


def main() -> int:
    args = parse_arguments()
    if args.offset < 0 or args.limit < 0:
        raise ValueError('offset 和 limit 不能为负数。')
    sources = parse_sources(args.sources)
    langs = parse_langs(args.langs)
    selected_mids = set(args.mid) if args.mid else None
    jobs = build_jobs(args.data_dir, args.asset_repo, selected_mids, include_existing=args.overwrite)
    if args.offset:
        jobs = jobs[args.offset:]
    if args.limit:
        jobs = jobs[:args.limit]
    print(f'待补歌词：{len(jobs)} 首。')
    for mid, title, artist, _, relative in jobs:
        print(f'  mid={mid}  {artist} - {title}  ->  {relative.as_posix()}')
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
    _ = application

    results: list[dict[str, Any]] = []
    written: dict[int, Path] = {}
    total = len(jobs)
    for index, (mid, title, artist, album, relative) in enumerate(jobs, start=1):
        target = args.asset_repo / relative
        print(f'[{index}/{total}] mid={mid}  {artist} - {title}')
        if target.is_file() and not args.overwrite:
            written[mid] = relative
            results.append({'mid': mid, 'status': 'existing', 'detail': target.as_posix()})
            print('  existing：已有歌词')
            continue
        try:
            status, detail, content = fetch_lyrics(
                title, artist, album, args.min_score, sources, langs, args.strip_credits
            )
        except Exception as error:
            status, detail, content = 'failed', f'{error.__class__.__name__}: {error}', None
        if status == 'success' and content is not None:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding='utf-8')
            written[mid] = relative
        print(f'  {status}：{detail}')
        results.append({'mid': mid, 'status': status, 'detail': detail})

    hq_count, sq_count = update_jsonl(args.data_dir, args.raw_url, written)
    print(f'已写回歌词资料：HQ {hq_count} 条，SQ {sq_count} 条。')
    summary = Counter(result['status'] for result in results)
    print(f'完成：{dict(summary)}。')
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
