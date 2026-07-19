const UPSTREAM_TIMEOUT_MS = 12_000;
const DATASET_PREFIX = '/datasets/Yusen/music/resolve/main/';
const SOURCE_HOSTS = new Set(['hf-mirror.com', 'huggingface.co']);
const MEDIA_FILE_RE = /\.(?:mp3|flac|m4a|aac|ogg|opus|wav)$/i;

export const config = {
  path: '/api/music-source',
  preferStatic: false,
};

function textResponse(message, status) {
  return new Response(message, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  });
}

function officialSourceURL(value, download) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !SOURCE_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith(DATASET_PREFIX) || pathname.includes('/../') || !MEDIA_FILE_RE.test(pathname)) return null;

  // hf-mirror 只负责入口转发；由 Netlify 服务端请求官方站点并跟随 LFS
  // 重定向，浏览器不再直接访问被干扰的 huggingface.co 或 LFS 域名。
  url.hostname = 'huggingface.co';
  if (download) url.searchParams.set('download', 'true');
  return url;
}

function proxyHeaders(response) {
  const headers = new Headers({
    // 音频 Range 响应不应由浏览器长期保留；每次由 Netlify 重新验证上游，避免
    // 使用过期的 LFS 签名地址，也避免 CDN 缓存大体积分段内容。
    'cache-control': 'private, no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  });
  ['accept-ranges', 'content-disposition', 'content-length', 'content-range', 'content-type', 'etag', 'last-modified']
    .forEach((name) => {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    });
  return headers;
}

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return textResponse('仅支持 GET 或 HEAD 请求。', 405);

  const requestURL = new URL(request.url);
  const upstream = officialSourceURL(requestURL.searchParams.get('source'), requestURL.searchParams.get('download') === '1');
  if (!upstream) return textResponse('音乐地址不在允许的资料库范围内。', 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const range = request.headers.get('range');
    if (range && !/^bytes=\d*-\d*(?:,\d*-\d*)*$/.test(range)) return textResponse('音频范围请求无效。', 416);
    const response = await fetch(upstream, {
      method: request.method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'audio/*, application/octet-stream;q=0.9, */*;q=0.1',
        ...(range ? {range} : {}),
        'user-agent': 'YusenBlog-MusicSource/1.0',
      },
    });
    if (!response.ok) return textResponse('官方音乐源暂时无法返回音频内容。', response.status >= 400 && response.status < 500 ? response.status : 502);
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      headers: proxyHeaders(response),
    });
  } catch (error) {
    return textResponse(error && error.name === 'AbortError' ? '官方音乐源响应超时。' : '官方音乐源暂时无法访问。', 502);
  } finally {
    clearTimeout(timeout);
  }
};
