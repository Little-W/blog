import assert from 'node:assert/strict';
import test from 'node:test';

test('gallery console rejects writes without an administrator session', async () => {
  const previous = {
    context: process.env.CONTEXT,
    netlify: process.env.NETLIFY,
    devAdmin: process.env.CONSOLE_DEV_ADMIN,
  };
  process.env.CONTEXT = 'production';
  process.env.NETLIFY = 'true';
  delete process.env.CONSOLE_DEV_ADMIN;
  try {
    const {default: handler} = await import('../netlify/functions/console.mjs?unauthorized-test');
    const response = await handler(new Request('https://site.test/api/console/gallery', {method: 'POST'}));
    assert.equal(response.status, 401);
  } finally {
    if (previous.context === undefined) delete process.env.CONTEXT; else process.env.CONTEXT = previous.context;
    if (previous.netlify === undefined) delete process.env.NETLIFY; else process.env.NETLIFY = previous.netlify;
    if (previous.devAdmin === undefined) delete process.env.CONSOLE_DEV_ADMIN; else process.env.CONSOLE_DEV_ADMIN = previous.devAdmin;
  }
});

test('gallery console explains that write access requires HF_PIC_TOKEN', async () => {
  const previous = {
    context: process.env.CONTEXT,
    netlify: process.env.NETLIFY,
    devAdmin: process.env.CONSOLE_DEV_ADMIN,
    hfPicToken: process.env.HF_PIC_TOKEN,
  };
  process.env.CONTEXT = 'dev';
  delete process.env.NETLIFY;
  process.env.CONSOLE_DEV_ADMIN = '1';
  delete process.env.HF_PIC_TOKEN;
  try {
    const {default: handler} = await import('../netlify/functions/console.mjs?token-required-test');
    const form = new FormData();
    form.set('manifest', JSON.stringify({albums: []}));
    const response = await handler(new Request('http://localhost:8888/api/console/gallery', {method: 'POST', body: form}));
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(payload.code, 'MISSING_HF_PIC_TOKEN');
    assert.match(payload.message, /HF_PIC_TOKEN/);
  } finally {
    for (const [key, value] of [
      ['CONTEXT', previous.context], ['NETLIFY', previous.netlify], ['CONSOLE_DEV_ADMIN', previous.devAdmin],
      ['HF_PIC_TOKEN', previous.hfPicToken],
    ]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('gallery console requires GitHub write credentials before updating either repository', async () => {
  const previous = {
    context: process.env.CONTEXT,
    netlify: process.env.NETLIFY,
    devAdmin: process.env.CONSOLE_DEV_ADMIN,
    hfPicToken: process.env.HF_PIC_TOKEN,
    githubToken: process.env.GITHUB_REPO_TOKEN,
  };
  process.env.CONTEXT = 'dev';
  delete process.env.NETLIFY;
  process.env.CONSOLE_DEV_ADMIN = '1';
  process.env.HF_PIC_TOKEN = 'hf_test-pic-token';
  delete process.env.GITHUB_REPO_TOKEN;
  try {
    const {default: handler} = await import('../netlify/functions/console.mjs?github-token-required-test');
    const form = new FormData();
    form.set('manifest', 'not-json');
    const response = await handler(new Request('http://localhost:8888/api/console/gallery', {method: 'POST', body: form}));
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(payload.code, 'MISSING_GITHUB_REPO_TOKEN');
  } finally {
    for (const [key, value] of [
      ['CONTEXT', previous.context], ['NETLIFY', previous.netlify], ['CONSOLE_DEV_ADMIN', previous.devAdmin],
      ['HF_PIC_TOKEN', previous.hfPicToken], ['GITHUB_REPO_TOKEN', previous.githubToken],
    ]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('gallery manifest synchronization writes its dynamic config to the GitHub repository', async () => {
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.GITHUB_REPO_TOKEN;
  const previousOwner = process.env.GITHUB_REPO_OWNER;
  const previousRepo = process.env.GITHUB_REPO_NAME;
  const previousBranch = process.env.GITHUB_REPO_BRANCH;
  const requests = [];
  process.env.GITHUB_REPO_TOKEN = 'test-repo-token-for-unit-tests';
  process.env.GITHUB_REPO_OWNER = 'Little-W';
  process.env.GITHUB_REPO_NAME = 'blog';
  process.env.GITHUB_REPO_BRANCH = 'main';
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({url: url.pathname, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null});
    if (url.pathname.endsWith('/git/ref/heads/main')) return new Response(JSON.stringify({object: {sha: 'a'.repeat(40)}}));
    if (url.pathname.endsWith(`/git/commits/${'a'.repeat(40)}`)) return new Response(JSON.stringify({tree: {sha: 'b'.repeat(40)}}));
    if (url.pathname.endsWith(`/git/trees/${'b'.repeat(40)}`)) return new Response(JSON.stringify({tree: []}));
    if (url.pathname.endsWith('/git/blobs')) return new Response(JSON.stringify({sha: 'c'.repeat(40)}));
    if (url.pathname.endsWith('/git/trees')) return new Response(JSON.stringify({sha: 'd'.repeat(40)}));
    if (url.pathname.endsWith('/git/commits')) return new Response(JSON.stringify({sha: 'e'.repeat(40)}));
    if (url.pathname.endsWith('/git/refs/heads/main')) return new Response(JSON.stringify({ref: 'refs/heads/main'}));
    throw new Error(`Unexpected GitHub request ${url.pathname}`);
  };
  try {
    const {syncGalleryManifestToGitHub} = await import('../netlify/functions/console.mjs?gallery-sync-test');
    const result = await syncGalleryManifestToGitHub('{"version":1,"albums":[]}\n');
    const blobRequest = requests.find((request) => request.url.endsWith('/git/blobs'));
    const treeRequest = requests.find((request) => request.url.endsWith('/git/trees') && request.method === 'POST');
    assert.equal(result.commitSha, 'e'.repeat(40));
    assert.equal(blobRequest.body.content, '{"version":1,"albums":[]}\n');
    assert.equal(treeRequest.body.tree[0].path, 'data/gallery.json');
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.GITHUB_REPO_TOKEN; else process.env.GITHUB_REPO_TOKEN = previousToken;
    if (previousOwner === undefined) delete process.env.GITHUB_REPO_OWNER; else process.env.GITHUB_REPO_OWNER = previousOwner;
    if (previousRepo === undefined) delete process.env.GITHUB_REPO_NAME; else process.env.GITHUB_REPO_NAME = previousRepo;
    if (previousBranch === undefined) delete process.env.GITHUB_REPO_BRANCH; else process.env.GITHUB_REPO_BRANCH = previousBranch;
  }
});

test('gallery save syncs config to GitHub and then commits the manifest to Hugging Face', async () => {
  const originalFetch = globalThis.fetch;
  const previousToken = process.env.HF_PIC_TOKEN;
  const previousGithubToken = process.env.GITHUB_REPO_TOKEN;
  process.env.HF_PIC_TOKEN = 'hf_test-pic-token';
  process.env.GITHUB_REPO_TOKEN = 'test-github-repo-token';
  const events = [];
  const existingManifest = {
    version: 1,
    updatedAt: '2026-10-18T00:00:00Z',
    albums: [{
      id: 'curated',
      title: '精选插画',
      description: '',
      tags: [],
      items: [{
        id: '12345678', pixivId: '12345678', title: '作品', author: '作者', description: '',
        tags: ['原创'], pixivUrl: 'https://www.pixiv.net/artworks/12345678',
        image: 'albums/curated/12345678_p0.jpg',
        thumbnail: 'albums/curated/thumbs/12345678_p0.webp',
      }],
    }],
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    events.push(url.hostname === 'raw.githubusercontent.com' ? 'read-github' : url.pathname.includes('/preupload/') ? 'hf-preupload' : url.pathname.includes('/commit/') ? 'hf-commit' : `${url.hostname}${url.pathname}`);
    if (url.hostname === 'raw.githubusercontent.com') return new Response(JSON.stringify(existingManifest), {status: 200});
    if (url.hostname === 'huggingface.co' && url.pathname.endsWith('/preupload/main')) {
      return new Response(JSON.stringify({files: [{path: 'gallery.json', uploadMode: 'regular'}]}), {status: 200});
    }
    if (url.hostname === 'huggingface.co' && url.pathname.endsWith('/commit/main')) {
      return new Response(JSON.stringify({commitOid: 'f'.repeat(40), commitUrl: 'https://huggingface.co/datasets/Yusen/2d_pic/commit/test'}), {status: 200});
    }
    throw new Error(`Unexpected request ${url.href}`);
  };
  try {
    const {handleGalleryConsole} = await import('../netlify/lib/gallery-console.mjs?dual-repo-save-test');
    const form = new FormData();
    form.set('manifest', JSON.stringify(existingManifest));
    const response = await handleGalleryConsole(new Request('https://site.test/api/console/gallery', {method: 'POST', body: form}), async () => {
      events.push('sync-github');
      return {commitSha: 'a'.repeat(40)};
    });
    const payload = await response.json();
    assert.equal(response.status, 200, `${JSON.stringify(payload)}; events=${JSON.stringify(events)}`);
    assert.equal(payload.data.gitCommitSha, 'a'.repeat(40));
    assert.ok(events.indexOf('sync-github') < events.indexOf('hf-preupload'));
    assert.ok(events.indexOf('hf-preupload') < events.indexOf('hf-commit'));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.HF_PIC_TOKEN; else process.env.HF_PIC_TOKEN = previousToken;
    if (previousGithubToken === undefined) delete process.env.GITHUB_REPO_TOKEN; else process.env.GITHUB_REPO_TOKEN = previousGithubToken;
  }
});
