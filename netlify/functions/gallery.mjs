const REPOSITORY = 'Yusen/2d_pic';
const IMAGE_HOSTS = ['huggingface.co', 'hf-mirror.com'];
const MAX_THUMBNAIL_BYTES = 4 * 1024 * 1024;
const MAX_BUFFERED_IMAGE_BYTES = 18 * 1024 * 1024;
const MANIFEST_URLS = [
  `https://huggingface.co/datasets/${REPOSITORY}/resolve/main/gallery.json`,
  `https://hf-mirror.com/datasets/${REPOSITORY}/resolve/main/gallery.json`,
];
const IMAGE_MIRROR_TTL_MS = 30 * 60 * 1000;
const BLOCKED_PIXIV_IDS = new Set(['126432381', '125257566', '123518030', '122306089', '125340293']);
const R18_TAGS = new Set(['r18', 'r18g', 'r18+', 'r18g+', '18禁', 'nsfw']);
const MEME_TAGS = new Set(['meme', '表情包', '梗图', 'ネタ画像', 'ポンイタチ', 'ポンタイタチ', 'ホシノイタチ']);
const GENSHIN_TERMS = ['原神', 'genshin', 'yuanshen'];
const SUGGESTIVE_TAG_TERMS = ['パンツ', '下着', 'pantsu', 'underwear', 'panty', 'panties', '乳首', 'おっぱい', 'オナニー', 'masturbation', 'おもらし', 'おしっこ', '性器', '性交', 'erotic', 'アダルト', 'マイクロビキニ'];
let fastestImageHost = null;
let fastestImageHostExpiresAt = 0;
let fastestImageProbe = null;

export const config = {
  path: ['/api/gallery', '/api/gallery/*'],
  preferStatic: false,
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30, stale-while-revalidate=120',
      'x-content-type-options': 'nosniff',
    },
  });
}

function safeImagePath(value) {
  const imagePath = String(value || '').replace(/\\/g, '/');
  if (!imagePath || imagePath.startsWith('/') || /[\0\r\n?#]/.test(imagePath)) return null;
  const parts = imagePath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  if (!/^albums\/[a-z0-9][a-z0-9_-]*\/.+\.(?:avif|gif|jpe?g|png|webp)$/i.test(imagePath)) return null;
  return parts.map(encodeURIComponent).join('/');
}

function excludedGalleryItem(item, tags) {
  const pixivId = String(item?.pixivId || item?.id || '');
  if (BLOCKED_PIXIV_IDS.has(pixivId)) return true;
  const normalizedTags = tags.map((tag) => tag.toLocaleLowerCase().replace(/[\s_-]+/g, ''));
  if (normalizedTags.some((tag) => R18_TAGS.has(tag) || MEME_TAGS.has(tag))) return true;
  if (normalizedTags.some((tag) => SUGGESTIVE_TAG_TERMS.some((term) => tag.includes(term)))) return true;
  const searchable = `${item?.title || ''} ${item?.description || ''}`.toLocaleLowerCase();
  const allText = `${searchable} ${normalizedTags.join(' ')}`;
  if (GENSHIN_TERMS.some((term) => allText.includes(term))) return true;
  return searchable.includes('qq群 bot新增了绘图功能') || searchable.includes('群聊截图') || searchable.includes('bot新增了绘图功能');
}

function versionedImageUrl(url, version) {
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version || '1')}`;
}

function normalizeManifest(value) {
  const albums = Array.isArray(value?.albums) ? value.albums : [];
  const updatedAt = typeof value?.updatedAt === 'string' ? value.updatedAt : null;
  const cacheVersion = updatedAt || String(Number(value?.version) || 1);
  return {
    version: Number(value?.version) || 1,
    updatedAt,
    albums: albums.slice(0, 100).flatMap((album) => {
      if (!album || typeof album !== 'object') return [];
      const id = String(album.id || '');
      const title = String(album.title || '').trim().slice(0, 180);
      if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id) || !title) return [];
      const items = (Array.isArray(album.items) ? album.items : []).slice(0, 1000).flatMap((item) => {
        const imagePath = safeImagePath(item?.image);
        if (!imagePath) return [];
        const thumbnailPath = safeImagePath(item?.thumbnail) || imagePath;
        const tags = Array.isArray(item.tags)
          ? item.tags.map((tag) => String(tag || '').trim().slice(0, 64)).filter(Boolean).slice(0, 40)
          : [];
        if (excludedGalleryItem(item, tags)) return [];
        const pixivId = String(item.pixivId || '').replace(/[^0-9]/g, '').slice(0, 20);
        const pixivUrl = pixivId ? `https://www.pixiv.net/artworks/${pixivId}` : '';
        const base = versionedImageUrl(`https://huggingface.co/datasets/${REPOSITORY}/resolve/main/${imagePath}`, cacheVersion);
        const mirror = versionedImageUrl(`https://hf-mirror.com/datasets/${REPOSITORY}/resolve/main/${imagePath}`, cacheVersion);
        const proxy = `/api/gallery/image?path=${encodeURIComponent(String(item.image))}&v=${encodeURIComponent(cacheVersion)}`;
        const thumbnailBase = versionedImageUrl(`https://huggingface.co/datasets/${REPOSITORY}/resolve/main/${thumbnailPath}`, cacheVersion);
        const thumbnailMirror = versionedImageUrl(`https://hf-mirror.com/datasets/${REPOSITORY}/resolve/main/${thumbnailPath}`, cacheVersion);
        const thumbnailProxy = `/api/gallery/image?path=${encodeURIComponent(String(item.thumbnail || item.image))}&v=${encodeURIComponent(cacheVersion)}`;
        return [{
          id: imagePath,
          pixivId,
          title: String(item.title || '无题').trim().slice(0, 180),
          author: String(item.author || '未知').trim().slice(0, 120),
          description: String(item.description || '').trim().slice(0, 500),
          tags,
          pixivUrl,
          image: base,
          fallbackImage: mirror,
          proxyImage: proxy,
          thumbnail: thumbnailBase,
          thumbnailFallback: thumbnailMirror,
          thumbnailProxy,
        }];
      });
      const tags = Array.isArray(album.tags)
        ? album.tags.map((tag) => String(tag || '').trim().slice(0, 64)).filter(Boolean).slice(0, 40)
        : [];
      return [{
        id,
        title,
        description: String(album.description || '').trim().slice(0, 500),
        tags,
        updatedAt: typeof album.updatedAt === 'string' ? album.updatedAt : null,
        items,
      }];
    }),
  };
}

async function getGalleryImage(url) {
  const imagePath = safeImagePath(url.searchParams.get('path'));
  if (!imagePath) return new Response('Invalid image path', {status: 400});
  let lastStatus = 502;
  let bufferOriginal = false;
  const firstHost = await measureImageMirror(imagePath);
  const hosts = [firstHost, ...IMAGE_HOSTS.filter((host) => host !== firstHost)];
  for (const host of hosts) {
    try {
      const response = await fetch(`https://${host}/datasets/${REPOSITORY}/resolve/main/${imagePath}`, {
        headers: {accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'user-agent': 'Yusen-Image-Gallery'},
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok || !response.body) {
        lastStatus = response.status || 502;
        continue;
      }
      const upstreamType = response.headers.get('content-type') || '';
      const contentType = upstreamType.startsWith('image/') ? upstreamType : 'application/octet-stream';
      let imageBody = response.body;
      const headers = {
        'content-type': contentType,
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
        'x-content-type-options': 'nosniff',
      };
      const isThumbnail = imagePath.includes('/thumbs/');
      const declaredLength = Number(response.headers.get('content-length') || 0);
      const bufferLimit = isThumbnail ? MAX_THUMBNAIL_BYTES : MAX_BUFFERED_IMAGE_BYTES;
      if (!isThumbnail && declaredLength > 0 && declaredLength <= MAX_BUFFERED_IMAGE_BYTES) bufferOriginal = true;
      const shouldBuffer = isThumbnail || bufferOriginal;
      if (isThumbnail && declaredLength > MAX_THUMBNAIL_BYTES) {
        lastStatus = 413;
        await response.body.cancel().catch(() => {});
        continue;
      }
      if (shouldBuffer) {
        try {
          imageBody = await response.arrayBuffer();
        } catch {
          lastStatus = 502;
          continue;
        }
        if (!imageBody.byteLength || imageBody.byteLength > bufferLimit || (declaredLength && imageBody.byteLength !== declaredLength)) {
          lastStatus = imageBody.byteLength > bufferLimit ? 413 : 502;
          continue;
        }
        headers['content-length'] = String(imageBody.byteLength);
      }
      return new Response(imageBody, {
        status: 200,
        headers,
      });
    } catch {
      // Try the mirror if the first HF endpoint cannot stream this original.
    }
  }
  return new Response('Image source unavailable', {status: lastStatus >= 400 ? lastStatus : 502});
}

async function probeImageHost(host, imagePath) {
  const imageUrl = `https://${host}/datasets/${REPOSITORY}/resolve/main/${imagePath}`;
  const startedAt = Date.now();
  try {
    let response = await fetch(imageUrl, {
      method: 'HEAD',
      headers: {'user-agent': 'Yusen-Image-Gallery'},
      signal: AbortSignal.timeout(6000),
    });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(imageUrl, {
        headers: {'range': 'bytes=0-0', 'user-agent': 'Yusen-Image-Gallery'},
        signal: AbortSignal.timeout(6000),
      });
      await response.body?.cancel().catch(() => {});
    }
    return response.ok || response.status === 206
      ? {host, elapsed: Date.now() - startedAt}
      : null;
  } catch {
    return null;
  }
}

async function measureImageMirror(imagePath) {
  if (fastestImageHost && fastestImageHostExpiresAt > Date.now()) return fastestImageHost;
  if (fastestImageProbe) return fastestImageProbe;
  fastestImageProbe = Promise.all(IMAGE_HOSTS.map((host) => probeImageHost(host, imagePath)))
    .then((results) => {
      const fastest = results.filter(Boolean).sort((left, right) => left.elapsed - right.elapsed)[0]?.host || IMAGE_HOSTS[0];
      fastestImageHost = fastest;
      fastestImageHostExpiresAt = Date.now() + IMAGE_MIRROR_TTL_MS;
      return fastest;
    })
    .finally(() => { fastestImageProbe = null; });
  return fastestImageProbe;
}

export default async (request) => {
  const url = new URL(request.url);
  if (url.pathname === '/api/gallery/image' && request.method === 'GET') return getGalleryImage(url);
  if (url.pathname !== '/api/gallery' || request.method !== 'GET') {
    return json({success: false, message: '接口不存在。'}, 404);
  }

  let sawNotFound = false;
  let lastStatus = 502;
  for (const manifestUrl of MANIFEST_URLS) {
    try {
      const response = await fetch(manifestUrl, {
        headers: {accept: 'application/json', 'user-agent': 'Yusen-Image-Gallery'},
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status === 404) {
        sawNotFound = true;
        continue;
      }
      if (!response.ok) {
        lastStatus = response.status;
        continue;
      }
      return json({success: true, data: normalizeManifest(await response.json())});
    } catch {
      // Try the alternate HF endpoint before reporting a temporary failure.
    }
  }
  if (sawNotFound) return json({success: true, data: {albums: [], updatedAt: null}});
  return json({success: false, message: `图集清单暂时无法读取（${lastStatus}）。`}, lastStatus >= 400 ? lastStatus : 502);
};
