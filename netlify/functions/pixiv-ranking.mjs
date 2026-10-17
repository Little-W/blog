import {readContent, writeContent} from '../lib/content-store.mjs';

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 分钟缓存，避免频繁请求 Pixiv
const RANKING_MODES = new Set(['day', 'week', 'month', 'week_rookie', 'week_original']);

// Pixiv 官方 App 内置客户端凭据（公开常量），可用环境变量覆盖。
const DEFAULT_CLIENT_ID = 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
const DEFAULT_CLIENT_SECRET = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';

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

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://oauth.secure.pixiv.net/auth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'App-OS': 'android',
      'App-OS-Version': '15',
      'App-Version': '6.180.0',
      'User-Agent': 'PixivAndroidApp/6.180.0 (Android 15; Pixel 9)',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      get_secure_url: 'true',
      include_policy: 'true',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const body = await res.json().catch(() => ({}));
  const auth = body.response || body;
  if (!res.ok || !auth.access_token) {
    throw new Error(`刷新 Pixiv token 失败：${res.status} ${body.error || body.message || JSON.stringify(body)}`);
  }
  return {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token || refreshToken,
    expiresIn: auth.expires_in || 0,
  };
}

function jstDate(daysAgo = 0) {
  return new Date(Date.now() + 9 * 3600 * 1000 - daysAgo * 86400 * 1000).toISOString().slice(0, 10);
}

async function requestRanking(accessToken, mode, date) {
  const url = new URL('https://app-api.pixiv.net/v1/illust/ranking');
  url.searchParams.set('mode', mode);
  url.searchParams.set('date', date);
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
  if (!res.ok || !Array.isArray(body.illusts)) {
    throw new Error(`获取 Pixiv 榜单失败：${res.status} ${body.error || body.message || JSON.stringify(body)}`);
  }
  return {
    date,
    mode,
    illusts: body.illusts.map((illust, index) => {
      const tags = (illust.tags || []).map((t) => t.name);
      return {
        rank: index + 1,
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

async function fetchPixivRanking(accessToken, mode = 'day', date = '') {
  // 指定日期就只取该日；默认取 JST 昨天（当日榜单尚未结算），为空再往前退一天。
  const candidates = date ? [date] : [jstDate(1), jstDate(2), jstDate(3)];
  let result = null;
  for (const day of candidates) {
    result = await requestRanking(accessToken, mode, day);
    if (result.illusts.length) break;
  }
  return result;
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

  const clientId = process.env.PIXIV_CLIENT_ID || DEFAULT_CLIENT_ID;
  const clientSecret = process.env.PIXIV_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;
  const refreshToken = process.env.PIXIV_REFRESH_TOKEN;
  const mode = url.searchParams.get('mode') || 'day';

  if (!RANKING_MODES.has(mode)) {
    return fail('不支持的榜单类型。', 'INVALID_MODE', 400);
  }
  const cacheKey = `pixiv/ranking/${mode}.json`;

  // 未配置 refresh_token 时返回明确提示，前端展示占位，不中断站点。
  if (!refreshToken) {
    return json({
      success: false,
      code: 'MISSING_PIXIV_CREDENTIALS',
      message: '未配置 PIXIV_REFRESH_TOKEN 环境变量，请先运行 node scripts/pixiv-token.mjs 导出后配置到 Netlify。',
      data: {illusts: [], date: '', mode},
    }, 200, 'no-store');
  }

  try {
    // 先读 Blobs 缓存，未过期则直接返回。
    const cached = await readContent(cacheKey, {type: 'json'});
    if (cached && cached.data && cached.fetchedAt && now() - cached.fetchedAt < CACHE_TTL_MS) {
      return json({success: true, data: cached.data, source: 'cache'}, 200, 'public, max-age=60');
    }

    const {accessToken} = await refreshAccessToken(clientId, clientSecret, refreshToken);
    const data = await fetchPixivRanking(accessToken, mode);

    await writeContent(cacheKey, JSON.stringify({
      data,
      fetchedAt: now(),
    }));

    return json({success: true, data, source: 'live'}, 200, 'public, max-age=60');
  } catch (error) {
    console.error('[pixiv-ranking]', error instanceof Error ? error.message : String(error));
    return fail('榜单暂时无法读取，请稍后再试。', 'PIXIV_RANKING_ERROR', 502);
  }
};
