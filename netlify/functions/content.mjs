import {ARTICLE_PREFIX, contentMetadata, readContent} from '../lib/content-store.mjs';
import {articleSummary, ensureArticleIndex, normalizeArticlePath} from '../lib/articles.mjs';
import {seedContentFromRepository} from './console.mjs';

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

export default async (request) => {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/content/list' && request.method === 'GET') return await listArticles();
    if (url.pathname === '/api/content/file' && request.method === 'GET') return await getArticle(url);
    return fail('内容接口不存在。', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('[content-api]', error instanceof Error ? error.message : String(error));
    return fail('文章暂时无法读取。', 'CONTENT_API_ERROR', 500);
  }
};
