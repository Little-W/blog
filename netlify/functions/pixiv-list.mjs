import {getPixivAuth, pixivApi, publicImageUrls} from '../lib/pixiv-client.mjs';
import {requireAdminSession} from './console.mjs';

const PIXIV_API_ORIGIN = 'https://app-api.pixiv.net';
const LIST_ENDPOINTS = {
  recommended: '/v1/illust/recommended',
  bookmarks: '/v1/user/bookmarks/illust',
};

export const config = {
  path: '/api/pixiv-list',
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

function buildPath(type, userId, restrict = '') {
  const path = new URL(LIST_ENDPOINTS[type], PIXIV_API_ORIGIN);
  path.searchParams.set('filter', 'for_android');
  if (type === 'recommended') {
    path.searchParams.set('include_ranking_illusts', 'false');
  } else {
    path.searchParams.set('user_id', String(userId));
    path.searchParams.set('restrict', restrict);
  }
  return path.toString();
}

function validateNextUrl(value, type, userId, restrict = '') {
  if (!value) return null;
  const next = new URL(value);
  if (next.protocol !== 'https:' || next.origin !== PIXIV_API_ORIGIN || next.pathname !== LIST_ENDPOINTS[type]) {
    throw new Error('分页游标无效。');
  }
  if (type === 'bookmarks') {
    const urlRestrict = next.searchParams.get('restrict');
    const allowedRestrictions = restrict === 'public' ? ['public', '0'] : ['private', '1'];
    if (next.searchParams.get('user_id') !== String(userId) || !allowedRestrictions.includes(urlRestrict)) {
      throw new Error('收藏列表分页游标无效。');
    }
    next.searchParams.set('restrict', restrict);
    next.searchParams.set('user_id', String(userId));
  }
  return next.toString();
}

function decodeCursor(cursor, type, userId) {
  if (!cursor) {
    return type === 'bookmarks'
      ? {public: buildPath(type, userId, 'public'), private: buildPath(type, userId, 'private')}
      : `${LIST_ENDPOINTS[type]}?filter=for_android&include_ranking_illusts=false`;
  }
  if (cursor.length > 8192) {
    const error = new Error('分页游标无效。');
    error.status = 400;
    throw error;
  }
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    if (type === 'bookmarks') {
      const pair = JSON.parse(decoded);
      return {
        public: validateNextUrl(pair.public, type, userId, 'public'),
        private: validateNextUrl(pair.private, type, userId, 'private'),
      };
    }
    return validateNextUrl(decoded, type, userId);
  } catch {
    const error = new Error('分页游标无效。');
    error.status = 400;
    throw error;
  }
}

function encodeCursor(nextUrl, type, userId) {
  if (!nextUrl) return null;
  try {
    const next = validateNextUrl(nextUrl, type, userId);
    return next ? Buffer.from(next).toString('base64url') : null;
  } catch {
    return null;
  }
}

function encodeBookmarkCursor(publicNextUrl, privateNextUrl, userId) {
  try {
    const cursor = {
      public: validateNextUrl(publicNextUrl, 'bookmarks', userId, 'public'),
      private: validateNextUrl(privateNextUrl, 'bookmarks', userId, 'private'),
    };
    if (!cursor.public && !cursor.private) return null;
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  } catch {
    return null;
  }
}

function toItem(illust, type) {
  const originalImage = illust.meta_single_page?.original_image_url
    || illust.meta_pages?.[0]?.image_urls?.original
    || illust.image_urls?.original
    || illust.meta_pages?.[0]?.image_urls?.large
    || illust.image_urls?.large
    || '';
  const thumb = illust.image_urls?.medium || illust.image_urls?.small || '';
  const item = publicImageUrls({
    rank: 0,
    id: illust.id,
    title: illust.title || '无题',
    description: illust.caption || '',
    author: illust.user?.name || '未知',
    authorId: String(illust.user?.id || ''),
    thumb,
    originalImage,
    tags: (illust.tags || []).map((tag) => tag.name),
    isBookmarked: type === 'bookmarks' || Boolean(illust.is_bookmarked),
  });
  // Pixiv occasionally returns stale bookmark records whose artwork has been
  // deleted or whose image URL points at Pixiv's s.pximg.net placeholder.
  // Normalize first, then omit entries with no renderable image to avoid empty cards.
  if (!item.thumb && !item.originalImage) return null;
  return item;
}

export default async (request) => {
  const url = new URL(request.url);
  if (url.pathname !== '/api/pixiv-list' || request.method !== 'GET') {
    return json({success: false, message: '接口不存在。'}, 404);
  }
  const type = url.searchParams.get('type') || '';
  if (!Object.hasOwn(LIST_ENDPOINTS, type)) return json({success: false, message: '不支持的图集列表。'}, 400);

  try {
    await requireAdminSession(request);
    if (!process.env.PIXIV_REFRESH_TOKEN) {
      return json({success: false, message: '未配置 PIXIV_REFRESH_TOKEN 环境变量。'}, 503);
    }
    const auth = await getPixivAuth();
    const userId = auth.user?.id;
    if (type === 'bookmarks' && !userId) throw new Error('Pixiv 登录响应缺少账户 ID。');
    const cursor = decodeCursor(url.searchParams.get('cursor') || '', type, userId);
    let illusts;
    let nextCursor;
    if (type === 'recommended') {
      const result = await pixivApi(cursor, auth.accessToken);
      illusts = Array.isArray(result.illusts) ? result.illusts : [];
      nextCursor = encodeCursor(result.next_url, type, userId);
    } else {
      const [publicResult, privateResult] = await Promise.all([
        cursor.public ? pixivApi(new URL(cursor.public).pathname + new URL(cursor.public).search, auth.accessToken) : Promise.resolve({illusts: []}),
        cursor.private ? pixivApi(new URL(cursor.private).pathname + new URL(cursor.private).search, auth.accessToken) : Promise.resolve({illusts: []}),
      ]);
      const byId = new Map();
      for (const illust of [...(publicResult.illusts || []), ...(privateResult.illusts || [])]) byId.set(illust.id, illust);
      illusts = [...byId.values()].sort((left, right) => new Date(right.create_date) - new Date(left.create_date));
      nextCursor = encodeBookmarkCursor(publicResult.next_url, privateResult.next_url, userId);
    }
    return json({
      success: true,
      data: {
        date: '',
        mode: type,
        illusts: illusts.map((illust) => toItem(illust, type)).filter(Boolean),
        nextOffset: null,
        nextCursor,
      },
    });
  } catch (error) {
    const status = Number(error?.status) || 502;
    console.error('[pixiv-list]', error instanceof Error ? error.message : String(error));
    return json({success: false, message: status === 401 ? '请先使用管理员账号登录。' : '图集列表暂时无法读取。'}, status);
  }
};
