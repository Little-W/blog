import {commit} from '@huggingface/hub';

const REPOSITORY = 'Yusen/2d_pic';
const MANIFEST_PATH = 'gallery.json';
const MANIFEST_URLS = [
  `https://huggingface.co/datasets/${REPOSITORY}/resolve/main/${MANIFEST_PATH}`,
  `https://hf-mirror.com/datasets/${REPOSITORY}/resolve/main/${MANIFEST_PATH}`,
];
const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_TOTAL_BYTES = 24 * 1024 * 1024;
const MAX_FORM_BYTES = MAX_UPLOAD_TOTAL_BYTES + 2 * 1024 * 1024;
const BLOCKED_PIXIV_IDS = new Set(['126432381', '125257566', '123518030', '122306089', '125340293']);
const BLOCKED_TAGS = new Set(['r18', 'r18g', 'r18+', 'r18g+', '18禁', 'nsfw', 'meme', '表情包', '梗图', 'ネタ画像', 'ポンイタチ', 'ポンタイタチ', 'ホシノイタチ']);
const BLOCKED_TERMS = ['原神', 'genshin', 'yuanshen', 'パンツ', '下着', 'pantsu', 'underwear', 'panty', 'panties', '乳首', 'おっぱい', 'オナニー', 'masturbation', 'おもらし', 'おしっこ', '性器', '性交', 'erotic', 'アダルト', 'マイクロビキニ'];

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'},
  });
}

function errorResponse(message, status = 400, code = 'INVALID_GALLERY') {
  return json({success: false, message, code}, status);
}

function writeToken() {
  return process.env.HF_PIC_TOKEN?.trim() || '';
}

function imagePath(value) {
  const path = String(value || '').replace(/\\/g, '/');
  if (!path || path.startsWith('/') || /[\0\r\n?#]/.test(path)) return '';
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return '';
  return /^albums\/[a-z0-9][a-z0-9_-]*\/.+\.(?:avif|gif|jpe?g|png|webp)$/i.test(path) ? path : '';
}

function exclusionReason(item) {
  const id = String(item?.pixivId || item?.id || '');
  if (BLOCKED_PIXIV_IDS.has(id)) return '这张作品已被标记为表情包或不适宜内容。';
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag || '').trim().toLocaleLowerCase()) : [];
  const compactTags = tags.map((tag) => tag.replace(/[\s_-]+/g, ''));
  if (compactTags.some((tag) => BLOCKED_TAGS.has(tag))) return 'R-18、表情包等标签不能加入图集。';
  if (compactTags.some((tag) => BLOCKED_TERMS.some((term) => tag.includes(term)))) return '作品包含原神或明显成人/内衣标签，不能加入图集。';
  const text = `${item?.title || ''} ${item?.description || ''}`.toLocaleLowerCase();
  if (BLOCKED_TERMS.some((term) => text.includes(term))) return '作品文本包含原神或明显成人内容，不能加入图集。';
  return '';
}

async function readManifest() {
  let lastError;
  for (const url of MANIFEST_URLS) {
    try {
      const response = await fetch(url, {headers: {accept: 'application/json'}, signal: AbortSignal.timeout(12_000)});
      if (!response.ok) throw new Error(`图集清单读取失败（${response.status}）。`);
      const value = await response.json();
      if (!value || !Array.isArray(value.albums)) throw new Error('图集清单格式无效。');
      return value;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('图集清单暂时无法读取。');
}

function validateManifest(value) {
  if (!value || !Array.isArray(value.albums) || value.albums.length > 100) throw new Error('图集清单格式无效。');
  const albumIds = new Set();
  const assets = new Set();
  const updatedAt = new Date().toISOString();
  for (const album of value.albums) {
    const id = String(album?.id || '');
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id) || albumIds.has(id)) throw new Error('图集 ID 无效或重复。');
    albumIds.add(id);
    album.title = String(album.title || '').trim().slice(0, 180);
    album.description = String(album.description || '').trim().slice(0, 500);
    album.tags = Array.isArray(album.tags) ? [...new Set(album.tags.map((tag) => String(tag || '').trim()).filter(Boolean))].slice(0, 40) : [];
    album.updatedAt = updatedAt;
    if (!album.title || !Array.isArray(album.items) || album.items.length > 1000) throw new Error(`图集「${id}」缺少标题或作品列表无效。`);
    const itemIds = new Set();
    for (const item of album.items) {
      const itemId = String(item?.id || '');
      if (!itemId || itemIds.has(itemId)) throw new Error(`图集「${album.title}」中存在空白或重复作品 ID。`);
      itemIds.add(itemId);
      item.title = String(item.title || '无题').trim().slice(0, 180);
      item.author = String(item.author || '').trim().slice(0, 120);
      item.description = String(item.description || '').trim().slice(0, 500);
      item.tags = Array.isArray(item.tags) ? [...new Set(item.tags.map((tag) => String(tag || '').trim()).filter(Boolean))].slice(0, 40) : [];
      item.pixivId = String(item.pixivId || '').replace(/[^0-9]/g, '').slice(0, 20);
      item.pixivUrl = item.pixivId ? `https://www.pixiv.net/artworks/${item.pixivId}` : '';
      const blocked = exclusionReason(item);
      if (blocked) throw new Error(`${item.title}：${blocked}`);
      for (const key of ['image', 'thumbnail']) {
        const path = imagePath(item[key]);
        if (!path || !path.startsWith(`albums/${id}/`)) throw new Error(`${item.title} 的图片路径无效。`);
        item[key] = path;
        if (assets.has(path)) throw new Error('图片路径重复。');
        assets.add(path);
      }
    }
  }
  return {version: 1, updatedAt, albums: value.albums};
}

function currentAssets(manifest) {
  const assets = new Set();
  for (const album of manifest?.albums || []) {
    for (const item of album.items || []) {
      for (const key of ['image', 'thumbnail']) {
        const path = imagePath(item?.[key]);
        if (path) assets.add(path);
      }
    }
  }
  return assets;
}

function extensionFor(file) {
  const extension = String(file.name || '').split('.').pop()?.toLocaleLowerCase() || '';
  if (!['avif', 'gif', 'jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new Error(`不支持的图片格式：${file.name}`);
  return extension === 'jpeg' ? 'jpg' : extension;
}

function parseAssetId(name) {
  const id = String(name || '').split('.', 1)[0];
  if (!/^[a-z0-9][a-z0-9_-]{2,79}$/i.test(id)) throw new Error('图片文件的临时 ID 无效。');
  return id;
}

async function saveManifest(request) {
  const token = writeToken();
  if (!token) return errorResponse('管理台编辑图集需要配置 Hugging Face 写入密钥 HF_PIC_TOKEN。', 503, 'MISSING_HF_PIC_TOKEN');
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_FORM_BYTES) return errorResponse('单次请求不能超过 26 MiB。', 413, 'GALLERY_UPLOAD_TOO_LARGE');
  const form = await request.formData();
  let submitted;
  try {
    submitted = JSON.parse(String(form.get('manifest') || ''));
  } catch {
    return errorResponse('图集清单 JSON 无法解析。');
  }
  const oldManifest = await readManifest();
  const oldAssets = currentAssets(oldManifest);
  const originalFiles = form.getAll('originals').filter((entry) => typeof entry !== 'string');
  const thumbnailFiles = form.getAll('thumbnails').filter((entry) => typeof entry !== 'string');
  const originals = new Map(originalFiles.map((file) => [parseAssetId(file.name), file]));
  const thumbnails = new Map(thumbnailFiles.map((file) => [parseAssetId(file.name), file]));
  let totalBytes = 0;
  const operations = [];
  const touched = new Set();

  for (const album of submitted?.albums || []) {
    for (const item of album.items || []) {
      const pending = /^pending:([a-z0-9][a-z0-9_-]{2,79})$/i.exec(String(item.image || ''));
      if (!pending) continue;
      const assetId = pending[1];
      const original = originals.get(assetId);
      const thumbnail = thumbnails.get(assetId);
      if (!original || !thumbnail || touched.has(assetId)) throw new Error(`作品「${item.title || assetId}」缺少原图或缩略图文件。`);
      touched.add(assetId);
      const extension = extensionFor(original);
      for (const file of [original, thumbnail]) {
        if (file.size < 1 || file.size > MAX_UPLOAD_FILE_BYTES) throw new Error(`${file.name} 超过单文件 20 MiB 限制。`);
        totalBytes += file.size;
      }
      if (totalBytes > MAX_UPLOAD_TOTAL_BYTES) throw new Error('单次图片上传总量不能超过 24 MiB。');
      item.image = `albums/${album.id}/${assetId}_p0.${extension}`;
      item.thumbnail = `albums/${album.id}/thumbs/${assetId}_p0.webp`;
      operations.push({operation: 'addOrUpdate', path: item.image, content: original});
      operations.push({operation: 'addOrUpdate', path: item.thumbnail, content: thumbnail});
    }
  }
  if (touched.size !== originals.size || touched.size !== thumbnails.size) throw new Error('上传文件与待添加作品不匹配，请重新选择图片。');

  const nextManifest = validateManifest(submitted);
  const nextAssets = currentAssets(nextManifest);
  for (const path of oldAssets) {
    if (!nextAssets.has(path)) operations.push({operation: 'delete', path});
  }
  operations.push({
    operation: 'addOrUpdate',
    path: MANIFEST_PATH,
    content: new Blob([`${JSON.stringify(nextManifest, null, 2)}\n`], {type: 'application/json'}),
  });
  const result = await commit({
    repo: {type: 'dataset', name: REPOSITORY},
    accessToken: token,
    title: 'Gallery: edit curated illustrations',
    operations,
  });
  return json({success: true, data: {revision: result?.commit?.oid || '', count: nextManifest.albums.reduce((count, album) => count + album.items.length, 0)}});
}

export async function handleGalleryConsole(request) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/console/gallery') return errorResponse('接口不存在。', 404, 'NOT_FOUND');
  if (!['GET', 'POST'].includes(request.method)) return errorResponse('不支持的请求方法。', 405, 'METHOD_NOT_ALLOWED');
  try {
    if (request.method === 'POST') return await saveManifest(request);
    const manifest = await readManifest();
    return json({success: true, data: manifest});
  } catch (error) {
    const status = Number(error?.status || error?.statusCode) || (['HubApiError', 'TypeError', 'AbortError'].includes(error?.name) ? 502 : 400);
    return errorResponse(status >= 500 ? String(error?.message || '图集管理请求暂时失败。') : String(error?.message || '图集管理请求失败。'), status, error?.code || 'GALLERY_CONSOLE_FAILED');
  }
}
