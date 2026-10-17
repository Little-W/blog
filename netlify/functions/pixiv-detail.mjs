import {getPixivAccessToken, pixivApi, publicImageUrls} from '../lib/pixiv-client.mjs';

export const config = {
  path: '/api/pixiv-detail',
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

export default async (request) => {
  const url = new URL(request.url);
  if (url.pathname !== '/api/pixiv-detail' || request.method !== 'GET') {
    return json({success: false, message: '接口不存在。'}, 404);
  }
  const id = url.searchParams.get('id') || '';
  if (!/^\d{1,20}$/.test(id)) return json({success: false, message: '作品 ID 无效。'}, 400);
  if (!process.env.PIXIV_REFRESH_TOKEN) {
    return json({success: false, message: '未配置 PIXIV_REFRESH_TOKEN 环境变量。'}, 503);
  }

  try {
    const accessToken = await getPixivAccessToken();
    const detail = await pixivApi(`/v1/illust/detail?illust_id=${encodeURIComponent(id)}`, accessToken);
    if (!detail.illust) throw new Error('作品详情为空');
    return json({success: true, data: {illust: publicImageUrls(detail.illust)}});
  } catch (error) {
    console.error('[pixiv-detail]', error instanceof Error ? error.message : String(error));
    return json({success: false, message: '作品详情暂时无法读取，请稍后再试。'}, 502);
  }
};
