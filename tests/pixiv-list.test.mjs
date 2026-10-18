import assert from 'node:assert/strict';
import test from 'node:test';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

test('Pixiv bookmark list omits stale records that have no image URLs', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries([
    'PIXIV_REFRESH_TOKEN', 'GITHUB_SESSION_SECRET', 'GITHUB_REPO_OWNER',
    'GITHUB_REPO_NAME', 'CONTEXT', 'NETLIFY', 'CONSOLE_DEV_ADMIN',
  ].map((key) => [key, process.env[key]]));
  process.env.PIXIV_REFRESH_TOKEN = 'test-pixiv-refresh-token';
  process.env.GITHUB_SESSION_SECRET = 'test-session-secret-with-enough-bytes-123456';
  process.env.GITHUB_REPO_OWNER = 'local';
  process.env.GITHUB_REPO_NAME = 'local';
  process.env.CONTEXT = 'development';
  process.env.CONSOLE_DEV_ADMIN = '1';
  delete process.env.NETLIFY;

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'oauth.secure.pixiv.net') {
      return jsonResponse({response: {access_token: 'test-access-token', user: {id: 42}}});
    }
    if (url.hostname === 'app-api.pixiv.net' && url.pathname === '/v1/user/bookmarks/illust') {
      const publicItems = url.searchParams.get('restrict') === 'public';
      return jsonResponse({
        illusts: publicItems
          ? [
              {id: 1, title: 'Deleted item', user: {name: 'author'}, tags: [], image_urls: {medium: 'https://s.pximg.net/common/images/no_profile.png'}},
              {id: 2, title: 'Original only', user: {name: 'author'}, tags: [], image_urls: {original: 'https://i.pximg.net/original.jpg'}},
            ]
          : [
              {id: 3, title: 'Thumbnail item', user: {name: 'author'}, tags: [], image_urls: {medium: 'https://i.pximg.net/thumb.jpg'}},
            ],
        next_url: null,
      });
    }
    return jsonResponse({message: `Unexpected URL ${url.hostname}${url.pathname}`}, 500);
  };

  try {
    const handler = (await import('../netlify/functions/pixiv-list.mjs')).default;
    const response = await handler(new Request('https://site.test/api/pixiv-list?type=bookmarks'));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(payload.data.illusts.map((item) => item.id), [2, 3]);
    assert.equal(payload.data.illusts.some((item) => item.id === 1), false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
