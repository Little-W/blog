#!/usr/bin/env python3
"""Import Pixiv bookmarks into the Hugging Face 2d_pic image-gallery dataset.

The Pixiv token remains on the local site backend. This tool asks the local
console API for the current account's bookmarks and original image metadata,
downloads the selected originals, writes ``gallery.json`` plus image files to
the configured HF Git repository, and optionally commits/pushes the batch.

Dry-run is the default. Start ``npm run dev:local`` first, then use
``python tools/upload_pixiv_gallery.py --apply --push`` to upload.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
import mimetypes
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from PIL import Image, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPO_DIR = Path('/media/6/旧项目/网站/2d_pic')
DEFAULT_API_BASE = 'http://localhost:8888'
MANIFEST_NAME = 'gallery.json'
ALBUM_ID = 'pixiv-latest-50'
ALBUM_TITLE = '精选插画'
MAX_IMAGE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
BLOCKED_PIXIV_IDS = {
    '126432381',  # User-identified bot announcement/meme image.
    '125257566', '123518030', '122306089',  # Additional meme examples identified from the gallery.
    '125340293',  # User-identified illustration that is too close to R-18.
}
R18_TAGS = {'r18', 'r18g', 'r18+', 'r18g+', '18禁', 'nsfw'}
MEME_TAGS = {'meme', '表情包', '梗图', 'ネタ画像', 'ポンイタチ', 'ポンタイタチ', 'ホシノイタチ'}
GENSHIN_TERMS = ('原神', 'genshin', 'yuanshen')
SUGGESTIVE_TAG_TERMS = ('パンツ', '下着', 'pantsu', 'underwear', 'panty', 'panties', '乳首', 'おっぱい', 'オナニー', 'masturbation', 'おもらし', 'おしっこ', '性器', '性交', 'erotic', 'アダルト', 'マイクロビキニ')
GENERIC_DIVERSITY_TAGS = {
    '女の子', '女孩子', '少女', '美少女', 'イラスト', '插画', 'illustration', 'art',
    'original', 'オリジナル', '創作', 'ai', 'aiイラスト', 'ai绘画', 'ai绘画', 'pixiv',
    '壁紙', '壁纸', '同人', '二次創作', 'commission', 'skeb', '制服', 'かわいい',
}
DIVERSITY_TOPICS = {
    'vocaloid': ('vocaloid', '初音ミク', '初音未来', 'miku', '可不', 'cevio'),
    'gakumas': ('学園アイドルマスター', '学マス'),
    'blue-archive': ('bluearchive', 'ブルーアーカイブ', 'ブルアカ'),
    'touhou': ('東方project', '東方'),
    'uma-musume': ('ウマ娘',),
    'cinderella-girls': ('アイドルマスターシンデレラガールズ', '久川颯', 'スターライトステージ'),
    'k-on': ('けいおん', 'k-on'),
    'liz-and-blue-bird': ('リズと青い鳥', '響け!ユーフォニアム'),
    'vtuber': ('バーチャルyoutuber', 'vtuber'),
    'frieren': ('葬送のフリーレン', 'frieren', 'フリーレン'),
    'atri': ('atri', 'アトリ'),
    'violet-evergarden': ('ヴァイオレット・エヴァーガーデン', 'violet evergarden'),
    'yuzu-soft': ('ゆずソフト', '千恋*万花', 'riddle_joker'),
    'fantasy': ('ファンタジー', '幻想', '魔法'),
}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='从当前 Pixiv 收藏夹导入原图并上传到 Hugging Face 2d_pic 仓库。')
    parser.add_argument('--api-base', default=DEFAULT_API_BASE, help='本地站点 API 地址；默认 http://localhost:8888。')
    parser.add_argument('--repo-dir', type=Path, default=DEFAULT_REPO_DIR, help='2d_pic 本地 Git 仓库目录。')
    parser.add_argument('--count', type=int, default=10, help='导入图片数量，默认 10。')
    parser.add_argument('--repair-id', action='append', default=[], help='重新下载并替换图集中已有作品的原图，可重复指定 Pixiv ID。')
    parser.add_argument('--exclude-id', action='append', default=[], help='本次导入明确排除的 Pixiv ID，可重复指定。')
    parser.add_argument('--album-id', default=ALBUM_ID, help='清单中的稳定图集 ID。')
    parser.add_argument('--title', default=ALBUM_TITLE, help='图集标题。')
    parser.add_argument('--description', default='插画收藏。', help='图集说明。')
    parser.add_argument('--tag', action='append', default=[], help='附加图集标签，可重复。')
    parser.add_argument('--metadata-only', action='store_true', help='只更新已有图集的元数据，不从 Pixiv 导入图片。')
    parser.add_argument('--list-only', action='store_true', help='只列出题材分散筛选后的候选作品，不下载图片。')
    parser.add_argument('--clear-tags', action='store_true', help='配合 --metadata-only 清除图集级标签。')
    parser.add_argument('--generate-thumbnails', action='store_true', help='为图集原图生成快速加载用 WebP 缩略图。')
    parser.add_argument('--merge-album', action='append', default=[], help='把已有图集并入 --album-id，可重复指定。')
    parser.add_argument('--prune-merged-files', action='store_true', help='合并后删除未再被清单引用的来源图集图片。')
    parser.add_argument('--clean-content', action='store_true', help='从现有图集移除 R-18/NSFW 与表情包、截图类作品。')
    parser.add_argument('--apply', action='store_true', help='下载并写入图片和 gallery.json；默认只运行 dry-run。')
    parser.add_argument('--push', action='store_true', help='写入后提交并推送 HF 仓库（需要同时指定 --apply）。')
    parser.add_argument('--message', default='', help='自定义 Git 提交说明。')
    args = parser.parse_args()
    if args.count < 1 or args.count > 100:
        parser.error('--count 必须在 1 到 100 之间。')
    if args.push and not args.apply:
        parser.error('--push 需要同时指定 --apply。')
    if not args.album_id or any(character not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for character in args.album_id):
        parser.error('--album-id 只能包含字母、数字、下划线和连字符。')
    return args


def fetch_json(url: str) -> dict[str, Any]:
    request = Request(url, headers={'accept': 'application/json', 'user-agent': 'YusenGalleryUploader/1.0'})
    retry_delays = (0.7, 1.5, 3.0)
    for attempt in range(len(retry_delays) + 1):
        try:
            with urlopen(request, timeout=35) as response:
                payload = json.loads(response.read().decode('utf-8'))
            if not isinstance(payload, dict) or payload.get('success') is not True:
                raise RuntimeError(str(payload.get('message') if isinstance(payload, dict) else 'API 返回无效数据。'))
            return payload
        except HTTPError as error:
            try:
                payload = json.loads(error.read().decode('utf-8'))
                message = str(payload.get('message') or f'API 返回 HTTP {error.code}')
            except (UnicodeDecodeError, json.JSONDecodeError):
                message = f'API 返回 HTTP {error.code}'
            retryable = error.code in {429, 500, 502, 503, 504} and '未配置 PIXIV_REFRESH_TOKEN' not in message
            if not retryable or attempt >= len(retry_delays):
                raise RuntimeError(message) from error
        except (URLError, TimeoutError) as error:
            if attempt >= len(retry_delays):
                raise RuntimeError(f'连接 Pixiv API 失败：{error}') from error
        time.sleep(retry_delays[attempt])
    raise RuntimeError('Pixiv API 多次重试后仍无法读取。')


def pixiv_bookmarks(api_base: str, count: int) -> list[dict[str, Any]]:
    cursor = ''
    seen: set[int] = set()
    results: list[dict[str, Any]] = []
    while len(results) < count:
        query = {'type': 'bookmarks'}
        if cursor:
            query['cursor'] = cursor
        payload = fetch_json(f'{api_base.rstrip("/")}/api/pixiv-list?{urlencode(query)}')
        page = payload.get('data') if isinstance(payload.get('data'), dict) else {}
        for item in page.get('illusts', []):
            if not isinstance(item, dict):
                continue
            pixiv_id = int(item.get('id') or 0)
            if pixiv_id <= 0 or pixiv_id in seen:
                continue
            seen.add(pixiv_id)
            results.append(item)
            if len(results) >= count:
                break
        cursor = str(page.get('nextCursor') or '')
        if not cursor:
            break
    if not results:
        raise RuntimeError('当前 Pixiv 收藏夹没有可导入的作品。')
    return results


def image_suffix(url: str, content_type: str) -> str:
    suffix = Path(urlsplit(url).path).suffix.lower()
    if suffix in {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}:
        return '.jpg' if suffix == '.jpeg' else suffix
    guessed = mimetypes.guess_extension(content_type.split(';', 1)[0].strip()) if content_type else None
    if guessed in {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}:
        return '.jpg' if guessed == '.jpeg' else guessed
    return '.jpg'


def make_thumbnail(data: bytes, size: int = 768) -> bytes:
    with Image.open(BytesIO(data)) as opened:
        image = ImageOps.exif_transpose(opened)
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        image.save(buffer, format='WEBP', quality=82, method=5)
        return buffer.getvalue()


def validate_image_bytes(data: bytes) -> None:
    try:
        with Image.open(BytesIO(data)) as image:
            image.verify()
        with Image.open(BytesIO(data)) as image:
            image.load()
    except Exception as error:
        raise RuntimeError('图片文件不完整或无法解码，已跳过，未写入图集。') from error


def image_urls(source: str) -> list[str]:
    parsed = urlsplit(source)
    if parsed.scheme != 'https' or parsed.hostname not in {'i.pixiv.re', 'i.pixiv.nl', 'i.pximg.net'}:
        raise RuntimeError('Pixiv 返回了不受支持的原图地址。')
    hosts = [parsed.hostname]
    hosts.extend(host for host in ('i.pixiv.re', 'i.pixiv.nl') if host not in hosts)
    return [urlunsplit((parsed.scheme, host, parsed.path, parsed.query, '')) for host in hosts]


def download_image(source: str, api_base: str = DEFAULT_API_BASE) -> tuple[bytes, str]:
    last_error: Exception | None = None
    candidates = image_urls(source)
    proxy_base = f'{api_base.rstrip("/")}/api/pixiv-thumb'
    for candidate in candidates[:1]:
        try:
            filename = Path(urlsplit(candidate).path).name or 'pixiv-artwork.jpg'
            proxy_url = f'{proxy_base}?{urlencode({"u": candidate, "download": filename})}'
            request = Request(proxy_url, headers={'accept': 'image/*', 'user-agent': 'YusenGalleryUploader/1.0'})
            with urlopen(request, timeout=22) as response:
                data = response.read(MAX_IMAGE_BYTES + 1)
                if len(data) > MAX_IMAGE_BYTES:
                    raise RuntimeError(f'原图超过 {MAX_IMAGE_BYTES // (1024 * 1024)} MiB 限制。')
                content_type = response.headers.get('content-type') or 'image/jpeg'
                if not content_type.startswith('image/'):
                    raise RuntimeError(f'原图响应类型无效：{content_type}')
                validate_image_bytes(data)
                return data, image_suffix(candidate, content_type)
        except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
            last_error = error
    for candidate in candidates:
        try:
            request = Request(candidate, headers={
                'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                'referer': 'https://www.pixiv.net/',
                'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
            })
            with urlopen(request, timeout=15) as response:
                length = int(response.headers.get('content-length') or 0)
                if length > MAX_IMAGE_BYTES:
                    raise RuntimeError(f'原图超过 {MAX_IMAGE_BYTES // (1024 * 1024)} MiB 限制。')
                data = response.read(MAX_IMAGE_BYTES + 1)
                if len(data) > MAX_IMAGE_BYTES:
                    raise RuntimeError(f'原图超过 {MAX_IMAGE_BYTES // (1024 * 1024)} MiB 限制。')
                content_type = response.headers.get('content-type') or 'image/jpeg'
                if not content_type.startswith('image/'):
                    raise RuntimeError(f'原图响应类型无效：{content_type}')
                validate_image_bytes(data)
                return data, image_suffix(candidate, content_type)
        except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
            last_error = error
    raise RuntimeError(f'下载原图失败：{last_error or source}')


def tags_from(illust: dict[str, Any], bookmark: dict[str, Any]) -> list[str]:
    source_tags = illust.get('tags') or bookmark.get('tags') or []
    tags = []
    for item in source_tags:
        value = item.get('name') if isinstance(item, dict) else item
        value = str(value or '').strip()
        if value and value not in tags:
            tags.append(value[:64])
    return tags[:40]


def exclusion_reason(illust: dict[str, Any]) -> str:
    pixiv_id = str(illust.get('id') or '')
    if pixiv_id in BLOCKED_PIXIV_IDS:
        return '用户标记为表情包/通知截图'
    try:
        if int(illust.get('xRestrict') or 0) > 0:
            return 'Pixiv 标记为限制级内容'
    except (TypeError, ValueError):
        pass
    normalized_tags = {re.sub(r'[\s_-]+', '', tag.strip().casefold()) for tag in tags_from(illust, {})}
    if normalized_tags & R18_TAGS:
        return '作品标签标记为 R-18/NSFW'
    if normalized_tags & MEME_TAGS:
        return '作品标签标记为表情包/梗图'
    if any(term in tag for tag in normalized_tags for term in SUGGESTIVE_TAG_TERMS):
        return '作品标签包含明显成人/内衣内容'
    searchable = f"{illust.get('title') or ''} {illust.get('description') or ''}".casefold()
    all_text = f'{searchable} {" ".join(normalized_tags)}'
    if any(term in all_text for term in GENSHIN_TERMS):
        return '原神作品不在本图集收录范围内'
    if any(term in searchable for term in ('qq群 bot新增了绘图功能', '群聊截图', 'bot新增了绘图功能')):
        return '作品内容为群聊/通知截图'
    return ''


def diverse_candidates(candidates: list[dict[str, Any]], existing_items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Greedily favor fresh subjects/tags and avoid overusing the same artist."""
    def topics(item: dict[str, Any]) -> set[str]:
        values = [str(tag).casefold() for tag in tags_from(item, {})]
        values.append(str(item.get('title') or '').casefold())
        return {
            topic
            for topic, terms in DIVERSITY_TOPICS.items()
            if any(term.casefold() in value for term in terms for value in values)
        }

    seen_ids = {
        str(item.get('pixivId') or item.get('id') or '')
        for item in existing_items
        if isinstance(item, dict)
    }
    pool = [item for item in candidates if str(item.get('id') or '') not in seen_ids]
    tag_counts: dict[str, int] = {}
    topic_counts: dict[str, int] = {}
    selected_authors: dict[str, int] = {}
    for item in existing_items:
        if not isinstance(item, dict):
            continue
        author = str(item.get('author') or '')
        if author:
            selected_authors[author] = selected_authors.get(author, 0) + 1
        for topic in topics(item):
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        for tag in item.get('tags') or []:
            normalized = re.sub(r'[\s_-]+', '', str(tag).casefold())
            if normalized and normalized not in GENERIC_DIVERSITY_TAGS:
                tag_counts[normalized] = tag_counts.get(normalized, 0) + 1
    selected: list[dict[str, Any]] = []
    added_topic_counts: dict[str, int] = {}
    while pool and len(selected) < limit:
        scored = []
        for item in pool:
            item_topics = topics(item)
            if any(added_topic_counts.get(topic, 0) >= 2 for topic in item_topics):
                continue
            tags = tags_from(item, {})
            meaningful = {
                re.sub(r'[\s_-]+', '', tag.casefold())
                for tag in tags
                if re.sub(r'[\s_-]+', '', tag.casefold()) not in GENERIC_DIVERSITY_TAGS
                and not re.search(r'\d+users入り$', tag, re.IGNORECASE)
            }
            novelty = sum(1 / (1 + tag_counts.get(tag, 0)) for tag in meaningful)
            novelty /= max(1, len(meaningful) ** 0.5)
            novelty += 1.7 * sum(1 / (1 + topic_counts.get(topic, 0)) for topic in topics(item))
            author = str(item.get('author') or '')
            author_penalty = selected_authors.get(author, 0) * 0.75
            scored.append((novelty - author_penalty, item))
        if not scored:
            for item in pool:
                tags = tags_from(item, {})
                meaningful = {
                    re.sub(r'[\s_-]+', '', tag.casefold())
                    for tag in tags
                    if re.sub(r'[\s_-]+', '', tag.casefold()) not in GENERIC_DIVERSITY_TAGS
                    and not re.search(r'\d+users入り$', tag, re.IGNORECASE)
                }
                novelty = sum(1 / (1 + tag_counts.get(tag, 0)) for tag in meaningful)
                novelty /= max(1, len(meaningful) ** 0.5)
                scored.append((novelty, item))
        _, chosen = max(scored, key=lambda entry: entry[0])
        selected.append(chosen)
        pool.remove(chosen)
        author = str(chosen.get('author') or '')
        selected_authors[author] = selected_authors.get(author, 0) + 1
        for tag in tags_from(chosen, {}):
            normalized = re.sub(r'[\s_-]+', '', tag.casefold())
            if normalized and normalized not in GENERIC_DIVERSITY_TAGS:
                tag_counts[normalized] = tag_counts.get(normalized, 0) + 1
        for topic in topics(chosen):
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
            added_topic_counts[topic] = added_topic_counts.get(topic, 0) + 1
    return selected


def json_read(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {'version': 1, 'updatedAt': None, 'albums': []}
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict) or not isinstance(value.get('albums'), list):
        raise RuntimeError(f'{path} 的格式无效，已停止以免覆盖现有清单。')
    return value


def update_album_metadata(args: argparse.Namespace, repo: Path) -> int:
    existing_changes = git(repo, 'status', '--porcelain', '--untracked-files=all').splitlines()
    resumable_prefix = f'?? albums/{args.album_id}/thumbs/'
    if any(not line.startswith(resumable_prefix) for line in existing_changes):
        raise RuntimeError('2d_pic 工作区有未提交修改，请先处理后重试。')
    manifest_path = repo / MANIFEST_NAME
    manifest = json_read(manifest_path)
    album = next((entry for entry in manifest['albums'] if entry.get('id') == args.album_id), None)
    if album is None:
        raise RuntimeError(f'图集不存在：{args.album_id}')
    merged_albums = []
    merged_items = list(album.get('items') or [])
    removed_items = []
    thumbnail_paths = []
    seen_items = {
        str(item.get('pixivId') or item.get('id') or item.get('image') or '')
        for item in merged_items
        if isinstance(item, dict)
    }
    for source_id in args.merge_album:
        if source_id == args.album_id:
            continue
        source = next((entry for entry in manifest['albums'] if entry.get('id') == source_id), None)
        if source is None:
            raise RuntimeError(f'待合并的图集不存在：{source_id}')
        merged_albums.append(source)
        for item in source.get('items') or []:
            if not isinstance(item, dict):
                continue
            item_key = str(item.get('pixivId') or item.get('id') or item.get('image') or '')
            if item_key and item_key not in seen_items:
                merged_items.append(item)
                seen_items.add(item_key)
    album['items'] = merged_items
    if args.clean_content:
        removed_items = [item for item in merged_items if isinstance(item, dict) and exclusion_reason(item)]
        album['items'] = [item for item in merged_items if not isinstance(item, dict) or not exclusion_reason(item)]
    if args.generate_thumbnails:
        for item in album['items']:
            if not isinstance(item, dict) or item.get('thumbnail'):
                continue
            image_path = str(item.get('image') or '')
            source = repo / image_path
            if not image_path.startswith(f'albums/{args.album_id}/') or not source.is_file():
                raise RuntimeError(f'原图不存在或不在图集目录：{image_path}')
            thumbnail_path = f'albums/{args.album_id}/thumbs/{source.stem}.webp'
            thumbnail = repo / thumbnail_path
            thumbnail_data = make_thumbnail(source.read_bytes())
            if args.apply:
                thumbnail.parent.mkdir(parents=True, exist_ok=True)
                thumbnail.write_bytes(thumbnail_data)
            item['thumbnail'] = thumbnail_path
            thumbnail_paths.append(thumbnail_path)
    if args.title.strip():
        album['title'] = args.title.strip()
    if args.description is not None:
        album['description'] = args.description.strip()
    if args.clear_tags:
        album['tags'] = []
    elif args.tag:
        album['tags'] = list(dict.fromkeys(args.tag))
    timestamp = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    album['updatedAt'] = timestamp
    manifest['updatedAt'] = timestamp
    source_ids = set(args.merge_album)
    manifest['albums'] = [entry for entry in manifest['albums'] if entry.get('id') not in source_ids]
    removed_count = f'，移除不符合内容规则的 {len(removed_items)} 张' if args.clean_content else ''
    print(f'将更新图集「{album["title"]}」，合并后 {len(album.get("items", []))} 张图片{removed_count}。')
    if not args.apply:
        print('Dry-run：未修改清单。使用 --metadata-only --apply --push 执行。')
        return 0
    deleted_paths = []
    if args.prune_merged_files or args.clean_content:
        referenced = {
            str(item.get(key))
            for entry in manifest['albums']
            for item in (entry.get('items') or [])
            if isinstance(item, dict)
            for key in ('image', 'thumbnail')
            if item.get(key)
        }
        removed_entries = list(merged_albums)
        if args.clean_content:
            removed_entries.append({'id': args.album_id, 'items': removed_items})
        for source in removed_entries:
            for item in source.get('items') or []:
                if not isinstance(item, dict):
                    continue
                for key in ('image', 'thumbnail'):
                    asset = str(item.get(key) or '')
                    if asset.startswith(f'albums/{source.get("id")}/') and asset not in referenced and (repo / asset).is_file():
                        deleted_paths.append(asset)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if thumbnail_paths:
        git(repo, 'add', '--', *thumbnail_paths)
    if deleted_paths:
        git(repo, 'rm', '--', *deleted_paths)
    git(repo, 'add', '--', MANIFEST_NAME)
    if args.push:
        git(repo, 'commit', '-m', args.message or f'Gallery: update {args.album_id} metadata', capture=False)
        git(repo, 'push', 'origin', 'main', capture=False)
        print('清单已推送到 HF。')
    else:
        print('清单已写入本地仓库，尚未提交或推送。')
    return 0


def git(repo: Path, *arguments: str, capture: bool = True) -> str:
    result = subprocess.run(
        ['git', '-C', str(repo), *arguments],
        check=False,
        capture_output=capture,
        text=True,
    )
    if result.returncode:
        details = (result.stderr or result.stdout or 'Git 命令失败。').strip()
        raise RuntimeError(details)
    return result.stdout.strip() if capture else ''


def main() -> int:
    args = arguments()
    repo = args.repo_dir.expanduser().resolve()
    if not (repo / '.git').exists():
        raise RuntimeError(f'找不到 2d_pic Git 仓库：{repo}')
    if args.metadata_only:
        return update_album_metadata(args, repo)
    if args.apply:
        dirty = git(repo, 'status', '--porcelain')
        if dirty:
            raise RuntimeError('2d_pic 工作区不是干净状态；请先处理仓库中的现有修改。')

    repair_ids = list(dict.fromkeys(str(value).strip() for value in args.repair_id if str(value).strip()))
    excluded_ids = {str(value).strip() for value in args.exclude_id if str(value).strip()}
    bookmarks = pixiv_bookmarks(args.api_base, min(120, args.count * 15 + len(repair_ids) * 3))
    album_dir = repo / 'albums' / args.album_id
    candidates = []
    repair_candidates: dict[str, dict[str, Any]] = {}
    existing_album = next((entry for entry in json_read(repo / MANIFEST_NAME)['albums'] if entry.get('id') == args.album_id), None)
    existing_items = list(existing_album.get('items') or []) if existing_album else []
    existing_ids = {
        str(item.get('pixivId') or item.get('id') or '')
        for item in existing_items
        if isinstance(item, dict)
    }
    missing_existing = set(repair_ids) - existing_ids
    if missing_existing:
        raise RuntimeError(f'修复列表包含已不在当前图集的作品 ID（为保留你的删除操作，不会恢复）：{", ".join(sorted(missing_existing))}')
    for bookmark in bookmarks:
        pixiv_id = str(bookmark.get('id') or '')
        if pixiv_id in excluded_ids:
            continue
        reason = exclusion_reason(bookmark)
        if reason:
            if pixiv_id in repair_ids:
                raise RuntimeError(f'作品 {pixiv_id} 现在不符合图集内容规则：{reason}')
            print(f'跳过作品 {bookmark.get("id")}: {reason}。', file=sys.stderr)
            continue
        if pixiv_id in repair_ids:
            if bookmark.get('originalImage'):
                repair_candidates[pixiv_id] = bookmark
            continue
        if bookmark.get('originalImage'):
            if pixiv_id not in existing_ids:
                candidates.append(bookmark)
        else:
            print(f'跳过作品 {bookmark.get("id")}: 收藏作品没有可用的静态原图。', file=sys.stderr)
        if len(candidates) >= min(args.count * 12, 300) and set(repair_ids).issubset(repair_candidates):
            break
    missing_repairs = set(repair_ids) - set(repair_candidates)
    if missing_repairs:
        raise RuntimeError(f'Pixiv 收藏列表无法重新取得这些原图：{", ".join(sorted(missing_repairs))}。未改动图集。')
    candidates = diverse_candidates(candidates, existing_items, min(args.count * 8, 200))
    if len(candidates) < args.count:
        raise RuntimeError(f'收藏列表中只找到 {len(candidates)} 张有原图地址的作品，目标是 {args.count} 张。')
    if args.list_only:
        if repair_ids:
            print('将重新下载并修复：')
            for pixiv_id in repair_ids:
                item = repair_candidates[pixiv_id]
                print(f'{pixiv_id} · {item.get("title") or "无题"}')
        print(f'题材分散筛选出的前 {args.count} 张候选：')
        for index, item in enumerate(candidates[:args.count], start=1):
            tags = '、'.join(tags_from(item, {})[:6])
            print(f'[{index}/{args.count}] {item.get("id")} · {item.get("title") or "无题"} — {tags}')
        return 0

    def prepare_item(bookmark: dict[str, Any]) -> dict[str, Any] | None:
        pixiv_id = int(bookmark['id'])
        source = str(bookmark.get('originalImage') or '')
        try:
            data, suffix = download_image(source, args.api_base)
        except RuntimeError as error:
            print(f'跳过作品 {pixiv_id}：{error}', file=sys.stderr)
            return None
        filename = f'{pixiv_id}_p0{suffix}'
        return {
            'id': str(pixiv_id),
            'pixivId': str(pixiv_id),
            'title': str(bookmark.get('title') or '无题').strip(),
            'author': str(bookmark.get('author') or '未知').strip(),
            'description': str(bookmark.get('description') or '').strip(),
            'tags': tags_from({}, bookmark),
            'pixivUrl': f'https://www.pixiv.net/artworks/{pixiv_id}',
            'image': f'albums/{args.album_id}/{filename}',
            '_bytes': data,
        }

    def prepare_batch(batch: list[dict[str, Any]]) -> list[dict[str, Any]]:
        with ThreadPoolExecutor(max_workers=min(6, len(batch))) as executor:
            return [item for item in executor.map(prepare_item, batch) if item]

    repaired = prepare_batch([repair_candidates[pixiv_id] for pixiv_id in repair_ids]) if repair_ids else []
    if len(repaired) != len(repair_ids):
        raise RuntimeError(f'只成功重新下载 {len(repaired)} / {len(repair_ids)} 张损坏原图；未写入仓库。')

    new_items: list[dict[str, Any]] = []
    for start in range(0, len(candidates), args.count):
        batch = candidates[start:start + args.count]
        new_items.extend(prepare_batch(batch))
        if len(new_items) >= args.count:
            new_items = new_items[:args.count]
            break

    if len(new_items) < args.count:
        raise RuntimeError(f'只找到 {len(new_items)} 张可下载原图，目标是 {args.count} 张；未写入仓库。')
    prepared = repaired + new_items
    total_bytes = sum(len(item['_bytes']) for item in prepared)
    if total_bytes > MAX_TOTAL_BYTES:
        raise RuntimeError(f'导入图片总量超过 {MAX_TOTAL_BYTES // (1024 * 1024)} MiB，未写入仓库。')
    for index, item in enumerate(prepared, start=1):
        action = '修复' if item in repaired else '新增'
        print(f'[{index}/{len(prepared)}] {action} {item["pixivId"]} · {item["title"]} — {len(item["_bytes"]) / (1024 * 1024):.2f} MiB, {len(item["tags"])} tags')
        thumbnail_name = Path(item['image']).stem + '.webp'
        item['thumbnail'] = f'albums/{args.album_id}/thumbs/{thumbnail_name}'
        item['_thumbnail_bytes'] = make_thumbnail(item['_bytes'])
        total_bytes += len(item['_thumbnail_bytes'])
        if total_bytes > MAX_TOTAL_BYTES:
            raise RuntimeError(f'原图与缩略图总量超过 {MAX_TOTAL_BYTES // (1024 * 1024)} MiB，未写入仓库。')

    timestamp = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
    album_tags = list(dict.fromkeys(args.tag))
    manifest_path = repo / MANIFEST_NAME
    manifest = json_read(manifest_path)
    repair_map = {item['pixivId']: item for item in repaired}
    existing_safe_items = [item for item in existing_items if not isinstance(item, dict) or not exclusion_reason(item)]
    merged_items = []
    for existing in existing_safe_items:
        if not isinstance(existing, dict):
            merged_items.append(existing)
            continue
        repair = repair_map.get(str(existing.get('pixivId') or existing.get('id') or ''))
        if repair:
            existing_image = str(existing.get('image') or '')
            existing_thumbnail = str(existing.get('thumbnail') or '')
            if existing_image and Path(existing_image).suffix.lower() == Path(repair['image']).suffix.lower():
                repair['image'] = existing_image
            if existing_thumbnail:
                repair['thumbnail'] = existing_thumbnail
            merged_items.append({**existing, 'image': repair['image'], 'thumbnail': repair['thumbnail']})
        else:
            merged_items.append(existing)
    public_new_items = [{key: value for key, value in item.items() if not key.startswith('_')} for item in new_items]
    merged_items.extend(public_new_items)
    album = {
        'id': args.album_id,
        'title': args.title,
        'description': args.description,
        'tags': album_tags,
        'updatedAt': timestamp,
        'items': merged_items,
    }
    albums = [item for item in manifest['albums'] if item.get('id') != args.album_id]
    albums.insert(0, album)
    manifest.update({'version': 1, 'updatedAt': timestamp, 'albums': albums})

    print(f'准备修复 {len(repaired)} 张并新增 {len(new_items)} 张原图，图集将增至 {len(merged_items)} 张，总计 {total_bytes / (1024 * 1024):.2f} MiB。')
    print(f'目标：{manifest_path} 与 {album_dir}')
    if not args.apply:
        print('Dry-run：未写入文件。使用 --apply --push 执行上传。')
        return 0

    album_dir.mkdir(parents=True, exist_ok=True)
    for item in prepared:
        destination = repo / item['image']
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(item['_bytes'])
        thumbnail = repo / item['thumbnail']
        thumbnail.parent.mkdir(parents=True, exist_ok=True)
        thumbnail.write_bytes(item['_thumbnail_bytes'])
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    current_assets = {
        str(item.get(key))
        for album_entry in albums
        for existing in (album_entry.get('items') or [])
        if isinstance(existing, dict)
        for key in ('image', 'thumbnail')
        if existing.get(key)
    }
    obsolete_assets = {
        str(item.get(key))
        for old_item in existing_items
        if isinstance(old_item, dict)
        for key in ('image', 'thumbnail')
        if old_item.get(key) and str(old_item.get(key)) not in current_assets and (repo / str(old_item.get(key))).is_file()
    }
    if obsolete_assets:
        git(repo, 'rm', '--', *sorted(obsolete_assets))
    git(repo, 'add', '--', f'albums/{args.album_id}', MANIFEST_NAME)
    if args.push:
        message = args.message or f'Gallery: import {len(prepared)} Pixiv favorites'
        git(repo, 'commit', '-m', message, capture=False)
        git(repo, 'push', 'origin', 'main', capture=False)
        print(f'已提交并推送到 HF 数据集：{len(prepared)} 张原图。')
    else:
        print('文件已写入本地仓库，尚未提交或推送。')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (HTTPError, URLError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(f'上传失败：{error}', file=sys.stderr)
        raise SystemExit(1)
