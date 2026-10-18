#!/usr/bin/env python3
"""Drag-and-drop GUI for tagging and uploading images to the 2d_pic HF dataset.

Start ``npm run dev:local`` first if Pixiv metadata should be matched from the
current account. Filenames containing a Pixiv artwork ID (for example
``91087663_p0.jpg``) are matched automatically; unmatched files start with the
``其他`` tag and blank title/author/description fields.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from PySide6.QtCore import QThread, Signal, Qt
from PySide6.QtGui import QIcon, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QComboBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from upload_pixiv_gallery import (
    DEFAULT_API_BASE,
    DEFAULT_REPO_DIR,
    MANIFEST_NAME,
    MAX_IMAGE_BYTES,
    MAX_TOTAL_BYTES,
    exclusion_reason,
    fetch_json,
    git,
    json_read,
    make_thumbnail,
)

IMAGE_EXTENSIONS = {'.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp'}
PIXIV_ID_RE = re.compile(r'(?<!\d)(\d{6,})(?!\d)')


def parse_tags(value: str) -> list[str]:
    return list(dict.fromkeys(tag.strip() for tag in re.split(r'[,，;；\n]+', value) if tag.strip()))


def pixiv_id_from_path(path: Path) -> str:
    match = PIXIV_ID_RE.search(path.stem)
    return match.group(1) if match else ''


class BookmarkWorker(QThread):
    loaded = Signal(dict)
    failed = Signal(str)

    def __init__(self, api_base: str, parent=None):
        super().__init__(parent)
        self.api_base = api_base.rstrip('/')

    def run(self) -> None:
        cursor = ''
        items: dict[str, dict[str, Any]] = {}
        try:
            for _ in range(8):
                query = {'type': 'bookmarks'}
                if cursor:
                    query['cursor'] = cursor
                payload = fetch_json(f'{self.api_base}/api/pixiv-list?{urlencode(query)}')
                data = payload.get('data') if isinstance(payload.get('data'), dict) else {}
                for item in data.get('illusts', []):
                    if isinstance(item, dict) and item.get('id'):
                        items[str(item['id'])] = item
                cursor = str(data.get('nextCursor') or '')
                if not cursor:
                    break
            self.loaded.emit(items)
        except Exception as error:
            self.failed.emit(str(error))


class UploadWorker(QThread):
    completed = Signal(str)
    failed = Signal(str)
    progress = Signal(str)

    def __init__(self, repo: Path, album: dict[str, Any], rows: list[dict[str, Any]], parent=None):
        super().__init__(parent)
        self.repo = repo
        self.album = album
        self.rows = rows

    def run(self) -> None:
        try:
            if git(self.repo, 'status', '--porcelain'):
                raise RuntimeError('2d_pic 仓库有未提交修改，请先处理后重试。')
            album_id = self.album['id']
            assets = []
            items = []
            total_bytes = 0
            for row_index, row in enumerate(self.rows, start=1):
                source = Path(row['source']).expanduser().resolve()
                if not source.is_file() or source.suffix.lower() not in IMAGE_EXTENSIONS:
                    raise RuntimeError(f'图片文件不可用：{source.name}')
                data = source.read_bytes()
                if len(data) > MAX_IMAGE_BYTES:
                    raise RuntimeError(f'{source.name} 超过单张图片限制 {MAX_IMAGE_BYTES // (1024 * 1024)} MiB。')
                total_bytes += len(data)
                image_path = f'albums/{album_id}/{source.name}'
                thumbnail_path = f'albums/{album_id}/thumbs/{source.stem}.webp'
                thumbnail_bytes = make_thumbnail(data)
                total_bytes += len(thumbnail_bytes)
                if total_bytes > MAX_TOTAL_BYTES:
                    raise RuntimeError(f'图片与缩略图总量超过 {MAX_TOTAL_BYTES // (1024 * 1024)} MiB。')
                pixiv_id = row['pixivId']
                reason = exclusion_reason({
                    'id': pixiv_id,
                    'xRestrict': row.get('xRestrict', 0),
                    'title': row['title'],
                    'description': row['description'],
                    'tags': parse_tags(row['tags']),
                })
                if reason:
                    raise RuntimeError(f'已拦截 {source.name}：{reason}。')
                item_id = pixiv_id or source.stem
                items.append({
                    'id': item_id,
                    'pixivId': pixiv_id,
                    'title': row['title'].strip(),
                    'author': row['author'].strip(),
                    'description': row['description'].strip(),
                    'tags': parse_tags(row['tags']) or ['其他'],
                    'pixivUrl': f'https://www.pixiv.net/artworks/{pixiv_id}' if pixiv_id else '',
                    'image': image_path,
                    'thumbnail': thumbnail_path,
                })
                assets.append((image_path, data))
                assets.append((thumbnail_path, thumbnail_bytes))
                self.progress.emit(f'已读取 {row_index}/{len(self.rows)} 张图片…')

            manifest_path = self.repo / MANIFEST_NAME
            manifest = json_read(manifest_path)
            timestamp = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
            album = {
                'id': album_id,
                'title': self.album['title'].strip(),
                'description': self.album['description'].strip(),
                'tags': parse_tags(self.album['tags']),
                'updatedAt': timestamp,
                'items': items,
            }
            albums = [entry for entry in manifest['albums'] if entry.get('id') != album_id]
            albums.insert(0, album)
            manifest.update({'version': 1, 'updatedAt': timestamp, 'albums': albums})

            for image_path, data in assets:
                destination = self.repo / image_path
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(data)
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            git(self.repo, 'add', '--', *(image_path for image_path, _ in assets), MANIFEST_NAME)
            git(self.repo, 'commit', '-m', f'Gallery: upload {len(assets)} tagged images', capture=False)
            git(self.repo, 'push', 'origin', 'main', capture=False)
            self.completed.emit(f'已推送 {len(assets)} 张图片至 HF 图集仓库（{total_bytes / (1024 * 1024):.1f} MiB）。')
        except Exception as error:
            self.failed.emit(str(error))


class ImageDropTable(QTableWidget):
    filesDropped = Signal(list)

    def __init__(self, parent=None):
        super().__init__(0, 6, parent)
        self.setHorizontalHeaderLabels(['图片文件', 'Pixiv ID', '标题', '作者', '标签（逗号分隔）', '描述'])
        self.setAcceptDrops(True)
        self.setDragDropMode(QTableWidget.DragDropMode.DropOnly)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setAlternatingRowColors(True)
        self.verticalHeader().setVisible(False)
        header = self.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(5, QHeaderView.ResizeMode.Stretch)

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dragMoveEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            event.ignore()

    def dropEvent(self, event):
        paths = [url.toLocalFile() for url in event.mimeData().urls() if url.isLocalFile()]
        self.filesDropped.emit(paths)
        event.acceptProposedAction()


class GalleryUploader(QMainWindow):
    def __init__(self, repo: Path, api_base: str):
        super().__init__()
        self.repo = repo.expanduser().resolve()
        self.api_base = api_base.rstrip('/')
        self.bookmarks: dict[str, dict[str, Any]] = {}
        self.worker: BookmarkWorker | UploadWorker | None = None
        self.setWindowTitle('Pixiv 图集快速上传 · 2d_pic')
        self.resize(1220, 760)
        self.setAcceptDrops(True)

        central = QWidget(self)
        layout = QVBoxLayout(central)
        form = QFormLayout()
        self.album_id = QLineEdit('pixiv-user-upload')
        self.album_title = QLineEdit('插画收藏')
        self.album_description = QLineEdit('')
        self.album_tags = QLineEdit('')
        form.addRow('图集 ID', self.album_id)
        form.addRow('图集名称', self.album_title)
        form.addRow('图集描述', self.album_description)
        form.addRow('图集标签', self.album_tags)
        layout.addLayout(form)

        toolbar = QHBoxLayout()
        self.match_button = QPushButton('同步 Pixiv 收藏信息')
        self.add_button = QPushButton('选择图片…')
        self.remove_button = QPushButton('移除所选')
        self.upload_button = QPushButton('上传到 HF')
        toolbar.addWidget(self.match_button)
        toolbar.addWidget(self.add_button)
        toolbar.addWidget(self.remove_button)
        toolbar.addStretch(1)
        toolbar.addWidget(self.upload_button)
        layout.addLayout(toolbar)

        self.table = ImageDropTable()
        layout.addWidget(self.table, 1)
        self.status = QLabel('将图片拖到列表；文件名中的 Pixiv ID（如 91087663_p0.jpg）会自动匹配收藏信息。无匹配时标签默认“其他”。')
        layout.addWidget(self.status)
        self.setCentralWidget(central)

        self.table.filesDropped.connect(self.add_images)
        self.match_button.clicked.connect(self.load_bookmarks)
        self.add_button.clicked.connect(self.choose_images)
        self.remove_button.clicked.connect(self.remove_selected)
        self.upload_button.clicked.connect(self.upload)
        self.load_bookmarks()

    def load_bookmarks(self):
        if self.worker and self.worker.isRunning():
            return
        self.match_button.setEnabled(False)
        self.status.setText('正在同步当前 Pixiv 收藏信息…')
        self.worker = BookmarkWorker(self.api_base, self)
        self.worker.loaded.connect(self.on_bookmarks_loaded)
        self.worker.failed.connect(self.on_bookmarks_failed)
        self.worker.start()

    def on_bookmarks_loaded(self, bookmarks: dict):
        self.bookmarks = bookmarks
        self.match_button.setEnabled(True)
        self.status.setText(f'已加载 {len(bookmarks)} 条可匹配的收藏信息；可拖入文件或选择图片。')
        for row in range(self.table.rowCount()):
            id_item = self.table.item(row, 1)
            source_item = self.table.item(row, 0)
            if not id_item or not source_item:
                continue
            metadata = self.bookmarks.get(id_item.text())
            if metadata:
                self.apply_metadata(row, metadata)

    def on_bookmarks_failed(self, message: str):
        self.match_button.setEnabled(True)
        self.status.setText(f'Pixiv 信息暂不可用；仍可手动编辑标签和描述。{message}')

    def choose_images(self):
        paths, _ = QFileDialog.getOpenFileNames(
            self,
            '选择插画文件',
            str(Path.home()),
            '图片 (*.jpg *.jpeg *.png *.webp *.gif *.avif)',
        )
        if paths:
            self.add_images(paths)

    def add_images(self, paths: list[str]):
        existing = {
            self.table.item(row, 0).data(Qt.ItemDataRole.UserRole)
            for row in range(self.table.rowCount())
            if self.table.item(row, 0)
        }
        added = 0
        skipped = 0
        for raw_path in paths:
            source = Path(raw_path).expanduser().resolve()
            if not source.is_file() or source.suffix.lower() not in IMAGE_EXTENSIONS or str(source) in existing:
                continue
            pixiv_id = pixiv_id_from_path(source)
            metadata = self.bookmarks.get(pixiv_id, {}) if pixiv_id else {}
            reason = exclusion_reason(metadata) if metadata else ''
            if reason:
                skipped += 1
                continue
            row = self.table.rowCount()
            self.table.insertRow(row)
            file_item = QTableWidgetItem(source.name)
            file_item.setData(Qt.ItemDataRole.UserRole, str(source))
            pixmap = QPixmap(str(source))
            if not pixmap.isNull():
                file_item.setIcon(QIcon(pixmap.scaled(48, 48, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)))
            file_item.setToolTip(str(source))
            id_item = QTableWidgetItem(pixiv_id)
            id_item.setFlags(id_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self.table.setItem(row, 0, file_item)
            self.table.setItem(row, 1, id_item)
            self.table.setItem(row, 2, QTableWidgetItem(''))
            self.table.setItem(row, 3, QTableWidgetItem(''))
            self.table.setItem(row, 4, QTableWidgetItem('其他'))
            self.table.setItem(row, 5, QTableWidgetItem(''))
            if metadata:
                self.apply_metadata(row, metadata)
            existing.add(str(source))
            added += 1
        skipped_note = f'已跳过 {skipped} 张 R-18 或表情包/截图内容。' if skipped else ''
        self.status.setText(f'已加入 {added} 张图片，共 {self.table.rowCount()} 张。{skipped_note}未匹配项的标签默认为“其他”，可在表格中编辑。')

    def apply_metadata(self, row: int, metadata: dict[str, Any]):
        title = self.table.item(row, 2)
        author = self.table.item(row, 3)
        tags = self.table.item(row, 4)
        description = self.table.item(row, 5)
        if title and not title.text().strip(): title.setText(str(metadata.get('title') or ''))
        if author and not author.text().strip(): author.setText(str(metadata.get('author') or ''))
        source_tags = metadata.get('tags') if isinstance(metadata.get('tags'), list) else []
        if tags and (not tags.text().strip() or tags.text().strip() == '其他') and source_tags:
            tags.setText(', '.join(str(tag) for tag in source_tags if str(tag).strip()))
        if description and not description.text().strip():
            description.setText(str(metadata.get('description') or ''))

    def remove_selected(self):
        rows = sorted({index.row() for index in self.table.selectionModel().selectedRows()}, reverse=True)
        for row in rows:
            self.table.removeRow(row)
        self.status.setText(f'当前待上传 {self.table.rowCount()} 张图片。')

    def upload(self):
        if not self.table.rowCount():
            QMessageBox.information(self, '没有图片', '请先拖入或选择图片文件。')
            return
        album_id = re.sub(r'[^a-zA-Z0-9_-]+', '-', self.album_id.text().strip()).strip('-').lower()
        if not album_id:
            QMessageBox.warning(self, '图集 ID 无效', '图集 ID 需要包含英文字母、数字、下划线或连字符。')
            return
        rows = []
        for row in range(self.table.rowCount()):
            file_item = self.table.item(row, 0)
            pixiv_id = self.table.item(row, 1).text().strip()
            entry = {
                'source': file_item.data(Qt.ItemDataRole.UserRole),
                'pixivId': pixiv_id,
                'title': self.table.item(row, 2).text(),
                'author': self.table.item(row, 3).text(),
                'tags': self.table.item(row, 4).text(),
                'description': self.table.item(row, 5).text(),
            }
            reason = exclusion_reason({
                'id': pixiv_id,
                'xRestrict': (self.bookmarks.get(pixiv_id) or {}).get('xRestrict', 0),
                'title': entry['title'],
                'description': entry['description'],
                'tags': parse_tags(entry['tags']),
            })
            if reason:
                QMessageBox.warning(self, '内容不符合上传规则', f'{Path(entry["source"]).name}：{reason}。')
                return
            rows.append(entry)
        album = {
            'id': album_id,
            'title': self.album_title.text().strip() or album_id,
            'description': self.album_description.text().strip(),
            'tags': self.album_tags.text(),
        }
        self.upload_button.setEnabled(False)
        self.status.setText('正在把图片写入 HF 图集仓库并推送…')
        self.worker = UploadWorker(self.repo, album, rows, self)
        self.worker.progress.connect(self.status.setText)
        self.worker.completed.connect(self.upload_completed)
        self.worker.failed.connect(self.upload_failed)
        self.worker.start()

    def upload_completed(self, message: str):
        self.upload_button.setEnabled(True)
        self.status.setText(message)
        QMessageBox.information(self, '上传完成', message)

    def upload_failed(self, message: str):
        self.upload_button.setEnabled(True)
        self.status.setText(f'上传失败：{message}')
        QMessageBox.critical(self, '上传失败', message)


def main() -> int:
    parser = argparse.ArgumentParser(description='拖放图片、按 Pixiv ID 匹配标签并上传到 Hugging Face 2d_pic。')
    parser.add_argument('--repo-dir', type=Path, default=DEFAULT_REPO_DIR)
    parser.add_argument('--api-base', default=DEFAULT_API_BASE)
    args = parser.parse_args()
    app = QApplication(sys.argv)
    app.setApplicationName('Pixiv 图集快速上传')
    window = GalleryUploader(args.repo_dir, args.api_base)
    window.show()
    return app.exec()


if __name__ == '__main__':
    raise SystemExit(main())
