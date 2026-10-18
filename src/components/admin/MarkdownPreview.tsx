import React, {useMemo} from 'react';
import unified from 'unified';
import remarkParse from 'remark-parse';
import toHast from 'mdast-util-to-hast';

import {highlightToHtml, languageFromClassName} from './codeHighlight';
import styles from '@site/src/pages/admin/styles.module.css';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
  position?: {start?: {line?: number}};
};

type RenderContext = {offset: number; sourcePath?: string};

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
  'pre', 'code', 'a', 'img', 'hr', 'br', 'strong', 'em', 'del', 'table',
  'thead', 'tbody', 'tr', 'th', 'td', 'input', 'span', 'sup', 'sub', 'kbd',
]);
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input']);
const LINE_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
  'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

const TABLE_DELIMITER = /^\s*:?-{2,}:?\s*$/;

export type FrontMatterEntry = {key: string; value: string};
export type FrontMatterSplit = {entries: FrontMatterEntry[]; body: string};

export function splitFrontMatter(source: string): FrontMatterSplit {
  const lines = String(source ?? '').split('\n');
  if (lines[0]?.trim() !== '---') return {entries: [], body: String(source ?? '')};
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) return {entries: [], body: String(source ?? '')};
  const entries: FrontMatterEntry[] = [];
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (match) entries.push({key: match[1], value: match[2]});
  }
  return {entries, body: lines.slice(end + 1).join('\n').replace(/^\n/, '')};
}

export function getFrontMatterValue(entries: FrontMatterEntry[], key: string): string {
  const entry = entries.find((item) => item.key.toLowerCase() === key.toLowerCase());
  return entry ? entry.value : '';
}

export function frontMatterLineOffset(source: string): number {
  const lines = String(source ?? '').split('\n');
  if (lines[0]?.trim() !== '---') return 0;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) return 0;
  const afterClose = end + 1;
  return lines[afterClose] === '' ? afterClose + 1 : afterClose;
}

function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^(?:https?:|mailto:|tel:|\/|#|\.\/|\.\.\/)/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return value;
}

function splitPathAndSuffix(value: string): {path: string; suffix: string} {
  const match = /^([^?#]*)([?#][\s\S]*)?$/.exec(value);
  return {path: match?.[1] || value, suffix: match?.[2] || ''};
}

function resolveSourcePath(sourcePath: string | undefined, rawPath: string): string | null {
  if (!sourcePath) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath).replace(/\\/g, '/');
  } catch {
    return null;
  }
  let parts: string[];
  if (/^\/?(?:docs|blog)\//i.test(decoded)) {
    parts = decoded.replace(/^\//, '').split('/');
  } else if (decoded.startsWith('/')) {
    return null;
  } else {
    parts = sourcePath.replace(/\\/g, '/').split('/').slice(0, -1);
    for (const part of decoded.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (parts.length <= 1) return null;
        parts.pop();
      } else {
        parts.push(part);
      }
    }
  }
  const path = parts.join('/');
  return /^(?:docs|blog)\/.+$/i.test(path) && !parts.includes('..') ? path : null;
}

function assetUrl(path: string): string | null {
  if (!/\.(?:avif|gif|jpe?g|png|svg|webp|bmp)$/i.test(path)) return null;
  return `/api/content/asset?path=${encodeURIComponent(path)}`;
}

function articleImageUrl(raw: string, sourcePath?: string): string | null {
  const safe = safeUrl(raw);
  if (!safe || /^(?:https?:|data:|blob:|\/\/|#)/i.test(safe)) return safe;
  const {path: rawPath, suffix} = splitPathAndSuffix(safe);
  const resolved = resolveSourcePath(sourcePath, rawPath);
  const url = resolved ? assetUrl(resolved) : null;
  return url ? `${url}${suffix}` : safe;
}

function articleLinkUrl(raw: string, sourcePath?: string): string | null {
  const safe = safeUrl(raw);
  if (!safe) return null;
  if (/^(?:https?:|mailto:|tel:|\/\/|#)/i.test(safe)) {
    const absoluteDoc = /^\/docs\/(.+\.mdx?)([?#][\s\S]*)?$/i.exec(safe);
    if (absoluteDoc) {
      let path: string;
      try {
        path = decodeURIComponent(absoluteDoc[1]);
      } catch {
        return safe;
      }
      const routeParts = ['docs', ...path.split('/')];
      routeParts[routeParts.length - 1] = routeParts[routeParts.length - 1].replace(/\.mdx?$/i, '');
      return `/${routeParts.map(encodeURIComponent).join('/')}${absoluteDoc[2] || ''}`;
    }
    return safe;
  }

  const {path: rawPath, suffix} = splitPathAndSuffix(safe);
  const resolved = resolveSourcePath(sourcePath, rawPath);
  if (!resolved) return safe;
  const linkedAsset = assetUrl(resolved);
  if (linkedAsset) return `${linkedAsset}${suffix}`;
  if (!/\.mdx?$/i.test(resolved)) return safe;

  const routeParts = resolved.replace(/\.mdx?$/i, '').split('/');
  const route = routeParts[0].toLowerCase() === 'docs'
    ? `/docs/${routeParts.slice(1).map(encodeURIComponent).join('/')}`
    : `/${routeParts.map(encodeURIComponent).join('/')}`;
  return `${route}${suffix}`;
}

function renderText(value: string, key: React.Key): React.ReactNode {
  if (!value.includes('~~')) return value;
  const parts = value.split('~~');
  return (
    <React.Fragment key={key}>
      {parts.map((part, index) => (index % 2 === 1 ? <del key={index}>{part}</del> : part))}
    </React.Fragment>
  );
}

function collectText(node: HastNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'raw') return node.value || '';
  return (node.children || []).map((child) => collectText(child)).join('');
}

function renderNode(node: HastNode, key: React.Key, context: RenderContext): React.ReactNode {
  if (node.type === 'text') return renderText(node.value || '', key);
  if (node.type === 'raw') return node.value || null;
  if (node.type === 'comment') return null;
  if (node.type === 'root') {
    return <React.Fragment key={key}>{node.children?.map((child, index) => renderNode(child, index, context))}</React.Fragment>;
  }
  if (node.type !== 'element' || !node.tagName) return null;
  const tag = node.tagName;
  const children = node.children?.map((child, index) => renderNode(child, index, context));
  if (!ALLOWED_TAGS.has(tag)) {
    return <React.Fragment key={key}>{children}</React.Fragment>;
  }
  const properties = node.properties || {};
  const props: Record<string, unknown> = {key};
  const startLine = node.position?.start?.line;
  if (typeof startLine === 'number' && LINE_TAGS.has(tag)) props['data-line'] = context.offset + startLine;
  if (properties.className) {
    props.className = Array.isArray(properties.className) ? properties.className.join(' ') : String(properties.className);
  }
  if (properties.id) props.id = String(properties.id);
  if (properties.title) props.title = String(properties.title);
  if (properties.alt) props.alt = String(properties.alt);
  if (tag === 'a' && properties.href) {
    const href = articleLinkUrl(String(properties.href), context.sourcePath);
    if (href) {
      props.href = href;
      if (/^(?:https?:|\/\/)/i.test(href)) {
        props.target = '_blank';
        props.rel = 'noreferrer';
      }
    }
  }
  if (tag === 'img' && properties.src) {
    const src = articleImageUrl(String(properties.src), context.sourcePath);
    if (src) props.src = src;
    props.loading = 'lazy';
    props.alt = String(properties.alt || '');
  }
  if (tag === 'ol' && properties.start) props.start = Number(properties.start);
  if (tag === 'input') {
    props.type = 'checkbox';
    props.checked = Boolean(properties.checked);
    props.disabled = true;
  }
  if (tag === 'pre') {
    const codeNode = node.children?.find((child) => child.tagName === 'code');
    const language = languageFromClassName(codeNode?.properties?.className);
    const codeProps: Record<string, unknown> = {
      key: 'code',
      dangerouslySetInnerHTML: {__html: highlightToHtml(collectText(codeNode || node), language)},
    };
    if (language) codeProps.className = `language-${language}`;
    return React.createElement('pre', props, React.createElement('code', codeProps));
  }
  return React.createElement(tag, props, VOID_TAGS.has(tag) ? null : children);
}

function splitTableRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map((cell) => cell.trim());
}

type Segment =
  | {type: 'markdown'; text: string; start: number}
  | {type: 'table'; header: string[]; rows: string[][]; start: number};

function parseSegments(source: string): Segment[] {
  const lines = source.split('\n');
  const segments: Segment[] = [];
  let buffer: string[] = [];
  let bufferStart = 0;
  const flush = () => {
    if (buffer.length) {
      segments.push({type: 'markdown', text: buffer.join('\n'), start: bufferStart});
      buffer = [];
    }
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    if (
      line.includes('|') &&
      next !== undefined &&
      next.includes('|') &&
      splitTableRow(next).every((cell) => TABLE_DELIMITER.test(cell)) &&
      splitTableRow(next).length > 0
    ) {
      flush();
      const header = splitTableRow(line);
      const rows: string[][] = [];
      let cursor = index + 2;
      while (cursor < lines.length && lines[cursor].includes('|') && lines[cursor].trim() !== '') {
        rows.push(splitTableRow(lines[cursor]));
        cursor += 1;
      }
      segments.push({type: 'table', header, rows, start: index});
      index = cursor - 1;
      continue;
    }
    if (!buffer.length) bufferStart = index;
    buffer.push(line);
  }
  flush();
  return segments;
}

function renderInline(text: string, line: number, sourcePath?: string): React.ReactNode {
  if (!text.trim()) return null;
  const tree = unified().use(remarkParse).parse(text) as HastNode;
  const hast = toHast(tree) as HastNode;
  return hast.children?.map((child, index) => renderNode(child, index, {offset: Math.max(0, line - 1), sourcePath}));
}

function renderMarkdown(text: string, offset: number, sourcePath?: string): React.ReactNode {
  const tree = unified().use(remarkParse).parse(text) as HastNode;
  const hast = toHast(tree) as HastNode;
  return hast.children?.map((child, index) => renderNode(child, index, {offset, sourcePath}));
}

export function MarkdownPreview({source, className, lineOffset = 0, sourcePath, siteStyles = false}: {source: string; className?: string; lineOffset?: number; sourcePath?: string; siteStyles?: boolean}) {
  const segments = useMemo(() => parseSegments(source), [source]);
  return (
    <div className={`${siteStyles ? 'markdown' : styles.markdownPreview}${className ? ` ${className}` : ''}`}>
      {segments.map((segment, index) => {
        if (segment.type === 'table') {
          const tableLine = lineOffset + segment.start + 1;
          return (
            <table key={index} className={styles.previewTable} data-line={tableLine}>
              <thead>
                <tr data-line={tableLine}>{segment.header.map((cell, cellIndex) => <th key={cellIndex} data-line={tableLine}>{renderInline(cell, tableLine, sourcePath)}</th>)}</tr>
              </thead>
              <tbody>
                {segment.rows.map((row, rowIndex) => {
                  const rowLine = tableLine + rowIndex + 1;
                  return (
                    <tr key={rowIndex} data-line={rowLine}>{row.map((cell, cellIndex) => <td key={cellIndex} data-line={rowLine}>{renderInline(cell, rowLine, sourcePath)}</td>)}</tr>
                  );
                })}
              </tbody>
            </table>
          );
        }
        return <React.Fragment key={index}>{renderMarkdown(segment.text, lineOffset + segment.start, sourcePath)}</React.Fragment>;
      })}
    </div>
  );
}

export default MarkdownPreview;
