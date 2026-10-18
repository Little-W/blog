import React, {useMemo} from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import Heading from '@theme/Heading';
import MDXUl from '@theme/MDXComponents/Ul';
import GithubSlugger from 'github-slugger';
import unified from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import toHast from 'mdast-util-to-hast';
import katex from 'katex';
import 'katex/dist/katex.min.css';

import {highlightToHtml, languageFromClassName, registerCodeLanguages} from './codeHighlight';
import styles from '@site/src/pages/admin/styles.module.css';

registerCodeLanguages();

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
  position?: {start?: {line?: number}};
};

type RenderContext = {offset: number; sourcePath?: string; siteStyles?: boolean; slugger?: GithubSlugger};

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

function normalizeMathBlock(source: string): string {
  const codeSpans: string[] = [];
  const protectedSource = source.replace(/(`+)[\s\S]*?\1/g, (code) => {
    const marker = `\uE000MATH_CODE_${codeSpans.length}\uE001`;
    codeSpans.push(code);
    return marker;
  });
  return protectedSource
    .replace(/\\\[([\s\S]+?)\\\]/g, (_match, formula: string) => `$$\n${formula.trim()}\n$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_match, formula: string) => `$${formula}$`)
    .replace(/\uE000MATH_CODE_(\d+)\uE001/g, (_match, index: string) => codeSpans[Number(index)]);
}

function normalizeMathDelimiters(source: string): string {
  const output: string[] = [];
  let plain: string[] = [];
  let fenceChar = '';
  let fenceLength = 0;
  const flush = () => {
    if (plain.length) output.push(normalizeMathBlock(plain.join('\n')));
    plain = [];
  };

  for (const line of String(source || '').split('\n')) {
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceChar) {
      output.push(line);
      if (fence && fence[1][0] === fenceChar && fence[1].length >= fenceLength) {
        fenceChar = '';
        fenceLength = 0;
      }
      continue;
    }
    if (fence) {
      flush();
      fenceChar = fence[1][0];
      fenceLength = fence[1].length;
      output.push(line);
      continue;
    }
    if (/^(?: {4,}|\t)/.test(line)) {
      flush();
      output.push(line);
      continue;
    }
    plain.push(line);
  }
  flush();
  return output.join('\n');
}

function toHastWithMath(source: string): HastNode {
  const tree = unified().use(remarkParse).use(remarkMath).parse(normalizeMathDelimiters(source));
  return toHast(tree, {
    handlers: {
      math: (_h: unknown, node: {value?: string}) => ({
        type: 'element',
        tagName: 'div',
        properties: {'data-latex': node.value || ''},
        children: [],
      }),
      inlineMath: (_h: unknown, node: {value?: string}) => ({
        type: 'element',
        tagName: 'span',
        properties: {'data-latex': node.value || ''},
        children: [],
      }),
    },
  }) as HastNode;
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
  const properties = node.properties || {};
  const latex = properties['data-latex'];
  if (typeof latex === 'string') {
    const displayMode = tag === 'div';
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
    });
    return React.createElement(displayMode ? 'div' : 'span', {
      key,
      className: displayMode ? 'math math-display' : 'math math-inline',
      dangerouslySetInnerHTML: {__html: html},
    });
  }
  const children = node.children?.map((child, index) => renderNode(child, index, context));
  if (!ALLOWED_TAGS.has(tag)) {
    return <React.Fragment key={key}>{children}</React.Fragment>;
  }
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
      if (/^\/(?:docs|blog)\//i.test(href)) {
        const linkProps = {...props, to: href};
        delete linkProps.href;
        return React.createElement(Link, linkProps, children);
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
    if (context.siteStyles) {
      const codeClassName = codeNode?.properties?.className;
      const codeClass = Array.isArray(codeClassName) ? codeClassName.join(' ') : String(codeClassName || '');
      const codeProperties = codeNode?.properties || {};
      return React.createElement(CodeBlock, {
        className: codeClass || undefined,
        language: language || undefined,
        metastring: typeof codeProperties.metastring === 'string' ? codeProperties.metastring : undefined,
        title: typeof codeProperties.title === 'string' ? codeProperties.title : undefined,
      }, collectText(codeNode || node));
    }
    const codeProps: Record<string, unknown> = {
      key: 'code',
      dangerouslySetInnerHTML: {__html: highlightToHtml(collectText(codeNode || node), language)},
    };
    if (language) codeProps.className = `language-${language}`;
    return React.createElement('pre', props, React.createElement('code', codeProps));
  }
  if (context.siteStyles && /^h[2-6]$/.test(tag)) {
    const id = String(properties.id || context.slugger?.slug(collectText(node).trim()) || '');
    return React.createElement(Heading as React.ComponentType<any>, {...props, as: tag, id}, children);
  }
  if (context.siteStyles && tag === 'h1') {
    return React.createElement(Heading as React.ComponentType<any>, {...props, as: tag, id: undefined}, children);
  }
  if (context.siteStyles && tag === 'ul') {
    return React.createElement(MDXUl as React.ComponentType<any>, props, children);
  }
  return React.createElement(tag, props, VOID_TAGS.has(tag) ? null : children);
}

function splitTableRow(line: string): string[] {
  const value = line.trim();
  const cells: string[] = [];
  let cell = '';
  let codeTicks = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '\\' && index + 1 < value.length) {
      cell += char + value[index + 1];
      index += 1;
      continue;
    }
    if (char === '`') {
      let end = index + 1;
      while (value[end] === '`') end += 1;
      const ticks = end - index;
      if (!codeTicks) codeTicks = ticks;
      else if (ticks === codeTicks) codeTicks = 0;
      cell += value.slice(index, end);
      index = end - 1;
      continue;
    }
    if (char === '|' && !codeTicks) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  if (value.startsWith('|')) cells.shift();
  if (value.endsWith('|') && !value.endsWith('\\|')) cells.pop();
  return cells;
}

type Segment =
  | {type: 'markdown'; text: string; start: number}
  | {type: 'table'; header: string[]; rows: string[][]; start: number};

function parseSegments(source: string): Segment[] {
  const lines = source.split('\n');
  const segments: Segment[] = [];
  let buffer: string[] = [];
  let bufferStart = 0;
  let fenceChar = '';
  let fenceLength = 0;
  const flush = () => {
    if (buffer.length) {
      segments.push({type: 'markdown', text: buffer.join('\n'), start: bufferStart});
      buffer = [];
    }
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceChar) {
      if (!buffer.length) bufferStart = index;
      buffer.push(line);
      if (fence && fence[1][0] === fenceChar && fence[1].length >= fenceLength) {
        fenceChar = '';
        fenceLength = 0;
      }
      continue;
    }
    if (fence) {
      if (!buffer.length) bufferStart = index;
      buffer.push(line);
      fenceChar = fence[1][0];
      fenceLength = fence[1].length;
      continue;
    }
    if (
      !/^(?: {4,}|\t)/.test(line) &&
      line.includes('|') &&
      next !== undefined &&
      next.includes('|') &&
      !/^(?: {4,}|\t)/.test(next) &&
      splitTableRow(line).length > 0 &&
      splitTableRow(line).length === splitTableRow(next).length &&
      splitTableRow(next).every((cell) => TABLE_DELIMITER.test(cell))
    ) {
      flush();
      const header = splitTableRow(line);
      const rows: string[][] = [];
      let cursor = index + 2;
      while (cursor < lines.length && lines[cursor].includes('|') && lines[cursor].trim() !== '' && !/^(?: {4,}|\t)/.test(lines[cursor])) {
        const row = splitTableRow(lines[cursor]);
        if (row.length !== header.length) break;
        rows.push(row);
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

function renderInline(text: string, line: number, context: RenderContext): React.ReactNode {
  if (!text.trim()) return null;
  const hast = toHastWithMath(text);
  const inlineNodes = (hast.children || []).flatMap((child) => (
    child.tagName === 'p' ? child.children || [] : [child]
  ));
  return inlineNodes.map((child, index) => renderNode(child, index, {...context, offset: Math.max(0, line - 1)}));
}

function renderMarkdown(text: string, offset: number, context: RenderContext): React.ReactNode {
  const hast = toHastWithMath(text);
  return hast.children?.map((child, index) => renderNode(child, index, {...context, offset}));
}

export function MarkdownPreview({source, className, lineOffset = 0, sourcePath, siteStyles = false}: {source: string; className?: string; lineOffset?: number; sourcePath?: string; siteStyles?: boolean}) {
  const segments = useMemo(() => parseSegments(source), [source]);
  const slugger = siteStyles ? new GithubSlugger() : undefined;
  const context: RenderContext = {offset: 0, sourcePath, siteStyles, slugger};
  return (
    <div className={`${siteStyles ? 'markdown' : styles.markdownPreview}${className ? ` ${className}` : ''}`}>
      {segments.map((segment, index) => {
        if (segment.type === 'table') {
          const tableLine = lineOffset + segment.start + 1;
          return (
            <table key={index} className={siteStyles ? undefined : styles.previewTable} data-line={tableLine}>
              <thead>
                <tr data-line={tableLine}>{segment.header.map((cell, cellIndex) => <th key={cellIndex} data-line={tableLine}>{renderInline(cell, tableLine, context)}</th>)}</tr>
              </thead>
              <tbody>
                {segment.rows.map((row, rowIndex) => {
                  const rowLine = tableLine + rowIndex + 1;
                  return (
                    <tr key={rowIndex} data-line={rowLine}>{row.map((cell, cellIndex) => <td key={cellIndex} data-line={rowLine}>{renderInline(cell, rowLine, context)}</td>)}</tr>
                  );
                })}
              </tbody>
            </table>
          );
        }
        return <React.Fragment key={index}>{renderMarkdown(segment.text, lineOffset + segment.start, context)}</React.Fragment>;
      })}
    </div>
  );
}

export default MarkdownPreview;
