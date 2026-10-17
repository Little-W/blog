import React, {useMemo} from 'react';
import unified from 'unified';
import remarkParse from 'remark-parse';
import toHast from 'mdast-util-to-hast';

import styles from '@site/src/pages/admin/styles.module.css';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children?: HastNode[];
};

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
  'pre', 'code', 'a', 'img', 'hr', 'br', 'strong', 'em', 'del', 'table',
  'thead', 'tbody', 'tr', 'th', 'td', 'input', 'span', 'sup', 'sub', 'kbd',
]);
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input']);

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

function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^(?:https?:|mailto:|tel:|\/|#|\.\/|\.\.\/)/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return value;
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

function renderNode(node: HastNode, key: React.Key): React.ReactNode {
  if (node.type === 'text') return renderText(node.value || '', key);
  if (node.type === 'raw') return node.value || null;
  if (node.type === 'comment') return null;
  if (node.type === 'root') {
    return <React.Fragment key={key}>{node.children?.map((child, index) => renderNode(child, index))}</React.Fragment>;
  }
  if (node.type !== 'element' || !node.tagName) return null;
  const tag = node.tagName;
  const children = node.children?.map((child, index) => renderNode(child, index));
  if (!ALLOWED_TAGS.has(tag)) {
    return <React.Fragment key={key}>{children}</React.Fragment>;
  }
  const properties = node.properties || {};
  const props: Record<string, unknown> = {key};
  if (properties.className) {
    props.className = Array.isArray(properties.className) ? properties.className.join(' ') : String(properties.className);
  }
  if (properties.id) props.id = String(properties.id);
  if (properties.title) props.title = String(properties.title);
  if (properties.alt) props.alt = String(properties.alt);
  if (tag === 'a' && properties.href) {
    const href = safeUrl(String(properties.href));
    if (href) {
      props.href = href;
      props.target = '_blank';
      props.rel = 'noreferrer';
    }
  }
  if (tag === 'img' && properties.src) {
    const src = safeUrl(String(properties.src));
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
  return React.createElement(tag, props, VOID_TAGS.has(tag) ? null : children);
}

function splitTableRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map((cell) => cell.trim());
}

type Segment =
  | {type: 'markdown'; text: string}
  | {type: 'table'; header: string[]; rows: string[][]};

function parseSegments(source: string): Segment[] {
  const lines = source.split('\n');
  const segments: Segment[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) {
      segments.push({type: 'markdown', text: buffer.join('\n')});
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
      segments.push({type: 'table', header, rows});
      index = cursor - 1;
      continue;
    }
    buffer.push(line);
  }
  flush();
  return segments;
}

function renderInline(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const tree = unified().use(remarkParse).parse(text) as HastNode;
  const hast = toHast(tree) as HastNode;
  return hast.children?.map((child, index) => renderNode(child, index));
}

function renderMarkdown(text: string): React.ReactNode {
  const tree = unified().use(remarkParse).parse(text) as HastNode;
  const hast = toHast(tree) as HastNode;
  return hast.children?.map((child, index) => renderNode(child, index));
}

export function MarkdownPreview({source, className}: {source: string; className?: string}) {
  const segments = useMemo(() => parseSegments(source), [source]);
  return (
    <div className={`${styles.markdownPreview}${className ? ` ${className}` : ''}`}>
      {segments.map((segment, index) => {
        if (segment.type === 'table') {
          return (
            <table key={index} className={styles.previewTable}>
              <thead>
                <tr>{segment.header.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell)}</th>)}</tr>
              </thead>
              <tbody>
                {segment.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{renderInline(cell)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          );
        }
        return <React.Fragment key={index}>{renderMarkdown(segment.text)}</React.Fragment>;
      })}
    </div>
  );
}

export default MarkdownPreview;
