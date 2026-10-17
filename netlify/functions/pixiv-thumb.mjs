// 仅代理经验证可用的开源图床镜像，可选以附件形式返回用于下载。
const ALLOWED_HOSTS = new Set(['i.pixiv.re', 'i.pixiv.nl']);

export const config = {
  path: '/api/pixiv-thumb',
  preferStatic: false,
};

export default async (request) => {
  const url = new URL(request.url);
  if (url.pathname !== '/api/pixiv-thumb' || request.method !== 'GET') {
    return new Response('Not Found', {status: 404});
  }

  const raw = url.searchParams.get('u');
  if (!raw) return new Response('Missing image url', {status: 400});

  let target;
  try {
    target = new URL(raw);
  } catch {
    return new Response('Invalid image url', {status: 400});
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return new Response('Forbidden', {status: 403});
  }

  const filename = url.searchParams.get('download');
  const mirrors = [target.hostname, ...[...ALLOWED_HOSTS].filter((host) => host !== target.hostname)];
  let upstream = null;
  let body = null;
  let contentType = 'image/jpeg';

  for (const host of mirrors) {
    const mirrorUrl = new URL(target);
    mirrorUrl.hostname = host;
    try {
      const response = await fetch(mirrorUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        ...(filename ? {signal: AbortSignal.timeout(9000)} : {}),
      });
      if (!response.ok || !response.body) continue;
      contentType = response.headers.get('content-type') || contentType;
      if (filename) {
        try {
          body = await response.arrayBuffer();
          upstream = response;
          break;
        } catch {
          continue;
        }
      }
      upstream = response;
      body = response.body;
      break;
    } catch {
      // Try the other approved image mirror before failing the request.
    }
  }

  if (!upstream || !body) return new Response('Image mirrors unavailable', {status: 502});

  const headers = {
    'content-type': contentType,
    'cache-control': 'public, max-age=86400, immutable',
    'x-content-type-options': 'nosniff',
  };
  if (filename) {
    const safeName = filename.replace(/[\\/\r\n\";]/g, '_').slice(0, 180) || 'pixiv-artwork.jpg';
    headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`;
    headers['cache-control'] = 'private, no-store';
  }

  return new Response(body, {
    status: 200,
    headers,
  });
};
