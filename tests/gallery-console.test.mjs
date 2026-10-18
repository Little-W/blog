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
