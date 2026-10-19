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

test('gallery console no longer depends on GitHub write credentials', async () => {
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
  delete process.env.HF_PIC_TOKEN;
  delete process.env.GITHUB_REPO_TOKEN;
  try {
    const {default: handler} = await import('../netlify/functions/console.mjs?hf-only-credentials-test');
    const form = new FormData();
    form.set('manifest', 'not-json');
    const response = await handler(new Request('http://localhost:8888/api/console/gallery', {method: 'POST', body: form}));
    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.equal(payload.code, 'MISSING_HF_PIC_TOKEN');
  } finally {
    for (const [key, value] of [
      ['CONTEXT', previous.context], ['NETLIFY', previous.netlify], ['CONSOLE_DEV_ADMIN', previous.devAdmin],
      ['HF_PIC_TOKEN', previous.hfPicToken], ['GITHUB_REPO_TOKEN', previous.githubToken],
    ]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('gallery save reads the manifest from Hugging Face and commits it back to Hugging Face', async () => {
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
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'raw.githubusercontent.com') throw new Error('gallery data must not read from GitHub');
    events.push(url.pathname.includes('/resolve/main/gallery.json') ? 'read-hf' : url.pathname.includes('/tree/') ? 'hf-list' : url.pathname.includes('/preupload/') ? 'hf-preupload' : url.pathname.includes('/commit/') ? 'hf-commit' : `${url.hostname}${url.pathname}`);
    if (url.hostname === 'huggingface.co' && url.pathname.endsWith('/resolve/main/gallery.json')) return new Response(JSON.stringify(existingManifest), {status: 200});
    if (url.hostname === 'huggingface.co' && url.pathname.includes('/tree/')) return new Response(JSON.stringify([
      {type: 'file', path: 'albums/curated/12345678_p0.jpg'},
      {type: 'file', path: 'albums/curated/thumbs/12345678_p0.webp'},
    ]), {status: 200});
    if (url.hostname === 'huggingface.co' && url.pathname.endsWith('/preupload/main')) {
      return new Response(JSON.stringify({files: [{path: 'gallery.json', uploadMode: 'regular'}]}), {status: 200});
    }
    if (url.hostname === 'huggingface.co' && url.pathname.endsWith('/commit/main')) {
      return new Response(JSON.stringify({commitOid: 'f'.repeat(40), commitUrl: 'https://huggingface.co/datasets/Yusen/2d_pic/commit/test'}), {status: 200});
    }
    throw new Error(`Unexpected request ${url.href}`);
  };
  try {
    const {handleGalleryConsole} = await import('../netlify/lib/gallery-console.mjs?hf-only-save-test');
    const form = new FormData();
    form.set('manifest', JSON.stringify(existingManifest));
    const response = await handleGalleryConsole(new Request('https://site.test/api/console/gallery', {method: 'POST', body: form}));
    const payload = await response.json();
    assert.equal(response.status, 200, `${JSON.stringify(payload)}; events=${JSON.stringify(events)}`);
    assert.equal(payload.data.gitCommitSha, undefined);
    assert.ok(events.includes('read-hf'));
    assert.ok(events.includes('hf-list'));
    assert.ok(events.indexOf('hf-list') < events.indexOf('hf-preupload'));
    assert.ok(events.indexOf('hf-preupload') < events.indexOf('hf-commit'));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousToken === undefined) delete process.env.HF_PIC_TOKEN; else process.env.HF_PIC_TOKEN = previousToken;
    if (previousGithubToken === undefined) delete process.env.GITHUB_REPO_TOKEN; else process.env.GITHUB_REPO_TOKEN = previousGithubToken;
  }
});
