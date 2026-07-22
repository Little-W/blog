const MAX_LYRIC_BYTES = 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
const DATASET_PREFIX = '/datasets/Yusen/music/resolve/';
const ALLOWED_HOSTS = new Set(['aifasthub.com', 'hf-cdn.sufy.com', 'hf-mirror.com', 'huggingface.co']);

export const config = {
  path: '/api/music-lyrics',
  preferStatic: false,
};

function errorResponse(message, status) {
  return new Response(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function allowedLyricURL(value) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith(DATASET_PREFIX) || pathname.includes('/../') || !pathname.toLowerCase().endsWith('.lrc')) return null;
  const resolvePath = pathname.slice(DATASET_PREFIX.length);
  const revisionEnd = resolvePath.indexOf('/');
  const revision = revisionEnd > 0 ? resolvePath.slice(0, revisionEnd) : '';
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(revision)) return null;
  return url;
}

async function lyricResponse(upstream) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(upstream, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/plain, text/*;q=0.9, */*;q=0.1',
        'user-agent': 'YusenBlog-Lyrics/1.0',
      },
    });
    if (!response.ok) return errorResponse('歌词源暂时无法响应。', response.status >= 400 && response.status < 500 ? response.status : 502);
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_LYRIC_BYTES) return errorResponse('歌词文件过大。', 413);
    return new Response(response.body, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        // 歌词内容与曲库版本一起固定，可由浏览器和 Netlify CDN 缓存；上游波动时
        // 仍允许使用最近一次内容，避免播放器把短暂失败显示为永久无歌词。
        'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'x-content-type-options': 'nosniff',
        vary: 'Accept',
      },
    });
  } catch (error) {
    return errorResponse(error && error.name === 'AbortError' ? '歌词源响应超时。' : '歌词源暂时无法响应。', 502);
  } finally {
    clearTimeout(timeout);
  }
}

export default async (request) => {
  if (request.method !== 'GET') return errorResponse('仅支持 GET 请求。', 405);
  const source = new URL(request.url).searchParams.get('source');
  const upstream = allowedLyricURL(source);
  if (!upstream) return errorResponse('歌词地址不在允许的曲库范围内。', 400);
  return lyricResponse(upstream);
};
