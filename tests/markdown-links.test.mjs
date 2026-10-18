import test from 'node:test';
import assert from 'node:assert/strict';

import {fixMarkdownLinks, normalizeLatexDelimiters} from '../netlify/lib/markdown-links.mjs';

test('rewrites relative Markdown links to extensionless Docusaurus routes', () => {
  const source = [
    '[same folder](./导读.md#overview)',
    '[parent](../guide%20one.mdx?mode=full)',
    '[root path](/docs/notes/other.md)',
    '[external](https://example.com/guide.md)',
    '[anchor](#details)',
  ].join('\n');

  assert.equal(
    fixMarkdownLinks(source, 'docs/notes/formal/article.md'),
    [
      '[same folder](/docs/notes/formal/%E5%AF%BC%E8%AF%BB#overview)',
      '[parent](/docs/notes/guide%20one?mode=full)',
      '[root path](/docs/notes/other)',
      '[external](https://example.com/guide.md)',
      '[anchor](#details)',
    ].join('\n'),
  );
});

test('repairs reference-style and HTML links without touching non-Markdown assets', () => {
  const source = [
    '[reference][guide]',
    '[guide]: ./guide.md "Guide"',
    '<a href="../next.mdx">next</a>',
    '[pdf](./spec.pdf)',
  ].join('\n');

  assert.equal(
    fixMarkdownLinks(source, 'docs/notes/section/article.md'),
    [
      '[reference][guide]',
      '[guide]: /docs/notes/section/guide "Guide"',
      '<a href="/docs/notes/next">next</a>',
      '[pdf](./spec.pdf)',
    ].join('\n'),
  );
});

test('normalizes LaTeX delimiters for static rendering while preserving code spans and fences', () => {
  const source = [
    String.raw`inline \(x^2 + y^2\)`,
    String.raw`\[`,
    String.raw`\frac{a}{b} = c`,
    String.raw`\]`,
    'code: `\\(keep\\)`',
    '```tex',
    String.raw`\[keep\]`,
    '```',
  ].join('\n');

  assert.equal(
    normalizeLatexDelimiters(source),
    [
      String.raw`inline $x^2 + y^2$`,
      '$$',
      String.raw`\frac{a}{b} = c`,
      '$$',
      'code: `\\(keep\\)`',
      '```tex',
      String.raw`\[keep\]`,
      '```',
    ].join('\n'),
  );
});
