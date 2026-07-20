#!/usr/bin/env python3
"""Local music-library organiser for the website's static JSONL database.

The tool deliberately keeps all media work local.  It scans a source folder,
uses metadata when available, converts selected tracks to 320 kbps MP3 with
FFmpeg, copies optional high-quality originals and sidecar cover/LRC files,
then merges entries into ``static/data/music_hq.0.jsonl`` and
``static/data/music_sq.0.jsonl``.  It also provides ordinary Git operations
for the media repositories.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.parse import quote

try:
    from mutagen import File as MutagenFile
except ImportError as exc:
    raise SystemExit(
        '缺少 mutagen。请执行：python3 -m pip install -r tools/requirements-music-library-gui.txt'
    ) from exc

try:
    from PyQt6.QtCore import Qt, QObject, pyqtSignal
    from PyQt6.QtWidgets import (
        QApplication,
        QCheckBox,
        QComboBox,
        QFileDialog,
        QFormLayout,
        QFrame,
        QGridLayout,
        QGroupBox,
        QHBoxLayout,
        QHeaderView,
        QLabel,
        QLineEdit,
        QListWidget,
        QListWidgetItem,
        QMainWindow,
        QMessageBox,
        QPlainTextEdit,
        QPushButton,
        QSizePolicy,
        QSplitter,
        QStatusBar,
        QTabWidget,
        QTableWidget,
        QTableWidgetItem,
        QVBoxLayout,
        QWidget,
    )
except ImportError as exc:
    raise SystemExit(
        '缺少 PyQt6。请执行：python3 -m pip install -r tools/requirements-music-library-gui.txt'
    ) from exc


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = PROJECT_ROOT / 'static' / 'data'
CONFIG_FILE = Path.home() / '.config' / 'yusen-music-library' / 'config.json'
AUDIO_EXTENSIONS = {'.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.mp3', '.aiff', '.alac'}
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')
HEADER_PREFIX = '#filetype:JSON-streaming '
INVALID_FILE_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
SPACE_RE = re.compile(r'\s+')


def clean_text(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, (list, tuple)):
        return ' / '.join(clean_text(item) for item in value if clean_text(item))
    if hasattr(value, 'text'):
        return clean_text(value.text)
    text = str(value).strip()
    text = text.replace("['", '').replace("']", '').replace('["', '').replace('"]', '')
    return SPACE_RE.sub(' ', text).strip()


def safe_file_name(value: str, fallback: str = 'untitled', max_bytes: int = 180) -> str:
    """Return one portable path component without exceeding filesystem limits."""
    cleaned = INVALID_FILE_CHARS.sub(' ', value)
    cleaned = SPACE_RE.sub(' ', cleaned).strip(' .')
    cleaned = cleaned or fallback
    if len(cleaned.encode('utf-8')) <= max_bytes:
        return cleaned
    digest = hashlib.sha256(cleaned.encode('utf-8')).hexdigest()[:12]
    suffix = f'-{digest}'
    allowed = max_bytes - len(suffix.encode('utf-8'))
    prefix: list[str] = []
    used = 0
    for character in cleaned:
        size = len(character.encode('utf-8'))
        if used + size > allowed:
            break
        prefix.append(character)
        used += size
    return ''.join(prefix).rstrip(' .') + suffix


def metadata_value(tags: Any, keys: Iterable[str]) -> str:
    if not tags:
        return ''
    for key in keys:
        try:
            value = tags.get(key)
        except AttributeError:
            value = None
        text = clean_text(value)
        if text:
            return text
    return ''


def file_name_metadata(path: Path) -> tuple[str, str]:
    candidate = path.stem.strip()
    match = re.match(r'^(.+?)\s*[-–—]\s*(.+)$', candidate)
    if match:
        return match.group(2).strip(), match.group(1).strip()
    return candidate, ''


def discover_companion(path: Path, extensions: tuple[str, ...], generic_names: tuple[str, ...]) -> Path | None:
    for extension in extensions:
        candidate = path.with_suffix(extension)
        if candidate.is_file():
            return candidate
    for name in generic_names:
        candidate = path.parent / name
        if candidate.is_file():
            return candidate
    return None


def image_extension(data: bytes, mime_type: str = '') -> str:
    """Choose a safe filename extension for embedded artwork."""
    normalized_mime = mime_type.lower().split(';', 1)[0].strip()
    by_mime = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
    }
    if normalized_mime in by_mime:
        return by_mime[normalized_mime]
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return '.webp'
    return '.jpg'


def embedded_cover_data(path: Path) -> tuple[bytes, str] | None:
    """Read one embedded cover from common Mutagen container types."""
    try:
        audio = MutagenFile(path)
    except Exception:
        return None
    if not audio:
        return None

    pictures = getattr(audio, 'pictures', None) or []
    for picture in pictures:
        data = getattr(picture, 'data', b'')
        if data:
            return bytes(data), str(getattr(picture, 'mime', ''))

    tags = getattr(audio, 'tags', None)
    if not tags:
        return None
    try:
        tag_values = tags.items()
    except AttributeError:
        return None
    for key, value in tag_values:
        key_text = str(key).lower()
        data = getattr(value, 'data', None)
        if key_text.startswith('apic') and data:
            return bytes(data), str(getattr(value, 'mime', ''))
        if key_text == 'covr':
            values = value if isinstance(value, (list, tuple)) else (value,)
            for cover in values:
                if cover:
                    return bytes(cover), ''
        if key_text == 'metadata_block_picture':
            values = value if isinstance(value, (list, tuple)) else (value,)
            for encoded in values:
                try:
                    decoded = base64.b64decode(str(encoded))
                except (ValueError, TypeError):
                    continue
                if decoded:
                    # Vorbis comments store a FLAC picture block. FFmpeg can
                    # still export it later, but treating it as raw image data
                    # would produce an invalid cover, so skip this uncommon form.
                    continue
    return None


def embedded_cover_extension(path: Path) -> str | None:
    cover = embedded_cover_data(path)
    return image_extension(*cover) if cover else None


def relative_to_root(path: Path, root: Path) -> Path:
    try:
        return path.relative_to(root)
    except ValueError:
        return Path(path.name)


def same_file_path(left: Path, right: Path) -> bool:
    try:
        return left.resolve() == right.resolve()
    except OSError:
        return left.absolute() == right.absolute()


@dataclass
class Track:
    source: Path
    source_relative: Path
    title: str
    artist: str
    album: str
    cover: Path | None
    lyrics: Path | None
    embedded_cover_extension: str | None = None
    tag_ids: tuple[int, ...] = ()

    @property
    def display_name(self) -> str:
        return safe_file_name(f'{self.artist} - {self.title}' if self.artist else self.title)

    @property
    def key(self) -> tuple[str, str]:
        return (self.title.strip(), self.artist.strip())

    @property
    def output_directory(self) -> Path:
        parent = self.source_relative.parent
        return Path() if str(parent) == '.' else parent

    def mp3_relative(self) -> Path:
        return self.output_directory / f'{self.display_name}.mp3'

    def original_relative(self) -> Path:
        return self.output_directory / f'{self.display_name}{self.source.suffix.lower()}'

    def sidecar_relative(self, sidecar: Path | None) -> Path | None:
        if not sidecar:
            return None
        return self.output_directory / safe_file_name(sidecar.name)

    def cover_relative(self) -> Path | None:
        external = self.sidecar_relative(self.cover)
        if external:
            return external
        if self.embedded_cover_extension:
            if self.output_directory == Path():
                return Path(f'{self.display_name}.cover{self.embedded_cover_extension}')
            return self.output_directory / f'cover{self.embedded_cover_extension}'
        return None


@dataclass(frozen=True)
class LibraryConfig:
    source_dir: Path
    mp3_repo_dir: Path
    sq_repo_dir: Path | None
    data_dir: Path
    mp3_raw_url: str
    sq_raw_url: str
    list_ids: tuple[int, ...]
    overwrite: bool


def read_track(path: Path, source_root: Path) -> Track:
    fallback_title, fallback_artist = file_name_metadata(path)
    title = fallback_title
    artist = fallback_artist
    album = ''
    try:
        audio = MutagenFile(path, easy=True)
        tags = getattr(audio, 'tags', None)
        title = metadata_value(tags, ('title', 'TITLE')) or title
        artist = metadata_value(tags, ('artist', 'albumartist', 'ARTIST', 'ALBUMARTIST')) or artist
        album = metadata_value(tags, ('album', 'ALBUM'))
    except Exception:
        # A damaged tag must not stop the scan. The filename remains usable.
        pass
    cover = discover_companion(path, IMAGE_EXTENSIONS, ('Cover.jpg', 'Cover.png', 'cover.jpg', 'cover.png', 'folder.jpg'))
    return Track(
        source=path,
        source_relative=relative_to_root(path, source_root),
        title=clean_text(title) or path.stem,
        artist=clean_text(artist),
        album=clean_text(album),
        cover=cover,
        lyrics=discover_companion(path, ('.lrc',), ('lyrics.lrc', 'Lyrics.lrc')),
        embedded_cover_extension=None if cover else embedded_cover_extension(path),
    )


def scan_tracks(source_dir: Path) -> list[Track]:
    if not source_dir.is_dir():
        raise ValueError('音乐源目录不存在。')
    tracks = [
        read_track(path, source_dir)
        for path in sorted(source_dir.rglob('*'))
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS
    ]
    if not tracks:
        raise ValueError('源目录中没有找到支持的音频文件。')
    return tracks


def copy_if_needed(source: Path | None, target: Path | None, overwrite: bool) -> str:
    if not source or not target:
        return '无侧车文件'
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not overwrite:
        return f'保留 {target.name}'
    if same_file_path(source, target):
        return f'已在目标位置 {target.name}'
    shutil.copy2(source, target)
    return f'复制 {target.name}'


def export_embedded_cover(track: Track, target: Path | None, overwrite: bool) -> str:
    if not target or not track.embedded_cover_extension:
        return '无侧车文件'
    if target.exists() and not overwrite:
        return f'保留 {target.name}'
    cover = embedded_cover_data(track.source)
    if not cover:
        return '未找到内嵌封面'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(cover[0])
    return f'导出内嵌封面 {target.name}'


def run_ffmpeg(source: Path, target: Path, overwrite: bool) -> None:
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        raise RuntimeError('找不到 ffmpeg。请安装 FFmpeg 后再转换。')
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not overwrite:
        return
    command = [
        ffmpeg,
        '-hide_banner',
        '-nostdin',
        '-y' if overwrite else '-n',
        '-i',
        str(source),
        '-vn',
        '-map_metadata',
        '0',
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '320k',
        '-id3v2_version',
        '3',
        str(target),
    ]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        check=False,
    )
    if result.returncode:
        detail = (result.stderr or result.stdout).strip().splitlines()
        tail = detail[-1] if detail else f'ffmpeg 退出码 {result.returncode}'
        raise RuntimeError(f'{source.name} 转码失败：{tail}')


def copy_high_quality(track: Track, config: LibraryConfig) -> str:
    if not config.sq_repo_dir:
        return '未设置高音质仓库，跳过'
    target = config.sq_repo_dir / track.original_relative()
    return copy_if_needed(track.source, target, config.overwrite)


def process_tracks(
    tracks: list[Track],
    config: LibraryConfig,
    transcode: bool,
    copy_source: bool,
    progress: Callable[[str], None],
) -> None:
    if transcode and not config.mp3_repo_dir:
        raise ValueError('请设置 MP3 资源仓库目录。')
    for index, track in enumerate(tracks, start=1):
        progress(f'[{index}/{len(tracks)}] {track.display_name}')
        if transcode:
            mp3_target = config.mp3_repo_dir / track.mp3_relative()
            run_ffmpeg(track.source, mp3_target, config.overwrite)
            cover_relative = track.cover_relative()
            cover_target = config.mp3_repo_dir / cover_relative if cover_relative else None
            lyric_target = config.mp3_repo_dir / track.sidecar_relative(track.lyrics) if track.lyrics else None
            progress(f'  MP3：{mp3_target.relative_to(config.mp3_repo_dir)}')
            cover_action = (
                copy_if_needed(track.cover, cover_target, config.overwrite)
                if track.cover else export_embedded_cover(track, cover_target, config.overwrite)
            )
            for action in (cover_action, copy_if_needed(track.lyrics, lyric_target, config.overwrite)):
                if action != '无侧车文件':
                    progress(f'  {action}')
        if copy_source:
            progress(f'  高音质：{copy_high_quality(track, config)}')


def read_jsonl_records(path: Path, expected_class: str) -> list[dict[str, Any]]:
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


def normalised_key(record: dict[str, Any]) -> tuple[str, str] | None:
    title = clean_text(record.get('title'))
    artist = clean_text(record.get('author'))
    return (title, artist) if title else None


def raw_url(base: str, relative: Path | None) -> str | None:
    if not base.strip() or relative is None:
        return None
    return f'{base.rstrip("/")}/{quote(relative.as_posix(), safe="/")}'


def parse_list_ids(value: str) -> tuple[int, ...]:
    pieces = [piece.strip() for piece in value.split(',') if piece.strip()]
    if not pieces:
        raise ValueError('至少需要填写一个歌单 ID。')
    try:
        result = tuple(dict.fromkeys(int(piece) for piece in pieces))
    except ValueError as error:
        raise ValueError('歌单 ID 必须用英文逗号分隔的整数。') from error
    if any(item < 0 for item in result):
        raise ValueError('歌单 ID 不能为负数。')
    return result


def find_existing_mid(track: Track, hq: list[dict[str, Any]], sq: list[dict[str, Any]]) -> int | None:
    candidates: list[int] = []
    for record in [*hq, *sq]:
        if normalised_key(record) == track.key and isinstance(record.get('mid'), int):
            candidates.append(record['mid'])
    return min(candidates) if candidates else None


def record_for_track(track: Track, mid: int, quality: str, config: LibraryConfig, current: dict[str, Any] | None) -> dict[str, Any]:
    record = dict(current or {})
    mp3_url = raw_url(config.mp3_raw_url, track.mp3_relative())
    if not mp3_url:
        raise ValueError('导出 JSONL 前必须填写 MP3 原始文件 URL 前缀。')
    source_url = raw_url(config.sq_raw_url, track.original_relative()) if config.sq_raw_url.strip() else mp3_url
    record.update({
        'mid': mid,
        'title': track.title,
        'author': track.artist,
        'z_full_name': f'{track.artist} - {track.title}' if track.artist else track.title,
        'list': list(track.tag_ids or config.list_ids),
        'url': source_url if quality == 'sq' else mp3_url,
    })
    cover_url = raw_url(config.mp3_raw_url, track.cover_relative())
    lyric_url = raw_url(config.mp3_raw_url, track.sidecar_relative(track.lyrics))
    if cover_url:
        record['pic'] = cover_url
    else:
        record.pop('pic', None)
    if lyric_url:
        record['lrc'] = lyric_url
    else:
        record.pop('lrc', None)
    return record


def export_database(tracks: list[Track], config: LibraryConfig, progress: Callable[[str], None]) -> tuple[int, int]:
    if not tracks:
        raise ValueError('没有可导出的曲目。')
    if not config.data_dir.is_dir():
        raise ValueError('JSONL 资料目录不存在。')
    hq_path = config.data_dir / 'music_hq.0.jsonl'
    sq_path = config.data_dir / 'music_sq.0.jsonl'
    hq = read_jsonl_records(hq_path, 'music_hq')
    sq = read_jsonl_records(sq_path, 'music_sq')
    hq_by_mid = {record.get('mid'): record for record in hq if isinstance(record.get('mid'), int)}
    sq_by_mid = {record.get('mid'): record for record in sq if isinstance(record.get('mid'), int)}
    hq_order = [record['mid'] for record in hq if isinstance(record.get('mid'), int)]
    sq_order = [record['mid'] for record in sq if isinstance(record.get('mid'), int)]
    used_ids = set(hq_by_mid) | set(sq_by_mid)
    next_mid = max(used_ids, default=-1) + 1
    selected_keys: set[tuple[str, str]] = set()

    for track in tracks:
        if track.key in selected_keys:
            raise ValueError(f'选中的曲目存在同名同歌手记录：{track.display_name}')
        selected_keys.add(track.key)
        mid = find_existing_mid(track, hq, sq)
        if mid is None:
            while next_mid in used_ids:
                next_mid += 1
            mid = next_mid
            used_ids.add(mid)
            next_mid += 1
            progress(f'新增 mid={mid}：{track.display_name}')
        else:
            progress(f'更新 mid={mid}：{track.display_name}')
        hq_by_mid[mid] = record_for_track(track, mid, 'hq', config, hq_by_mid.get(mid))
        sq_by_mid[mid] = record_for_track(track, mid, 'sq', config, sq_by_mid.get(mid))

    # The original LeanCloud export is not ordered strictly by ``mid``. Keep
    # its established sequence so importing a few new songs changes only the
    # new or updated records, not the entire static dataset.
    hq_records = [hq_by_mid[mid] for mid in hq_order if mid in hq_by_mid]
    sq_records = [sq_by_mid[mid] for mid in sq_order if mid in sq_by_mid]
    hq_records.extend(hq_by_mid[mid] for mid in sorted(set(hq_by_mid) - set(hq_order)))
    sq_records.extend(sq_by_mid[mid] for mid in sorted(set(sq_by_mid) - set(sq_order)))
    write_jsonl_records(hq_path, 'music_hq', hq_records)
    write_jsonl_records(sq_path, 'music_sq', sq_records)
    return len(hq_records), len(sq_records)


def apply_existing_tags(tracks: list[Track], data_dir: Path) -> None:
    """Restore playlist IDs when a scanned file already has a JSONL entry."""
    records: dict[tuple[str, str], tuple[int, ...]] = {}
    for name in ('music_hq', 'music_sq'):
        try:
            source = read_jsonl_records(data_dir / f'{name}.0.jsonl', name)
        except (OSError, ValueError):
            continue
        for record in source:
            key = normalised_key(record)
            values = record.get('list')
            if key and isinstance(values, list) and all(isinstance(value, int) for value in values) and values:
                records.setdefault(key, tuple(dict.fromkeys(values)))
    for track in tracks:
        if track.key in records:
            track.tag_ids = records[track.key]


def run_git(repo: Path, *arguments: str) -> str:
    if not repo.is_dir():
        raise ValueError('Git 仓库目录不存在。')
    command = ['git', '-C', str(repo), *arguments]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    output = '\n'.join(item for item in (result.stdout.strip(), result.stderr.strip()) if item)
    if result.returncode:
        raise RuntimeError(output or f'git 退出码 {result.returncode}')
    return output or '完成。'


def save_preferences(values: dict[str, str]) -> None:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(values, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def load_preferences() -> dict[str, str]:
    try:
        candidate = json.loads(CONFIG_FILE.read_text(encoding='utf-8'))
        return candidate if isinstance(candidate, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


class TaskSignals(QObject):
    log = pyqtSignal(str)
    done = pyqtSignal(str, object, object)
    failed = pyqtSignal(str, str)


class MusicLibraryApp(QMainWindow):
    """PyQt6 interface for local music processing and repository operations."""

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle('音乐资料整理与 Git 管理')
        self.resize(1200, 800)
        self.setMinimumSize(980, 680)
        self.tracks: list[Track] = []
        self.busy = False
        self._buttons: list[QPushButton] = []
        self._threads: list[threading.Thread] = []
        preferences = load_preferences()
        self.build_ui(preferences)
        self.statusBar().showMessage('选择音乐源目录后点击“扫描音乐”。')

    def line_edit(self, value: str = '', placeholder: str = '') -> QLineEdit:
        field = QLineEdit(value)
        field.setPlaceholderText(placeholder)
        return field

    def build_ui(self, preferences: dict[str, str]) -> None:
        tabs = QTabWidget()
        self.setCentralWidget(tabs)
        self.library_tab = QWidget()
        self.git_tab = QWidget()
        self.log_tab = QWidget()
        tabs.addTab(self.library_tab, '音乐整理与 JSONL')
        tabs.addTab(self.git_tab, '资源仓库 Git')
        tabs.addTab(self.log_tab, '执行日志')
        self.build_library_tab(preferences)
        self.build_git_tab(preferences)
        self.build_log_tab()
        self.setStatusBar(QStatusBar(self))

    def build_library_tab(self, preferences: dict[str, str]) -> None:
        layout = QVBoxLayout(self.library_tab)
        settings = QGroupBox('目录与发布地址')
        grid = QGridLayout(settings)
        grid.setColumnStretch(1, 1)
        self.source_dir = self.line_edit(preferences.get('source_dir', ''))
        self.mp3_repo_dir = self.line_edit(preferences.get('mp3_repo_dir', ''))
        self.sq_repo_dir = self.line_edit(preferences.get('sq_repo_dir', ''))
        self.data_dir = self.line_edit(preferences.get('data_dir', str(DEFAULT_DATA_DIR)))
        path_rows = (
            ('音乐源目录', self.source_dir, '选择音乐源目录'),
            ('MP3 资源仓库', self.mp3_repo_dir, '选择 MP3 资源仓库目录'),
            ('高音质资源仓库（可选）', self.sq_repo_dir, '选择高音质资源仓库目录'),
            ('博客 JSONL 目录', self.data_dir, '选择博客 static/data 目录'),
        )
        for row, (label, field, title) in enumerate(path_rows):
            grid.addWidget(QLabel(label), row, 0)
            grid.addWidget(field, row, 1)
            button = QPushButton('选择…')
            button.clicked.connect(lambda _checked=False, target=field, dialog_title=title: self.choose_directory(target, dialog_title))
            grid.addWidget(button, row, 2)
        self.mp3_raw_url = self.line_edit(preferences.get('mp3_raw_url', ''), 'https://media.example/music-mp3')
        self.sq_raw_url = self.line_edit(preferences.get('sq_raw_url', ''), 'https://media.example/music-hires')
        self.list_ids = self.line_edit(preferences.get('list_ids', '1,2'), '例如：1,2,47')
        self.overwrite = QCheckBox('覆盖已有资源文件')
        self.overwrite.setChecked(preferences.get('overwrite', 'false') == 'true')
        grid.addWidget(QLabel('MP3 原始文件 URL 前缀'), 4, 0)
        grid.addWidget(self.mp3_raw_url, 4, 1, 1, 2)
        grid.addWidget(QLabel('高音质原始文件 URL 前缀'), 5, 0)
        grid.addWidget(self.sq_raw_url, 5, 1, 1, 2)
        grid.addWidget(QLabel('默认歌单 ID'), 6, 0)
        grid.addWidget(self.list_ids, 6, 1)
        grid.addWidget(self.overwrite, 6, 2)
        layout.addWidget(settings)

        actions = QHBoxLayout()
        self.scan_button = self.action_button('扫描音乐', self.scan_music)
        self.convert_button = self.action_button('转码为 320k MP3（所选）', self.convert_selected)
        self.copy_button = self.action_button('复制高音质文件（所选）', self.copy_selected)
        self.export_button = self.action_button('导出 JSONL（所选）', self.export_selected)
        self.all_button = self.action_button('整理并导出（所选）', self.organise_and_export)
        for button in (self.scan_button, self.convert_button, self.copy_button, self.export_button, self.all_button):
            actions.addWidget(button)
        actions.addStretch(1)
        layout.addLayout(actions)

        splitter = QSplitter(Qt.Orientation.Vertical)
        self.track_table = QTableWidget(0, 7)
        self.track_table.setHorizontalHeaderLabels(['源文件', '歌名', '歌手', '专辑', '标签', '歌词', '封面'])
        self.track_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.track_table.setSelectionMode(QTableWidget.SelectionMode.ExtendedSelection)
        self.track_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        header = self.track_table.horizontalHeader()
        for index in range(5):
            header.setSectionResizeMode(index, QHeaderView.ResizeMode.Stretch)
        for index in (5, 6):
            header.setSectionResizeMode(index, QHeaderView.ResizeMode.ResizeToContents)
        self.track_table.itemSelectionChanged.connect(self.load_selected_metadata)
        splitter.addWidget(self.track_table)

        editor = QGroupBox('选中曲目的元数据（修改后仅影响输出与 JSONL）')
        editor_form = QFormLayout(editor)
        self.edit_title = self.line_edit()
        self.edit_artist = self.line_edit()
        self.edit_album = self.line_edit()
        editor_form.addRow('歌名', self.edit_title)
        editor_form.addRow('歌手', self.edit_artist)
        editor_form.addRow('专辑', self.edit_album)
        tag_panel = QWidget()
        tag_layout = QVBoxLayout(tag_panel)
        tag_layout.setContentsMargins(0, 0, 0, 0)
        self.tag_list = QListWidget()
        self.tag_list.setMinimumHeight(105)
        self.tag_list.setMaximumHeight(150)
        tag_layout.addWidget(self.tag_list)
        tag_actions = QHBoxLayout()
        reload_tags = self.action_button('读取标签目录', self.reload_tag_catalog)
        apply_tags = self.action_button('将勾选标签应用到选中曲目', self.apply_tags)
        tag_actions.addWidget(reload_tags)
        tag_actions.addWidget(apply_tags)
        tag_actions.addStretch(1)
        tag_layout.addLayout(tag_actions)
        editor_form.addRow('歌单标签', tag_panel)
        apply_button = self.action_button('应用到选中曲目', self.apply_metadata)
        editor_form.addRow('', apply_button)
        splitter.addWidget(editor)
        splitter.setStretchFactor(0, 5)
        splitter.setStretchFactor(1, 1)
        layout.addWidget(splitter, 1)
        self.tag_names: dict[int, str] = {}
        self.reload_tag_catalog()

    def build_git_tab(self, preferences: dict[str, str]) -> None:
        layout = QVBoxLayout(self.git_tab)
        settings = QGroupBox('Git 操作')
        form = QGridLayout(settings)
        form.setColumnStretch(1, 1)
        self.git_target = QComboBox()
        self.git_target.addItems(['MP3 资源仓库', '高音质资源仓库'])
        self.git_remote = self.line_edit(preferences.get('git_remote', ''), 'git@github.com:user/music-assets.git')
        self.git_message = self.line_edit('音乐资料：更新曲库资源')
        form.addWidget(QLabel('操作目标'), 0, 0)
        form.addWidget(self.git_target, 0, 1)
        status_button = self.action_button('查看状态', self.git_status)
        init_button = self.action_button('初始化仓库', self.git_init)
        form.addWidget(status_button, 0, 2)
        form.addWidget(init_button, 0, 3)
        form.addWidget(QLabel('origin 地址'), 1, 0)
        form.addWidget(self.git_remote, 1, 1, 1, 2)
        form.addWidget(self.action_button('设置 origin', self.git_set_remote), 1, 3)
        form.addWidget(QLabel('提交说明'), 2, 0)
        form.addWidget(self.git_message, 2, 1, 1, 2)
        form.addWidget(self.action_button('暂存并提交', self.git_commit), 2, 3)
        form.addWidget(self.action_button('推送到 origin', self.git_push), 3, 3)
        note = QLabel('Git 使用系统已安装的 git。提交和推送只会操作此页选中的资源仓库，不会修改博客仓库。')
        note.setWordWrap(True)
        form.addWidget(note, 3, 0, 1, 3)
        layout.addWidget(settings)
        layout.addStretch(1)

    def build_log_tab(self) -> None:
        layout = QVBoxLayout(self.log_tab)
        self.log_output = QPlainTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setLineWrapMode(QPlainTextEdit.LineWrapMode.WidgetWidth)
        layout.addWidget(self.log_output)

    def action_button(self, label: str, callback: Callable[[], None]) -> QPushButton:
        button = QPushButton(label)
        button.clicked.connect(callback)
        self._buttons.append(button)
        return button

    def choose_directory(self, field: QLineEdit, title: str) -> None:
        selected = QFileDialog.getExistingDirectory(self, title, field.text().strip() or str(PROJECT_ROOT))
        if selected:
            field.setText(selected)

    def reload_tag_catalog(self) -> None:
        data_dir = Path(self.data_dir.text().strip()).expanduser()
        path = data_dir / 'music_tag.0.jsonl'
        try:
            records = read_jsonl_records(path, 'music_tag')
        except (OSError, ValueError) as error:
            self.statusBar().showMessage(f'无法读取标签目录：{error}')
            return
        tags = [
            record for record in records
            if isinstance(record.get('tag_id'), int) and clean_text(record.get('tag_name'))
        ]
        tags.sort(key=lambda record: (record.get('tag_order', 999_999), record['tag_id']))
        checked = set(self.checked_tag_ids())
        self.tag_names = {int(record['tag_id']): clean_text(record['tag_name']) for record in tags}
        self.tag_list.clear()
        for record in tags:
            tag_id = int(record['tag_id'])
            item = QListWidgetItem(f'#{tag_id}  {self.tag_names[tag_id]}')
            item.setData(Qt.ItemDataRole.UserRole, tag_id)
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            item.setCheckState(Qt.CheckState.Checked if tag_id in checked else Qt.CheckState.Unchecked)
            self.tag_list.addItem(item)
        self.statusBar().showMessage(f'已读取 {len(tags)} 个歌单标签。')

    def checked_tag_ids(self) -> tuple[int, ...]:
        values: list[int] = []
        for row in range(self.tag_list.count()):
            item = self.tag_list.item(row)
            if item.checkState() == Qt.CheckState.Checked:
                value = item.data(Qt.ItemDataRole.UserRole)
                if isinstance(value, int):
                    values.append(value)
        return tuple(dict.fromkeys(values))

    def show_track_tags(self, track: Track) -> str:
        values = track.tag_ids
        if not values:
            try:
                values = parse_list_ids(self.list_ids.text())
            except ValueError:
                return '未设置'
        return '、'.join(self.tag_names.get(tag_id, f'#{tag_id}') for tag_id in values)

    def set_checked_tags(self, values: Iterable[int]) -> None:
        selected = set(values)
        for row in range(self.tag_list.count()):
            item = self.tag_list.item(row)
            tag_id = item.data(Qt.ItemDataRole.UserRole)
            item.setCheckState(Qt.CheckState.Checked if tag_id in selected else Qt.CheckState.Unchecked)

    def apply_tags(self) -> None:
        rows = sorted({index.row() for index in self.track_table.selectionModel().selectedRows()})
        if not rows:
            QMessageBox.information(self, '给音乐打标签', '请先在表格中选择一首或多首歌曲。')
            return
        tag_ids = self.checked_tag_ids()
        if not tag_ids:
            QMessageBox.information(self, '给音乐打标签', '请至少勾选一个歌单标签。')
            return
        for row in rows:
            self.tracks[row].tag_ids = tag_ids
        self.refresh_tracks(self.tracks)
        self.track_table.clearSelection()
        for row in rows:
            for column in range(self.track_table.columnCount()):
                item = self.track_table.item(row, column)
                if item:
                    item.setSelected(True)
        display = '、'.join(self.tag_names.get(tag_id, f'#{tag_id}') for tag_id in tag_ids)
        self.append_log(f'已为 {len(rows)} 首歌曲设置标签：{display}')

    def config_snapshot(self) -> LibraryConfig:
        source_raw = self.source_dir.text().strip()
        mp3_raw = self.mp3_repo_dir.text().strip()
        data_raw = self.data_dir.text().strip()
        if not source_raw or not Path(source_raw).expanduser().is_dir():
            raise ValueError('音乐源目录不存在。')
        if not mp3_raw:
            raise ValueError('请设置 MP3 资源仓库目录。')
        if not data_raw:
            raise ValueError('请设置博客 JSONL 目录。')
        sq_raw = self.sq_repo_dir.text().strip()
        return LibraryConfig(
            source_dir=Path(source_raw).expanduser(),
            mp3_repo_dir=Path(mp3_raw).expanduser(),
            sq_repo_dir=Path(sq_raw).expanduser() if sq_raw else None,
            data_dir=Path(data_raw).expanduser(),
            mp3_raw_url=self.mp3_raw_url.text().strip(),
            sq_raw_url=self.sq_raw_url.text().strip(),
            list_ids=parse_list_ids(self.list_ids.text()),
            overwrite=self.overwrite.isChecked(),
        )

    def selected_tracks(self) -> list[Track]:
        rows = sorted({index.row() for index in self.track_table.selectionModel().selectedRows()})
        return [self.tracks[row] for row in rows] if rows else list(self.tracks)

    def append_log(self, message: str) -> None:
        self.log_output.appendPlainText(message.rstrip())

    def run_background(
        self,
        label: str,
        operation: Callable[[Callable[[str], None]], Any],
        on_done: Callable[[Any], None] | None = None,
    ) -> None:
        if self.busy:
            self.statusBar().showMessage('已有任务正在执行。')
            return
        self.busy = True
        self.statusBar().showMessage(f'{label}…')
        for button in self._buttons:
            button.setEnabled(False)
        signals = TaskSignals(self)
        signals.log.connect(self.append_log)
        signals.done.connect(self.finish_task)
        signals.failed.connect(self.fail_task)

        def worker() -> None:
            try:
                result = operation(signals.log.emit)
                signals.done.emit(label, result, on_done)
            except Exception as error:
                signals.failed.emit(label, str(error))

        thread = threading.Thread(target=worker, daemon=True)
        self._threads.append(thread)
        thread.start()

    def finish_task(self, label: str, result: Any, on_done: Callable[[Any], None] | None) -> None:
        self.busy = False
        for button in self._buttons:
            button.setEnabled(True)
        if on_done:
            on_done(result)
        self.statusBar().showMessage(f'{label}完成。')
        self.append_log(f'{label}完成：{result}')

    def fail_task(self, label: str, detail: str) -> None:
        self.busy = False
        for button in self._buttons:
            button.setEnabled(True)
        self.statusBar().showMessage(f'{label}失败：{detail}')
        self.append_log(f'{label}失败：{detail}')
        QMessageBox.critical(self, label, detail)

    def scan_music(self) -> None:
        source = Path(self.source_dir.text().strip()).expanduser()
        data_dir = Path(self.data_dir.text().strip()).expanduser()
        if not source.is_dir():
            QMessageBox.critical(self, '扫描音乐', '请选择存在的音乐源目录。')
            return

        def operation(progress: Callable[[str], None]) -> list[Track]:
            progress(f'扫描：{source}')
            result = scan_tracks(source)
            if data_dir.is_dir():
                apply_existing_tags(result, data_dir)
            progress(f'发现 {len(result)} 首音频。')
            return result

        self.run_background('扫描音乐', operation, self.refresh_tracks)

    def refresh_tracks(self, tracks: list[Track]) -> None:
        self.tracks = tracks
        self.track_table.setRowCount(len(tracks))
        for row, track in enumerate(tracks):
            values = (
                track.source_relative.as_posix(),
                track.title,
                track.artist,
                track.album,
                self.show_track_tags(track),
                '有' if track.lyrics else '—',
                '有' if track.cover else '—',
            )
            for column, value in enumerate(values):
                self.track_table.setItem(row, column, QTableWidgetItem(value))
        self.statusBar().showMessage(f'已扫描 {len(tracks)} 首；未选中表格项目时，后续操作会处理全部曲目。')

    def load_selected_metadata(self) -> None:
        rows = sorted({index.row() for index in self.track_table.selectionModel().selectedRows()})
        if len(rows) != 1:
            return
        track = self.tracks[rows[0]]
        self.edit_title.setText(track.title)
        self.edit_artist.setText(track.artist)
        self.edit_album.setText(track.album)
        try:
            default_tags = parse_list_ids(self.list_ids.text())
        except ValueError:
            default_tags = ()
        self.set_checked_tags(track.tag_ids or default_tags)

    def apply_metadata(self) -> None:
        rows = sorted({index.row() for index in self.track_table.selectionModel().selectedRows()})
        if len(rows) != 1:
            QMessageBox.information(self, '修改元数据', '请先在表格中选择一首歌曲。')
            return
        title = clean_text(self.edit_title.text())
        if not title:
            QMessageBox.critical(self, '修改元数据', '歌名不能为空。')
            return
        track = self.tracks[rows[0]]
        track.title = title
        track.artist = clean_text(self.edit_artist.text())
        track.album = clean_text(self.edit_album.text())
        self.refresh_tracks(self.tracks)
        self.track_table.selectRow(rows[0])
        self.append_log(f'更新元数据：{track.display_name}')

    def require_tracks_and_config(self) -> tuple[list[Track], LibraryConfig] | None:
        if not self.tracks:
            QMessageBox.information(self, '音乐整理', '请先扫描音乐。')
            return None
        try:
            return self.selected_tracks(), self.config_snapshot()
        except ValueError as error:
            QMessageBox.critical(self, '音乐整理', str(error))
            return None

    def convert_selected(self) -> None:
        payload = self.require_tracks_and_config()
        if not payload:
            return
        tracks, config = payload
        self.run_background('MP3 转码', lambda progress: process_tracks(tracks, config, True, False, progress) or f'{len(tracks)} 首')

    def copy_selected(self) -> None:
        payload = self.require_tracks_and_config()
        if not payload:
            return
        tracks, config = payload
        if not config.sq_repo_dir:
            QMessageBox.critical(self, '复制高音质文件', '请先设置高音质资源仓库目录。')
            return
        self.run_background('复制高音质文件', lambda progress: process_tracks(tracks, config, False, True, progress) or f'{len(tracks)} 首')

    def export_selected(self) -> None:
        payload = self.require_tracks_and_config()
        if not payload:
            return
        tracks, config = payload

        def operation(progress: Callable[[str], None]) -> str:
            hq_count, sq_count = export_database(tracks, config, progress)
            return f'HQ {hq_count} 条，SQ {sq_count} 条'

        self.run_background('导出 JSONL', operation)

    def organise_and_export(self) -> None:
        payload = self.require_tracks_and_config()
        if not payload:
            return
        tracks, config = payload

        def operation(progress: Callable[[str], None]) -> str:
            process_tracks(tracks, config, True, bool(config.sq_repo_dir), progress)
            hq_count, sq_count = export_database(tracks, config, progress)
            return f'处理 {len(tracks)} 首；HQ {hq_count} 条，SQ {sq_count} 条'

        self.run_background('整理并导出', operation)

    def git_repo(self) -> Path:
        raw = self.mp3_repo_dir.text() if self.git_target.currentText() == 'MP3 资源仓库' else self.sq_repo_dir.text()
        if not raw.strip():
            raise ValueError('当前 Git 操作目标未设置目录。')
        return Path(raw.strip()).expanduser()

    def run_git_action(self, label: str, action: Callable[[Path], str]) -> None:
        try:
            repo = self.git_repo()
        except ValueError as error:
            QMessageBox.critical(self, label, str(error))
            return
        self.run_background(label, lambda progress: progress(f'仓库：{repo}') or action(repo))

    def git_status(self) -> None:
        self.run_git_action('Git 状态', lambda repo: run_git(repo, 'status', '--short', '--branch'))

    def git_init(self) -> None:
        try:
            repo = self.git_repo()
        except ValueError as error:
            QMessageBox.critical(self, '初始化仓库', str(error))
            return
        answer = QMessageBox.question(
            self,
            '初始化仓库',
            f'将在下列目录创建 .git：\n{repo}\n\n是否继续？',
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if answer != QMessageBox.StandardButton.Yes:
            return

        def initialise(path: Path) -> str:
            path.mkdir(parents=True, exist_ok=True)
            first = run_git(path, 'init')
            try:
                second = run_git(path, 'branch', '-M', 'main')
            except RuntimeError:
                second = ''
            return '\n'.join(item for item in (first, second) if item)

        self.run_background('初始化 Git 仓库', lambda _progress: initialise(repo))

    def git_set_remote(self) -> None:
        remote = self.git_remote.text().strip()
        if not remote:
            QMessageBox.critical(self, '设置 origin', '请填写远程仓库地址。')
            return

        def action(repo: Path) -> str:
            try:
                return run_git(repo, 'remote', 'set-url', 'origin', remote)
            except RuntimeError:
                return run_git(repo, 'remote', 'add', 'origin', remote)

        self.run_git_action('设置 origin', action)

    def git_commit(self) -> None:
        message = self.git_message.text().strip()
        if not message:
            QMessageBox.critical(self, 'Git 提交', '请填写提交说明。')
            return

        def action(repo: Path) -> str:
            staged = run_git(repo, 'add', '-A')
            commit = run_git(repo, 'commit', '-m', message)
            return f'{staged}\n{commit}'

        self.run_git_action('Git 提交', action)

    def git_push(self) -> None:
        def action(repo: Path) -> str:
            branch = run_git(repo, 'branch', '--show-current').strip() or 'main'
            return run_git(repo, 'push', '-u', 'origin', branch)

        self.run_git_action('Git 推送', action)

    def closeEvent(self, event: object) -> None:  # noqa: N802 - Qt callback name
        save_preferences({
            'source_dir': self.source_dir.text(),
            'mp3_repo_dir': self.mp3_repo_dir.text(),
            'sq_repo_dir': self.sq_repo_dir.text(),
            'data_dir': self.data_dir.text(),
            'mp3_raw_url': self.mp3_raw_url.text(),
            'sq_raw_url': self.sq_raw_url.text(),
            'list_ids': self.list_ids.text(),
            'overwrite': 'true' if self.overwrite.isChecked() else 'false',
            'git_remote': self.git_remote.text(),
        })
        event.accept()  # type: ignore[attr-defined]


def main() -> int:
    if {'-h', '--help'} & set(sys.argv[1:]):
        print('用法：python3 tools/music_library_gui.py\n\n启动 PyQt6 音乐资料整理界面。')
        return 0
    application = QApplication(sys.argv)
    window = MusicLibraryApp()
    window.show()
    return application.exec()


if __name__ == '__main__':
    raise SystemExit(main())
