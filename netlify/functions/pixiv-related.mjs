import {getPixivAccessToken, pixivApi, publicImageUrls} from '../lib/pixiv-client.mjs';

export const config = {
  path: '/api/pixiv-related',
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

function compactRelated(illust) {
  return {
    id: illust.id,
    title: illust.title || '无题',
    author: illust.user?.name || '未知',
    thumb: illust.image_urls?.medium || illust.image_urls?.small || '',
  };
}

export default async (request) => {
  const url = new URL(request.url);
  if (url.pathname !== '/api/pixiv-related' || request.method !== 'GET') {
    return json({success: false, message: '接口不存在。'}, 404);
  }
  const id = url.searchParams.get('id') || '';
  if (!/^\d{1,20}$/.test(id)) return json({success: false, message: '作品 ID 无效。'}, 400);
  if (!process.env.PIXIV_REFRESH_TOKEN) {
    return json({success: false, message: '未配置 PIXIV_REFRESH_TOKEN 环境变量。'}, 503);
  }

  try {
    const accessToken = await getPixivAccessToken();
    const related = await pixivApi(`/v2/illust/related?illust_id=${encodeURIComponent(id)}&filter=for_android`, accessToken);
    return json({
      success: true,
      data: {illusts: (related.illusts || []).map(compactRelated).map(publicImageUrls)},
    });
  } catch (error) {
    console.error('[pixiv-related]', error instanceof Error ? error.message : String(error));
    return json({success: false, message: '相似推荐暂时无法读取。'}, 502);
  }
};
