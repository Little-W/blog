import {
  ARTICLE_INDEX_KEY,
  ARTICLE_PREFIX,
  contentMetadata,
  listContent,
  readContent,
  writeContent,
} from './content-store.mjs';

export function normalizeArticlePath(value) {
  const path = String(value || '').replace(/^@site\//, '').replace(/\\/g, '/');
  if (path.includes('..') || path.startsWith('/') || /[\0\r\n]/.test(path)) return null;
  if (!/^(?:docs|blog)\/.+\.(?:md|mdx)$/i.test(path)) return null;
  return path;
}

export function articleKey(path) {
  return `${ARTICLE_PREFIX}${path}`;
}

export function parseFrontMatter(content) {
  const text = String(content || '').replace(/^\uFEFF/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return {data: {}, body: text};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!entry) continue;
    data[entry[1]] = entry[2].replace(/^["']|["']$/g, '').trim();
  }
  return {data, body: text.slice(match[0].length)};
}

export function parseTags(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const inner = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;
  return inner
    .split(/[,，]/)
    .map((item) => item.replace(/^["']|["']$/g, '').trim())
    .filter(Boolean);
}

function firstHeading(body) {
  const match = /^#{1,6}\s+(.+?)\s*$/m.exec(String(body || ''));
  return match ? match[1].trim() : '';
}

export function articleSummary(path, content, updatedAt = null) {
  const {data, body} = parseFrontMatter(content);
  const fallback = path.split('/').pop().replace(/\.(md|mdx)$/i, '');
  return {
    path,
    title: data.title || firstHeading(body) || fallback,
    tags: parseTags(data.tags),
    section: path.split('/').slice(0, -1).join('/'),
    updatedAt: updatedAt || null,
  };
}

export async function readArticleIndex() {
  const stored = await readContent(ARTICLE_INDEX_KEY, {type: 'json'}).catch(() => null);
  if (stored && Array.isArray(stored.articles)) return stored;
  return null;
}

export async function writeArticleIndex(articles) {
  const payload = {articles, updatedAt: new Date().toISOString()};
  await writeContent(ARTICLE_INDEX_KEY, JSON.stringify(payload, null, 2), {
    metadata: {updatedAt: payload.updatedAt},
  });
  return payload;
}

export async function buildArticleIndex() {
  const keys = (await listContent(ARTICLE_PREFIX))
    .filter((key) => key.startsWith(ARTICLE_PREFIX) && !key.endsWith('/_index.json') && key !== ARTICLE_INDEX_KEY);
  const articles = [];
  for (const key of keys) {
    const content = await readContent(key);
    if (typeof content !== 'string') continue;
    const meta = await contentMetadata(key);
    articles.push(articleSummary(key.slice(ARTICLE_PREFIX.length), content, meta?.metadata?.updatedAt || null));
  }
  articles.sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));
  return writeArticleIndex(articles);
}

export async function ensureArticleIndex() {
  return (await readArticleIndex()) || (await buildArticleIndex());
}

export function sortArticles(articles) {
  return articles.slice().sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));
}

export async function upsertArticleEntry(summary) {
  const index = await ensureArticleIndex();
  const articles = index.articles.filter((article) => article.path !== summary.path);
  articles.push(summary);
  return writeArticleIndex(sortArticles(articles));
}

export async function removeArticleEntry(path) {
  const index = await ensureArticleIndex();
  return writeArticleIndex(index.articles.filter((article) => article.path !== path));
}
