import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';

import {
  ARTICLE_PREFIX,
  MUSIC_PREFIX,
  MUSIC_REVISION_KEY,
  contentBackend,
  writeContent,
} from '../netlify/lib/content-store.mjs';
import {articleSummary, sortArticles, writeArticleIndex} from '../netlify/lib/articles.mjs';

const ROOT = process.cwd();
const DATASET_NAMES = ['music_hq', 'music_sq', 'music_tag', 'mv', 'mv_bilibili', 'mv_class', 'mv_out'];
const ARTICLE_DIRS = ['docs', 'blog'];
const ARTICLE_EXTENSIONS = new Set(['.md', '.mdx']);

async function walk(dir, relative = '') {
  const entries = await readdir(dir, {withFileTypes: true}).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(dir, entry.name), next));
    else files.push(next);
  }
  return files;
}

async function seedDatasets() {
  let count = 0;
  for (const name of DATASET_NAMES) {
    const file = path.join(ROOT, 'static', 'data', `${name}.0.jsonl`);
    try {
      const text = await readFile(file, 'utf8');
      await writeContent(`${MUSIC_PREFIX}${name}.0.jsonl`, text);
      count += 1;
    } catch {
      // 数据表不存在时跳过。
    }
  }
  const revision = new Date().toISOString();
  await writeContent(
    MUSIC_REVISION_KEY,
    JSON.stringify({revision, updatedAt: revision}),
    {metadata: {revision, updatedAt: revision}},
  );
  return count;
}

async function seedArticles() {
  const articles = [];
  for (const base of ARTICLE_DIRS) {
    for (const relative of await walk(path.join(ROOT, base))) {
      if (!ARTICLE_EXTENSIONS.has(path.extname(relative).toLowerCase())) continue;
      const repoPath = `${base}/${relative}`;
      const content = await readFile(path.join(ROOT, base, relative), 'utf8');
      const updatedAt = new Date().toISOString();
      await writeContent(`${ARTICLE_PREFIX}${repoPath}`, content, {metadata: {updatedAt}});
      articles.push(articleSummary(repoPath, content, updatedAt));
    }
  }
  await writeArticleIndex(sortArticles(articles));
  await writeContent(`${ARTICLE_PREFIX}_seeded.json`, JSON.stringify({seededAt: new Date().toISOString()}));
  return articles.length;
}

async function main() {
  if (contentBackend() !== 'local') {
    console.error('当前检测到 Netlify Blobs 上下文，种子脚本仅用于本地文件模拟。');
    process.exit(1);
  }
  const datasets = await seedDatasets();
  const articles = await seedArticles();
  console.log(`已写入本地 Blob 模拟目录：${datasets} 个数据表，${articles} 篇文章。`);
  console.log(`位置：${process.env.LOCAL_CONTENT_DIR || path.join(ROOT, '.local-blobs')}`);
}

await main();
