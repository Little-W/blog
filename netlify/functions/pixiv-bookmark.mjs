import {getPixivAccessToken, pixivApi} from '../lib/pixiv-client.mjs';
import {requireAdminSession} from './console.mjs';

export const config = {
  path: '/api/pixiv-bookmark',
  preferStatic: false,
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const requestUrl = new URL(request.url);
  const allowed = new Set([requestUrl.origin]);
  const configured = process.env.GITHUB_OAUTH_PUBLIC_ORIGIN?.trim() || 'https://blog.yusen.best';
  try {
    allowed.add(new URL(configured).origin);
  } catch {
    return false;
  }
  if (allowed.has(origin)) return true;
  if (process.env.CONTEXT === 'production') return false;
  try {
    const originUrl = new URL(origin);
    const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    return originUrl.protocol === requestUrl.protocol
      && originUrl.port === requestUrl.port
      && loopbackHosts.has(originUrl.hostname)
      && loopbackHosts.has(requestUrl.hostname);
  } catch {
    return false;
  }
}

export default async (request) => {
  const url = new URL(request.url);
  if (url.pathname !== '/api/pixiv-bookmark' || request.method !== 'POST') {
    return json({success: false, message: '接口不存在。'}, 404);
  }
  if (!isSameOrigin(request)) return json({success: false, message: '请求来源无效。'}, 403);
  try {
    await requireAdminSession(request);
  } catch (error) {
    const status = Number(error?.status) || 401;
    return json({success: false, message: status === 401 ? '请先使用管理员账号登录。' : '管理员会话暂时无法验证。'}, status);
  }
  if (!process.env.PIXIV_REFRESH_TOKEN) {
    return json({success: false, message: '未配置 PIXIV_REFRESH_TOKEN 环境变量。'}, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({success: false, message: '请求内容无效。'}, 400);
  }
  const id = String(payload?.id || '');
  const action = payload?.action;
  if (!/^\d{1,20}$/.test(id) || !['add', 'remove'].includes(action)) {
    return json({success: false, message: '收藏请求参数无效。'}, 400);
  }

  try {
    const accessToken = await getPixivAccessToken();
    const detail = await pixivApi(`/v1/illust/detail?illust_id=${encodeURIComponent(id)}`, accessToken);
    const wasBookmarked = Boolean(detail.illust?.is_bookmarked);
    const shouldBeBookmarked = action === 'add';
    if (wasBookmarked === shouldBeBookmarked) {
      return json({success: true, data: {id: Number(id), isBookmarked: wasBookmarked}});
    }

    const params = new URLSearchParams({illust_id: id});
    const path = action === 'add'
      ? '/v2/illust/bookmark/add'
      : '/v1/illust/bookmark/delete';
    if (action === 'add') params.set('restrict', 'private'); // 收藏仅对当前账户可见。
    await pixivApi(path, accessToken, {method: 'POST', body: params});
    return json({success: true, data: {id: Number(id), isBookmarked: action === 'add'}});
  } catch (error) {
    const status = Number(error?.status) || 502;
    console.error('[pixiv-bookmark]', error instanceof Error ? error.message : String(error));
    return json({success: false, message: status === 401 ? '请先使用管理员账号登录。' : '收藏操作暂时失败。'}, status);
  }
};
