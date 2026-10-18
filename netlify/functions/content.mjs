import {ARTICLE_PREFIX, contentMetadata, readContent} from '../lib/content-store.mjs';
import {articleSummary, ensureArticleIndex, normalizeArticlePath} from '../lib/articles.mjs';
import {ensureAssetFromRepository, seedContentFromRepository} from './console.mjs';

export const config = {
  path: '/api/content/*',
  preferStatic: false,
};

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

async function listArticles() {
  await seedContentFromRepository().catch(() => {});
  const index = await ensureArticleIndex();
  const revision = index.articles.reduce(
    (latest, article) => (article.updatedAt && article.updatedAt > latest ? article.updatedAt : latest),
    index.updatedAt || '',
  );
  return json({
    success: true,
    data: {
      articles: index.articles,
      updatedAt: index.updatedAt || null,
      revision: revision || 'local',
    },
  });
}

async function getArticle(url) {
  const path = normalizeArticlePath(url.searchParams.get('path'));
  if (!path) return fail('文章路径无效。', 'INVALID_CONTENT_PATH', 400);
  await seedContentFromRepository().catch(() => {});
  const key = `${ARTICLE_PREFIX}${path}`;
  const content = await readContent(key);
  if (typeof content !== 'string') return fail('文章不存在。', 'NOT_FOUND', 404);
  const meta = await contentMetadata(key);
  return json({
    success: true,
    data: {
      path,
      content,
      summary: articleSummary(path, content, meta?.metadata?.updatedAt || null),
      updatedAt: meta?.metadata?.updatedAt || null,
      revision: meta?.etag || 'local',
    },
  });
}

const IMAGE_TYPES = Object.freeze({
  '.avif': 'image/avif', '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.bmp': 'image/bmp',
});

function normalizeAssetPath(value) {
  const path = String(value || '').replace(/^@site\//, '').replace(/\\/g, '/');
  if (path.includes('..') || path.startsWith('/') || /[\0\r\n]/.test(path)) return null;
  if (!/^(?:docs|blog)\/.+$/i.test(path)) return null;
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
  return IMAGE_TYPES[extension] ? {path, type: IMAGE_TYPES[extension]} : null;
}

async function getAsset(url) {
  const asset = normalizeAssetPath(url.searchParams.get('path'));
  if (!asset) return fail('图片路径无效。', 'INVALID_ASSET_PATH', 400);
  const bytes = await ensureAssetFromRepository(asset.path);
  if (!(bytes instanceof Uint8Array)) return fail('图片不存在。', 'NOT_FOUND', 404);
  return new Response(bytes, {
    status: 200,
    headers: {
      'cache-control': 'public, max-age=300',
      'content-type': asset.type,
      'x-content-type-options': 'nosniff',
    },
  });
}

export default async (request) => {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/content/list' && request.method === 'GET') return await listArticles();
    if (url.pathname === '/api/content/file' && request.method === 'GET') return await getArticle(url);
    if (url.pathname === '/api/content/asset' && request.method === 'GET') return await getAsset(url);
    return fail('内容接口不存在。', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('[content-api]', error instanceof Error ? error.message : String(error));
    return fail('文章暂时无法读取。', 'CONTENT_API_ERROR', 500);
  }
};
