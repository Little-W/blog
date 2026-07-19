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

  // hf-mirror 只负责入口转发；实际解析必须在 Netlify 的服务端请求官方站点，
  // 才能取得浏览器可直连的短期 LFS URL。
  url.hostname = 'huggingface.co';
  if (download) url.searchParams.set('download', 'true');
  return url;
}

function isTrustedStorageURL(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return host === 'cdn-lfs-us-1.hf.co'
    || host === 'cdn-lfs.huggingface.co'
    || host.endsWith('.xethub.hf.co');
}

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return textResponse('仅支持 GET 或 HEAD 请求。', 405);

  const requestURL = new URL(request.url);
  const upstream = officialSourceURL(requestURL.searchParams.get('source'), requestURL.searchParams.get('download') === '1');
  if (!upstream) return textResponse('音乐地址不在允许的资料库范围内。', 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(upstream, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'audio/*, application/octet-stream;q=0.9, */*;q=0.1',
        range: 'bytes=0-0',
        'user-agent': 'YusenBlog-MusicSource/1.0',
      },
    });
    const location = response.headers.get('location');
    if (!location || response.status < 300 || response.status >= 400) {
      return textResponse('官方音乐源暂时无法生成直连地址。', 502);
    }
    const storageURL = new URL(location, upstream).toString();
    if (!isTrustedStorageURL(storageURL)) return textResponse('官方音乐源返回了不受支持的存储地址。', 502);

    return new Response(null, {
      status: 302,
      headers: {
        location: storageURL,
        // 签名 URL 有时效，缓存仅用于减少同一首歌短时间内的重复解析。
        'cache-control': 'public, max-age=60, s-maxage=300',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return textResponse(error && error.name === 'AbortError' ? '官方音乐源响应超时。' : '官方音乐源暂时无法访问。', 502);
  } finally {
    clearTimeout(timeout);
  }
};
