// 代理 Pixiv 缩略图：i.pximg.net 有防盗链，只有带 Referer: https://www.pixiv.net/ 才返回 200。
// 仅允许代理 i.pximg.net，避免被当作通用 SSRF 代理。
const ALLOWED_HOST = 'i.pximg.net';
const PIXIV_REFERER = 'https://www.pixiv.net/';

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
  if (target.protocol !== 'https:' || target.hostname !== ALLOWED_HOST) {
    return new Response('Forbidden', {status: 403});
  }

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        Referer: PIXIV_REFERER,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
  } catch {
    return new Response('Upstream request failed', {status: 502});
  }

  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream error', {status: 502});
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'image/jpeg',
      'cache-control': 'public, max-age=86400, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
};
