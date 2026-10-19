import {getPixivAccessToken, pixivApi} from './pixiv-client.mjs';

const REPOSITORY = 'Yusen/2d_pic';
const MANIFEST_PATH = 'gallery.json';
// 图集数据只以 Hugging Face 数据集为唯一数据源，避免与 GitHub 副本互相覆盖。
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

// 图集清单是「读取—修改—提交」流程，必须串行提交以避免并发写入互相覆盖。
let manifestWriteLock = Promise.resolve();

function withManifestLock(task) {
  const result = manifestWriteLock.then(task, task);
  manifestWriteLock = result.then(() => {}, () => {});
  return result;
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
      const response = await fetch(url, {headers: {accept: 'application/json', 'cache-control': 'no-cache'}, signal: AbortSignal.timeout(12_000)});
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

async function listHfAssetPaths(token) {
  const {listFiles} = await import('@huggingface/hub');
  const existing = new Set();
  for await (const entry of listFiles({
    repo: {type: 'dataset', name: REPOSITORY},
    path: 'albums',
    recursive: true,
    accessToken: token,
  })) {
    if (entry?.type === 'file' && entry.path) existing.add(entry.path);
  }
  return existing;
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
      item.manual = item.manual === true;
      if (!item.manual) {
        const blocked = exclusionReason(item);
        if (blocked) throw new Error(`${item.title}：${blocked}`);
      }
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

function saveManifest(request) {
  return withManifestLock(() => saveManifestUnlocked(request));
}

async function saveManifestUnlocked(request) {
  const token = writeToken();
  if (!token) return errorResponse('管理台编辑图集需要配置 Hugging Face 写入密钥 HF_PIC_TOKEN。', 503, 'MISSING_HF_PIC_TOKEN');
  const {commit} = await import('@huggingface/hub');
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
  const assetOperations = [];
  const deleteOperations = [];
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
      item.thumbnail = `albums/${album.id}/thumbs/${assetId}_p0.${extensionFor(thumbnail)}`;
      assetOperations.push({operation: 'addOrUpdate', path: item.image, content: original});
      assetOperations.push({operation: 'addOrUpdate', path: item.thumbnail, content: thumbnail});
    }
  }
  if (touched.size !== originals.size || touched.size !== thumbnails.size) throw new Error('上传文件与待添加作品不匹配，请重新选择图片。');

  const nextManifest = validateManifest(submitted);
  const nextAssets = currentAssets(nextManifest);
  // 以 HF 数据集的实际文件为唯一依据计算删除，避免已删除的文件再次出现在删除操作里。
  let existingAssets = null;
  try {
    existingAssets = await listHfAssetPaths(token);
  } catch {
    existingAssets = null;
  }
  for (const path of oldAssets) {
    if (nextAssets.has(path)) continue;
    if (existingAssets && !existingAssets.has(path)) continue;
    deleteOperations.push({operation: 'delete', path});
  }
  const manifestText = `${JSON.stringify(nextManifest, null, 2)}\n`;
  const manifestOperation = {
    operation: 'addOrUpdate',
    path: MANIFEST_PATH,
    content: new Blob([manifestText], {type: 'application/json'}),
  };
  const repo = {type: 'dataset', name: REPOSITORY};
  if (assetOperations.length) {
    await commit({repo, accessToken: token, title: 'Gallery: upload image assets', operations: assetOperations});
  }
  const finalOperations = [...deleteOperations, manifestOperation];
  let result;
  try {
    result = await commit({repo, accessToken: token, title: 'Gallery: edit curated illustrations', operations: finalOperations});
  } catch (error) {
    // 若仍有文件已被删除，忽略失效的删除操作后重试，保证清单能正常更新。
    if (deleteOperations.length && /does not exist|not\s*found|404/i.test(String(error?.message || ''))) {
      result = await commit({repo, accessToken: token, title: 'Gallery: edit curated illustrations', operations: [manifestOperation]});
    } else {
      throw error;
    }
  }
  return json({success: true, data: {
    revision: result?.commit?.oid || '',
    count: nextManifest.albums.reduce((count, album) => count + album.items.length, 0),
  }});
}

const PIXIV_IMAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
  Referer: 'https://www.pixiv.net/',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

function imageExtensionFromType(contentType, url) {
  const type = String(contentType || '').toLocaleLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('gif')) return 'gif';
  if (type.includes('webp')) return 'webp';
  if (type.includes('avif')) return 'avif';
  const fromUrl = /\.(jpe?g|png|gif|webp|avif)(?:$|\?)/i.exec(String(url || ''))?.[1]?.toLocaleLowerCase();
  return fromUrl ? (fromUrl === 'jpeg' ? 'jpg' : fromUrl) : 'jpg';
}

function imageMirrorCandidates(url) {
  const candidates = [url];
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'i.pximg.net') {
      for (const host of ['i.pixiv.re', 'i.pixiv.nl']) {
        const clone = new URL(url);
        clone.hostname = host;
        candidates.push(clone.toString());
      }
    }
  } catch {
    // Keep the original URL when it cannot be parsed.
  }
  return candidates;
}

async function downloadPixivImage(url) {
  let lastError;
  for (const candidate of imageMirrorCandidates(url)) {
    try {
      const response = await fetch(candidate, {headers: PIXIV_IMAGE_HEADERS, signal: AbortSignal.timeout(30_000)});
      if (!response.ok) throw new Error(`图片下载失败（${response.status}）。`);
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength) throw new Error('图片内容为空。');
      return {bytes, extension: imageExtensionFromType(response.headers.get('content-type'), candidate)};
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('图片下载失败。');
}

export async function importPixivArtwork(request) {
  const token = writeToken();
  if (!token) return errorResponse('导入 Pixiv 作品需要配置 Hugging Face 写入密钥 HF_PIC_TOKEN。', 503, 'MISSING_HF_PIC_TOKEN');
  if (!process.env.PIXIV_REFRESH_TOKEN) return errorResponse('导入 Pixiv 作品需要配置 PIXIV_REFRESH_TOKEN。', 503, 'MISSING_PIXIV_CREDENTIALS');

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse('请求内容无法解析。');
  }
  const pixivId = String(payload?.pixivId ?? payload?.id ?? '').replace(/[^0-9]/g, '');
  if (!/^\d{1,20}$/.test(pixivId)) return errorResponse('作品 ID 无效。');
  const requestedAlbum = String(payload?.albumId || '').trim();

  const accessToken = await getPixivAccessToken();
  const detail = await pixivApi(`/v1/illust/detail?illust_id=${encodeURIComponent(pixivId)}`, accessToken);
  const illust = detail?.illust;
  if (!illust) return errorResponse('未读取到 Pixiv 作品详情。', 502, 'PIXIV_DETAIL_EMPTY');

  const caption = String(illust.caption || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').trim().slice(0, 500);
  const item = {
    id: pixivId,
    pixivId,
    title: String(illust.title || '无题').trim().slice(0, 180),
    author: String(illust.user?.name || '').trim().slice(0, 120),
    description: caption,
    tags: (illust.tags || []).map((tag) => String(tag?.name || '').trim()).filter(Boolean).slice(0, 40),
    pixivUrl: `https://www.pixiv.net/artworks/${pixivId}`,
    manual: true,
    image: '',
    thumbnail: '',
  };

  const originalUrl = illust.meta_pages?.[0]?.image_urls?.original
    || illust.meta_single_page?.original_image_url
    || illust.image_urls?.large
    || illust.image_urls?.medium
    || '';
  const thumbnailUrl = illust.image_urls?.large || illust.image_urls?.medium || originalUrl;
  if (!originalUrl) return errorResponse('该作品没有可下载的图片。', 502, 'PIXIV_IMAGE_MISSING');

  let original = await downloadPixivImage(originalUrl);
  const thumbnail = await downloadPixivImage(thumbnailUrl);
  if (original.bytes.byteLength > MAX_UPLOAD_FILE_BYTES || original.bytes.byteLength + thumbnail.bytes.byteLength > MAX_UPLOAD_TOTAL_BYTES) {
    // 原图过大时退回 Pixiv 缩放版本，保证能通过图集上传限制。
    original = await downloadPixivImage(thumbnailUrl);
  }
  if (original.bytes.byteLength > MAX_UPLOAD_FILE_BYTES) return errorResponse('原图超过 20 MiB，无法导入。', 413, 'GALLERY_IMAGE_TOO_LARGE');

  const assetId = `px${pixivId}`;

  return withManifestLock(async () => {
    const manifest = await readManifest();
    const album = requestedAlbum ? manifest.albums.find((entry) => entry.id === requestedAlbum) : manifest.albums[0];
    if (!album) return errorResponse(requestedAlbum ? '目标图集不存在。' : '图集清单为空，无法导入作品。', 404, 'GALLERY_ALBUM_NOT_FOUND');
    const duplicated = manifest.albums.find((entry) => (entry.items || []).some((candidate) => String(candidate.pixivId || candidate.id) === pixivId));
    if (duplicated) {
      const message = duplicated.id === album.id
        ? `这张作品已经在图集「${duplicated.title}」中了。`
        : `这张作品已存在于图集「${duplicated.title}」中，不会重复保存。`;
      return errorResponse(message, 409, 'GALLERY_ITEM_EXISTS');
    }
    if ((album.items || []).length >= 1000) return errorResponse('该图集作品数量已达上限（1000 张）。', 400, 'GALLERY_ALBUM_FULL');

    const submitted = {
      version: manifest.version || 1,
      updatedAt: manifest.updatedAt || null,
      albums: manifest.albums.map((entry) => entry.id === album.id
        ? {...entry, items: [...(entry.items || []), {...item, image: `pending:${assetId}`, thumbnail: `pending:${assetId}`}]}
        : entry),
    };

    const form = new FormData();
    form.append('manifest', JSON.stringify(submitted));
    form.append('originals', new Blob([original.bytes], {type: 'image/*'}), `${assetId}.${original.extension}`);
    form.append('thumbnails', new Blob([thumbnail.bytes], {type: 'image/*'}), `${assetId}.${thumbnail.extension}`);

    const result = await saveManifestUnlocked(
      new Request('https://gallery.internal/api/console/gallery', {method: 'POST', body: form}),
    );
    if (!result.ok) return result;
    const body = await result.json();
    body.data = {...(body.data || {}), albumId: album.id, albumTitle: album.title, item: {id: item.id, pixivId, title: item.title}};
    return json(body);
  });
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
