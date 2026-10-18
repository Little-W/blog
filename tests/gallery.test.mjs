import assert from 'node:assert/strict';
import test from 'node:test';

test('gallery API validates Hugging Face paths and returns tagged image URLs', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url.href);
    if (url.hostname !== 'hf-mirror.com') return new Response('', {status: 404});
    return new Response(JSON.stringify({
      version: 1,
      updatedAt: '2026-10-18T00:00:00Z',
      albums: [{
        id: 'pixiv-favorites-test',
        title: 'Pixiv 收藏测试图集',
        tags: ['Pixiv', '测试'],
        items: [{
          pixivId: '12345678',
          title: '测试插画',
          author: '作者',
          tags: ['原创', '夜景'],
          image: 'albums/pixiv-favorites-test/12345678_p0.jpg',
          thumbnail: 'albums/pixiv-favorites-test/thumbs/12345678_p0.webp',
        }, {
          pixivId: '126432381',
          title: '通知-QQ群 bot新增了绘图功能',
          tags: ['猫耳'],
          image: 'albums/pixiv-favorites-test/126432381_p0.png',
        }, {
          pixivId: '87654321',
          title: '成人向作品',
          tags: ['R-18'],
          image: 'albums/pixiv-favorites-test/87654321_p0.jpg',
        }, {
          pixivId: '87654322',
          title: '梗图',
          tags: ['meme'],
          image: 'albums/pixiv-favorites-test/87654322_p0.jpg',
        }, {
          pixivId: '87654323',
          title: 'Genshin Impact',
          tags: ['原神', 'Genshin Impact'],
          image: 'albums/pixiv-favorites-test/87654323_p0.jpg',
        }, {
          pixivId: '87654324',
          title: '内衣图',
          tags: ['白丝', 'タイツ越しのパンツ'],
          image: 'albums/pixiv-favorites-test/87654324_p0.jpg',
        }, {
          pixivId: '122306089',
          title: 'ホシノ',
          tags: ['小鳥遊ホシノ', 'ポンタイタチ'],
          image: 'albums/pixiv-favorites-test/122306089_p0.png',
        }, {
          pixivId: '125340293',
          title: 'プラナのダンストレーニング',
          tags: ['マイクロビキニ', 'ロリ'],
          image: 'albums/pixiv-favorites-test/125340293_p0.jpg',
        }],
      }],
    }), {status: 200, headers: {'content-type': 'application/json'}});
  };
  try {
    const {default: handler} = await import('../netlify/functions/gallery.mjs');
    const response = await handler(new Request('https://site.test/api/gallery'));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(requested.length, 3);
    assert.equal(new URL(requested[0]).hostname, 'raw.githubusercontent.com');
    assert.deepEqual(payload.data.albums[0].items[0].tags, ['原创', '夜景']);
    assert.equal(payload.data.albums[0].items[0].pixivUrl, 'https://www.pixiv.net/artworks/12345678');
    assert.equal(payload.data.albums[0].items.length, 1);
    assert.equal(payload.data.albums[0].items[0].image, 'https://huggingface.co/datasets/Yusen/2d_pic/resolve/main/albums/pixiv-favorites-test/12345678_p0.jpg?v=2026-10-18T00%3A00%3A00Z');
    assert.equal(payload.data.albums[0].items[0].fallbackImage, 'https://hf-mirror.com/datasets/Yusen/2d_pic/resolve/main/albums/pixiv-favorites-test/12345678_p0.jpg?v=2026-10-18T00%3A00%3A00Z');
    assert.equal(payload.data.albums[0].items[0].thumbnailProxy, '/api/gallery/image?path=albums%2Fpixiv-favorites-test%2Fthumbs%2F12345678_p0.webp&v=2026-10-18T00%3A00%3A00Z');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('gallery API rejects paths that leave the image repository', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    albums: [{
      id: 'test',
      title: 'Test',
      items: [{pixivId: '1', image: 'albums/test/../../private.jpg'}],
    }],
  }), {status: 200, headers: {'content-type': 'application/json'}});
  try {
    const {default: handler} = await import('../netlify/functions/gallery.mjs');
    const response = await handler(new Request('https://site.test/api/gallery'));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(payload.data.albums[0].items, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('gallery API dynamically prefers the GitHub repository manifest', async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    assert.equal(url.hostname, 'raw.githubusercontent.com');
    assert.equal(url.pathname, '/Little-W/blog/main/data/gallery.json');
    return new Response(JSON.stringify({
      version: 1,
      updatedAt: '2026-10-19T01:02:03Z',
      albums: [{
        id: 'curated',
        title: '精选插画',
        items: [{pixivId: '12345678', title: '作品', tags: ['原创'], image: 'albums/curated/12345678_p0.jpg'}],
      }],
    }), {status: 200, headers: {'content-type': 'application/json'}});
  };
  try {
    const {default: handler} = await import('../netlify/functions/gallery.mjs?github-manifest-test');
    const response = await handler(new Request('https://site.test/api/gallery'));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.albums[0].items.length, 1);
    assert.match(payload.data.albums[0].items[0].proxyImage, /v=2026-10-19T01%3A02%3A03Z/);
    assert.equal(requested.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('same-origin image proxy probes mirrors and streams the fastest HF source', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method || 'GET';
    requests.push({host: url.hostname, method});
    if (method === 'HEAD') {
      await new Promise((resolve) => setTimeout(resolve, url.hostname === 'hf-mirror.com' ? 2 : 35));
      return new Response(null, {status: 200});
    }
    return new Response(new Uint8Array([1, 2, 3, 4]), {status: 200, headers: {'content-type': 'image/webp'}});
  };
  try {
    const {default: handler} = await import('../netlify/functions/gallery.mjs');
    const response = await handler(new Request('https://site.test/api/gallery/image?path=albums/pixiv-favorites-test/thumbs/1.webp'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3, 4]);
    assert.equal(requests.slice(0, 2).every((request) => request.method === 'HEAD'), true);
    assert.equal(requests.at(-1).host, 'hf-mirror.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('thumbnail proxy retries the alternate mirror when the first image stream is incomplete', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method || 'GET';
    requests.push({host: url.hostname, method});
    if (method === 'HEAD') {
      await new Promise((resolve) => setTimeout(resolve, url.hostname === 'huggingface.co' ? 1 : 20));
      return new Response(null, {status: 200});
    }
    if (url.hostname === 'huggingface.co') {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.error(new Error('incomplete upstream body'));
        },
      }), {status: 200, headers: {'content-type': 'image/webp'}});
    }
    return new Response(new Uint8Array([9, 8, 7, 6]), {status: 200, headers: {'content-type': 'image/webp'}});
  };
  try {
    const {default: handler} = await import('../netlify/functions/gallery.mjs?thumbnail-fallback-test');
    const response = await handler(new Request('https://site.test/api/gallery/image?path=albums/pixiv-favorites-test/thumbs/2.webp'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-length'), '4');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [9, 8, 7, 6]);
    assert.deepEqual(requests.filter((request) => request.method === 'GET').map((request) => request.host), ['huggingface.co', 'hf-mirror.com']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('image proxy buffers normal-size originals and retries a truncated upstream stream', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method || 'GET';
    requests.push({host: url.hostname, method});
    if (method === 'HEAD') {
      await new Promise((resolve) => setTimeout(resolve, url.hostname === 'huggingface.co' ? 1 : 20));
      return new Response(null, {status: 200});
    }
    if (url.hostname === 'huggingface.co') {
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.error(new Error('truncated original body'));
        },
      }), {status: 200, headers: {'content-type': 'image/jpeg', 'content-length': '4'}});
    }
    return new Response(new Uint8Array([8, 9, 10, 11]), {status: 200, headers: {'content-type': 'image/jpeg'}});
  };
  try {
    const {default: handler} = await import('../netlify/functions/gallery.mjs?original-fallback-test');
    const response = await handler(new Request('https://site.test/api/gallery/image?path=albums/pixiv-favorites-test/1.jpg'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-length'), '4');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [8, 9, 10, 11]);
    assert.deepEqual(requests.filter((request) => request.method === 'GET').map((request) => request.host), ['huggingface.co', 'hf-mirror.com']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
