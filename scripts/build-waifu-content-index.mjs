import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'static/data/waifu-content-index.json');
const sourceRoots = ['docs', 'blog'];

async function markdownFiles(directory) {
  const absolute = path.join(root, directory);
  let entries;
  try { entries = await readdir(absolute, {withFileTypes: true}); } catch { return []; }
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(relative));
    else if (/\.mdx?$/i.test(entry.name)) files.push(relative);
  }
  return files;
}

function splitFrontMatter(markdown) {
  if (!markdown.startsWith('---')) return {attributes: {}, body: markdown};
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return {attributes: {}, body: markdown};
  const attributes = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!field) return;
    attributes[field[1]] = field[2].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2');
  });
  return {attributes, body: markdown.slice(match[0].length)};
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function routeFor(relative, attributes) {
  if (attributes.slug) {
    const slug = String(attributes.slug).replace(/^\/+|\/+$/g, '');
    return relative.startsWith('docs/') ? `/docs/${slug}` : `/${slug}`;
  }
  const withoutExtension = relative.replace(/\.mdx?$/i, '');
  if (relative.startsWith('docs/')) {
    const docPath = withoutExtension.slice('docs/'.length).replace(/\/(?:index)$/i, '/');
    return `/docs/${docPath}`.replace(/\/{2,}/g, '/');
  }
  const blogPath = withoutExtension.slice('blog/'.length).replace(/\/(?:index)$/i, '/');
  return `/${blogPath}`.replace(/\/{2,}/g, '/');
}

function documentFromMarkdown(relative, markdown) {
  const {attributes, body} = splitFrontMatter(markdown.replace(/^\uFEFF/, ''));
  if (/^(?:true|yes)$/i.test(String(attributes.draft || ''))) return null;
  const headings = [...body.matchAll(/^#{1,4}\s+(.+?)\s*#*$/gm)]
    .map((match) => plainText(match[1])).filter(Boolean).slice(0, 40);
  const content = plainText(body).slice(0, 24_000);
  const fallbackTitle = headings[0] || path.basename(relative).replace(/\.mdx?$/i, '');
  const title = plainText(attributes.title || fallbackTitle).slice(0, 180);
  const description = plainText(attributes.description || content.slice(0, 260)).slice(0, 320);
  if (!title || !content) return null;
  return {
    id: relative,
    type: relative.startsWith('docs/') ? 'document' : 'post',
    title,
    description,
    path: routeFor(relative, attributes),
    headings,
    content,
  };
}

const files = (await Promise.all(sourceRoots.map(markdownFiles))).flat().sort();
const documents = [];
for (const relative of files) {
  if (/\/authors\.ya?ml$/i.test(relative)) continue;
  const document = documentFromMarkdown(relative, await readFile(path.join(root, relative), 'utf8'));
  if (document) documents.push(document);
}

await mkdir(path.dirname(output), {recursive: true});
await writeFile(output, `${JSON.stringify({version: 1, documents}, null, 2)}\n`);
console.log(`Generated ${path.relative(root, output)} with ${documents.length} searchable documents.`);
