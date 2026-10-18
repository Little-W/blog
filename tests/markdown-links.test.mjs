import test from 'node:test';
import assert from 'node:assert/strict';

import {fixMarkdownLinks} from '../netlify/lib/markdown-links.mjs';

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
