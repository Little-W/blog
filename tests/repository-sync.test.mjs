import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const datasets = [
  ['music_hq', 'static/data/music_hq.0.jsonl'],
  ['music_sq', 'static/data/music_sq.0.jsonl'],
  ['music_tag', 'static/data/music_tag.0.jsonl'],
  ['mv', 'static/data/mv.0.jsonl'],
  ['mv_bilibili', 'static/data/mv_bilibili.0.jsonl'],
  ['mv_class', 'static/data/mv_class.0.jsonl'],
  ['mv_out', 'static/data/mv_out.0.jsonl'],
];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

test('repository login sync adds missing titles and mirrors documents and music datasets to Blob', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries([
    'LOCAL_CONTENT_DIR', 'GITHUB_REPO_TOKEN', 'GITHUB_REPO_OWNER', 'GITHUB_REPO_NAME',
    'GITHUB_REPO_BRANCH', 'CONTEXT', 'NETLIFY',
  ].map((key) => [key, process.env[key]]));
  const localDir = await mkdtemp(path.join(os.tmpdir(), 'repository-sync-'));
  process.env.LOCAL_CONTENT_DIR = localDir;
  process.env.GITHUB_REPO_TOKEN = 'test-token-with-sufficient-length';
  process.env.GITHUB_REPO_OWNER = 'test-owner';
  process.env.GITHUB_REPO_NAME = 'test-repo';
  process.env.GITHUB_REPO_BRANCH = 'main';
  process.env.CONTEXT = 'development';
  delete process.env.NETLIFY;

  const contents = new Map([
    ['docs/no-title.md', '---\ntags: [test]\n---\n\n# Article Title\n\nText.\n'],
    ['blog/has-title.mdx', '---\ntitle: Kept Title\ntags: [blog]\n---\n\nBody.\n'],
    ...datasets.map(([name, filePath]) => [filePath, name === 'music_tag'
      ? '# music tags\n{"tag_id":1,"tag_order":1,"tag_name":"test","music_order":[]}\n'
      : `# dataset: ${name}\n{"name":"${name}"}\n`]),
  ]);
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  let nextSha = 1;
  let headSha = 'a'.repeat(40);
  let treeSha = 'b'.repeat(40);
  const sha = () => String(nextSha++).padStart(40, '0');
  const entriesFor = (files) => [...files.entries()].map(([filePath, content]) => {
    const blobSha = sha();
    blobs.set(blobSha, content);
    return {path: filePath, mode: '100644', type: 'blob', sha: blobSha};
  });
  trees.set(treeSha, entriesFor(contents));
  commits.set(headSha, {tree: {sha: treeSha}});

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const apiPath = url.pathname.replace('/repos/test-owner/test-repo', '');
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : null;

    if (apiPath === '/git/ref/heads/main' && method === 'GET') {
      return jsonResponse({object: {sha: headSha}});
    }
    const commitMatch = /^\/git\/commits\/([0-9a-f]+)$/.exec(apiPath);
    if (commitMatch && method === 'GET') return jsonResponse(commits.get(commitMatch[1]) || {}, commits.has(commitMatch[1]) ? 200 : 404);
    const treeMatch = /^\/git\/trees\/([0-9a-f]+)$/.exec(apiPath);
    if (treeMatch && method === 'GET') return jsonResponse({tree: trees.get(treeMatch[1]) || []});
    const blobMatch = /^\/git\/blobs\/([0-9a-f]+)$/.exec(apiPath);
    if (blobMatch && method === 'GET') {
      const content = blobs.get(blobMatch[1]);
      return content === undefined
        ? jsonResponse({message: 'not found'}, 404)
        : jsonResponse({encoding: 'base64', content: Buffer.from(content).toString('base64')});
    }
    if (apiPath === '/git/blobs' && method === 'POST') {
      const content = body.encoding === 'base64' ? Buffer.from(body.content, 'base64').toString() : body.content;
      const blobSha = sha();
      blobs.set(blobSha, content);
      return jsonResponse({sha: blobSha});
    }
    if (apiPath === '/git/trees' && method === 'POST') {
      const updated = new Map((trees.get(body.base_tree) || []).map((entry) => [entry.path, entry]));
      for (const entry of body.tree) {
        if (entry.sha === null) updated.delete(entry.path);
        else updated.set(entry.path, entry);
      }
      treeSha = sha();
      trees.set(treeSha, [...updated.values()]);
      return jsonResponse({sha: treeSha});
    }
    if (apiPath === '/git/commits' && method === 'POST') {
      headSha = sha();
      commits.set(headSha, {tree: {sha: body.tree}});
      return jsonResponse({sha: headSha, html_url: `https://github.com/test-owner/test-repo/commit/${headSha}`});
    }
    if (apiPath === '/git/refs/heads/main' && method === 'PATCH') {
      headSha = body.sha;
      return jsonResponse({object: {sha: headSha}});
    }
    return jsonResponse({message: `Unexpected ${method} ${apiPath}`}, 500);
  };

  try {
    const {syncRepositoryContentToBlob} = await import('../netlify/functions/console.mjs');
    const result = await syncRepositoryContentToBlob({force: true});
    const {readContent} = await import('../netlify/lib/content-store.mjs');
    const article = await readContent('content/docs/no-title.md');
    const preserved = await readContent('content/blog/has-title.mdx');
    const music = await readContent('music/music_tag.0.jsonl');
    const index = await readContent('content/_index.json', {type: 'json'});

    assert.equal(result.titlesAdded, 1);
    assert.equal(result.datasetCount, datasets.length);
    assert.match(article, /^---\ntitle: "Article Title"\ntags: \[test\]/);
    assert.match(preserved, /^---\ntitle: Kept Title/);
    assert.match(music, /"tag_name":"test"/);
    assert.equal(index.articles.length, 2);
    assert.equal(headSha !== 'a'.repeat(40), true, 'title metadata should be committed to the repository');

    const {deleteContent} = await import('../netlify/lib/content-store.mjs');
    await deleteContent('music/music_tag.0.jsonl');
    process.env.NETLIFY = 'true';
    const musicHandler = (await import('../netlify/functions/music.mjs')).default;
    const response = await musicHandler(new Request('https://example.test/api/music/tags'));
    const musicPayload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(musicPayload.success, true, 'missing Blob music data should be hydrated from GitHub on demand');
    assert.equal(musicPayload.data.tags[0].tag_name, 'test');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(localDir, {recursive: true, force: true});
  }
});
