import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof URL ? input.href : typeof input === 'string' ? input : input.url);
  if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.jsonl')) {
    const filename = path.basename(url.pathname);
    try {
      const content = await readFile(path.join(repositoryRoot, 'static', 'data', filename));
      return new Response(content, {status: 200, headers: {'content-type': 'application/x-ndjson'}});
    } catch {
      return new Response('missing', {status: 404});
    }
  }
  return originalFetch(input, init);
};

const {default: musicHandler} = await import('../netlify/functions/music.mjs');

async function payload(response) {
  return {status: response.status, body: await response.json()};
}

function post(body) {
  return musicHandler(new Request('https://blog.example/api/music/tracks', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
  }));
}

test('返回标签和指定歌单，而不是完整音乐表', async () => {
  const tags = await payload(await musicHandler(new Request('https://blog.example/api/music/tags')));
  assert.equal(tags.status, 200);
  assert.equal(tags.body.success, true);
  assert.ok(tags.body.data.tags.length > 1);

  const tracks = await payload(await post({quality: 'hq', listId: 2}));
  assert.equal(tracks.status, 200);
  assert.equal(tracks.body.data.records.length, tracks.body.data.playlistIds.length);
  assert.ok(tracks.body.data.records.length < tracks.body.data.totalLibrary);
});

test('搜索结果按页限制并返回匹配总数', async () => {
  const result = await payload(await post({quality: 'hq', query: '-', page: 0, pageSize: 25}));
  assert.equal(result.status, 200);
  assert.equal(result.body.data.records.length, 25);
  assert.equal(result.body.data.pageSize, 25);
  assert.ok(result.body.data.totalMatches > result.body.data.records.length);
});

test('拒绝非对象请求和过多原始编号', async () => {
  const nullBody = await payload(await musicHandler(new Request('https://blog.example/api/music/tracks', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: 'null',
  })));
  assert.equal(nullBody.status, 400);
  assert.equal(nullBody.body.code, 'INVALID_REQUEST');

  const tooManyIds = await payload(await post({ids: Array(5001).fill(1)}));
  assert.equal(tooManyIds.status, 400);
  assert.equal(tooManyIds.body.code, 'INVALID_TRACK_IDS');
});
