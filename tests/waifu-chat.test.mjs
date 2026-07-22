import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';

import handler, {
  WAIFU_OWNER_SYSTEM_PROMPT,
  WAIFU_VISITOR_SYSTEM_PROMPT,
} from '../netlify/functions/waifu-chat.mjs';

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY,
  GITHUB_SESSION_SECRET: process.env.GITHUB_SESSION_SECRET,
  GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
  GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME,
};

class MemoryStore {
  constructor({conflictOnce = false} = {}) {
    this.entries = new Map();
    this.reads = 0;
    this.writes = 0;
    this.sequence = 0;
    this.conflictOnce = conflictOnce;
  }

  async getWithMetadata(key) {
    this.reads += 1;
    const entry = this.entries.get(key);
    if (!entry) return null;
    return {data: structuredClone(entry.data), etag: entry.etag, metadata: entry.metadata};
  }

  async setJSON(key, data, options = {}) {
    this.writes += 1;
    const current = this.entries.get(key);
    if (this.conflictOnce) {
      this.conflictOnce = false;
      return {modified: false};
    }
    if (options.onlyIfNew && current) return {modified: false};
    if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return {modified: false};
    const etag = `etag-${++this.sequence}`;
    this.entries.set(key, {data: structuredClone(data), etag, metadata: options.metadata});
    return {modified: true, etag};
  }
}

function ownerCookie(userId = 42) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    login: 'Little-W',
    repository: 'Little-W/blog',
    expiresAt: Date.now() + 60 * 60 * 1000,
  })).toString('base64url');
  const signature = createHmac('sha256', process.env.GITHUB_SESSION_SECRET).update(payload).digest('base64url');
  return `blog_admin_session=${encodeURIComponent(`${payload}.${signature}`)}`;
}

function request(path, {method = 'GET', body, cookie, address = '127.0.0.1'} = {}) {
  const headers = new Headers({
    origin: 'https://blog.yusen.best',
    'x-forwarded-for': address,
  });
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new Request(`https://blog.yusen.best${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function bodyOf(response) {
  return JSON.parse(await response.text());
}

function installModelMock(log) {
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    log.push(payload);
    const system = String(payload.messages?.[0]?.content || '');
    if (system.includes('记忆管理器')) {
      return Response.json({
        model: 'Qwen/Qwen3-8B',
        choices: [{message: {content: JSON.stringify({
          summary: '用户喜欢夜间听歌，近期在编写博客。',
          profile: {
            preferredName: '小白',
            traits: ['认真'],
            interests: ['编程'],
            musicPreferences: ['夜间听日语歌'],
            communicationPreferences: ['具体回答'],
            emotionalNeeds: ['疲惫时希望先被理解'],
            importantPeople: [],
            importantEvents: [],
            currentConcerns: ['完善博客'],
          },
          episode: {summary: '继续完善博客与音乐功能。', topics: ['博客', '音乐'], emotionalTone: '专注', importance: 4},
        })}}],
      });
    }
    if (system.includes('主动陪伴')) {
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: '现在的歌很适合陪着慢慢写东西呢~'}}]});
    }
    return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: system.includes('仓库的所有者') ? '主人，我记住啦~' : '欢迎来博客逛逛~'}}]});
  };
}

test('waifu chat persistence and role prompts', async (t) => {
  process.env.SILICONFLOW_API_KEY = 'test-key';
  process.env.GITHUB_SESSION_SECRET = 'test-secret-with-at-least-thirty-two-characters';
  process.env.GITHUB_REPO_OWNER = 'Little-W';
  process.env.GITHUB_REPO_NAME = 'blog';

  await t.test('管理员和访客使用不同启动 Prompt', () => {
    assert.match(WAIFU_OWNER_SYSTEM_PROMPT, /仓库的所有者/);
    assert.match(WAIFU_OWNER_SYSTEM_PROMPT, /称呼他为“主人”/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /绝对不要称呼访客为“主人”/);
    assert.doesNotMatch(WAIFU_VISITOR_SYSTEM_PROMPT, /已通过 GitHub 验证/);
  });

  await t.test('角色 Prompt 明确博客范围和猫娘表达规则', () => {
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /个人空间/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /音乐只是其中一部分/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /不要主动背诵栏目/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /比起介绍网站，更重要的是接住用户/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /有猫耳和尾巴的猫娘女仆/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /不要句句带“喵”/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /像两个人正在连续相处/);
  });

  await t.test('访客历史和对话不读写 Blob', async () => {
    const store = new MemoryStore();
    const calls = [];
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    installModelMock(calls);

    const historyResponse = await handler(request('/api/waifu-chat/history', {address: 'guest-history'}));
    const historyPayload = await bodyOf(historyResponse);
    assert.equal(historyPayload.success, true);
    assert.equal(historyPayload.owner, false);
    assert.equal(historyPayload.persistence, 'local');
    assert.deepEqual(historyPayload.history, []);
    assert.ok(historyPayload.agent.proactiveAfterMs >= 45_000);
    assert.ok(historyPayload.agent.proactiveAfterMs <= 90_000);
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST',
      address: 'guest-chat',
      body: {message: '你好', history: [], context: {page: {title: '测试页'}}},
    }));
    const payload = await bodyOf(response);
    assert.equal(payload.owner, false);
    assert.equal(payload.persistence, 'local');
    assert.match(calls[0].messages[0].content, /当前用户是博客访客/);
    assert.equal(store.reads, 0);
    assert.equal(store.writes, 0);
  });

  await t.test('仅有效管理员 Cookie 会将对话写入 Blob', async () => {
    const store = new MemoryStore();
    const calls = [];
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    installModelMock(calls);
    const cookie = ownerCookie(42);
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST', cookie, address: 'owner-chat',
      body: {message: '记住我喜欢听歌', context: {music: {current: {title: '测试歌曲', playing: true}}}},
    }));
    const payload = await bodyOf(response);
    assert.equal(payload.owner, true);
    assert.equal(payload.persistence, 'blob');
    assert.match(calls[0].messages[0].content, /当前用户已通过 GitHub 验证/);
    const state = store.entries.get('owner/42/memory-v1.json').data;
    assert.equal(state.messages.length, 2);
    assert.deepEqual(state.messages.map((item) => item.role), ['user', 'assistant']);

    const historyResponse = await handler(request('/api/waifu-chat/history', {cookie, address: 'owner-history'}));
    const historyPayload = await bodyOf(historyResponse);
    assert.equal(historyPayload.history.length, 2);
    assert.equal(historyPayload.owner, true);
  });

  await t.test('累积对话会压缩为摘要、用户资料和重要经历', async () => {
    const store = new MemoryStore();
    const calls = [];
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    installModelMock(calls);
    const cookie = ownerCookie(77);
    for (let index = 0; index < 7; index += 1) {
      const response = await handler(request('/api/waifu-chat', {
        method: 'POST', cookie, address: 'owner-memory',
        body: {message: `第 ${index + 1} 次对话：我喜欢编程和日语歌。`},
      }));
      assert.equal(response.status, 200);
    }
    const state = store.entries.get('owner/77/memory-v1.json').data;
    assert.match(state.memory.summary, /夜间听歌/);
    assert.equal(state.memory.profile.preferredName, '小白');
    assert.deepEqual(state.memory.profile.musicPreferences, ['夜间听日语歌']);
    assert.equal(state.memory.episodes.at(-1).importance, 4);
    assert.ok(state.memory.compactedThroughSequence >= 14);
    assert.ok(calls.some((call) => call.response_format?.type === 'json_object'));
  });

  await t.test('访客不能上传本地历史', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    installModelMock([]);
    const response = await handler(request('/api/waifu-chat/sync', {
      method: 'POST', address: 'guest-sync', body: {history: [{role: 'user', content: '私有记录'}]},
    }));
    assert.equal(response.status, 401);
    assert.equal(store.writes, 0);
  });

  await t.test('主动陪伴只为管理员持久化，并在写入冲突时重试', async () => {
    const guestStore = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = guestStore;
    installModelMock([]);
    const guestResponse = await handler(request('/api/waifu-chat/proactive', {
      method: 'POST', address: 'guest-proactive', body: {context: {}},
    }));
    assert.equal(guestResponse.status, 200);
    const guestPayload = await bodyOf(guestResponse);
    assert.ok(guestPayload.agent.proactiveAfterMs >= 4 * 60_000);
    assert.ok(guestPayload.agent.proactiveAfterMs <= 8 * 60_000);
    assert.equal(guestStore.writes, 0);

    const ownerStore = new MemoryStore({conflictOnce: true});
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = ownerStore;
    const ownerResponse = await handler(request('/api/waifu-chat/proactive', {
      method: 'POST', cookie: ownerCookie(91), address: 'owner-proactive', body: {context: {}},
    }));
    assert.equal(ownerResponse.status, 200);
    assert.ok(ownerStore.writes >= 2);
    const state = ownerStore.entries.get('owner/91/memory-v1.json').data;
    assert.equal(state.messages.length, 1);
    assert.equal(state.messages[0].kind, 'proactive');
  });
});

test.after(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.__YUSEN_WAIFU_MEMORY_STORE__;
  Object.entries(originalEnvironment).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});
