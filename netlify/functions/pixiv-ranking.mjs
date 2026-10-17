import {readContent, writeContent} from '../lib/content-store.mjs';

const RANKING_KEY = 'pixiv/ranking.json';
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 分钟缓存，避免频繁请求 Pixiv

function json(payload, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
    },
  });
}

function fail(message, code, status = 400) {
  return json({success: false, code, message}, status, 'no-store');
}

function now() {
  return Date.now();
}

async function refreshAccessToken(clientId, refreshToken) {
  const res = await fetch('https://oauth.secure.pixiv.net/auth/token', {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`刷新 Pixiv token 失败：${res.status} ${body.error || body.message || JSON.stringify(body)}`);
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || refreshToken,
    expiresIn: body.expires_in || 0,
  };
}

async function fetchPixivRanking(accessToken, mode = 'day', date = '') {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const url = new URL('https://app-api.pixiv.net/v1/illust/ranking');
  url.searchParams.set('mode', mode);
  url.searchParams.set('date', targetDate);
  url.searchParams.set('offset', '0');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'App-OS': 'ios',
      'App-OS-Version': '17.0',
      'User-Agent': 'PixivIOSApp/7.13.3 (iOS 17.0; iPhone14,3)',
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.illusts) {
    throw new Error(`获取 Pixiv 榜单失败：${res.status} ${body.error || body.message || JSON.stringify(body)}`);
  }
  return {
    date: targetDate,
    mode,
    illusts: (body.illusts || []).map((illust) => {
      const tags = (illust.tags || []).map((t) => t.name);
      return {
        id: illust.id,
        title: illust.title,
        author: illust.user?.name ?? '未知',
        authorId: String(illust.user?.id ?? ''),
        url: `https://www.pixiv.net/artworks/${illust.id}`,
        thumb: illust.image_urls?.medium || illust.image_urls?.small || '',
        tags,
      };
    }),
    nextUrl: body.next_url || null,
  };
}

export const config = {
  path: '/api/pixiv-ranking',
  preferStatic: false,
};

export default async (request) => {
  const url = new URL(request.url);
  if (url.pathname !== '/api/pixiv-ranking' || request.method !== 'GET') {
    return fail('接口不存在。', 'NOT_FOUND', 404);
  }

  const clientId = process.env.PIXIV_CLIENT_ID;
  const refreshToken = process.env.PIXIV_REFRESH_TOKEN;
  const mode = url.searchParams.get('mode') || 'day';

  // 缺少凭据时返回明确提示，前端展示占位，不中断站点。
  if (!clientId || !refreshToken) {
    return json({
      success: false,
      code: 'MISSING_PIXIV_CREDENTIALS',
      message: '未配置 PIXIV_CLIENT_ID / PIXIV_REFRESH_TOKEN 环境变量，请在 Netlify 后台设置后再启用榜单。',
      data: {illusts: [], date: '', mode},
    }, 200, 'no-store');
  }

  try {
    // 先读 Blobs 缓存，未过期则直接返回。
    const cached = await readContent(RANKING_KEY, {type: 'json'});
    if (cached && cached.data && cached.fetchedAt && now() - cached.fetchedAt < CACHE_TTL_MS) {
      return json({success: true, data: cached.data, source: 'cache'}, 200, 'public, max-age=60');
    }

    const {accessToken} = await refreshAccessToken(clientId, refreshToken);
    const data = await fetchPixivRanking(accessToken, mode);

    await writeContent(RANKING_KEY, {
      data,
      fetchedAt: now(),
    });

    return json({success: true, data, source: 'live'}, 200, 'public, max-age=60');
  } catch (error) {
    console.error('[pixiv-ranking]', error instanceof Error ? error.message : String(error));
    return fail('榜单暂时无法读取，请稍后再试。', 'PIXIV_RANKING_ERROR', 502);
  }
};
