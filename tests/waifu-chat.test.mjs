import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';

import handler, {
  WAIFU_OWNER_SYSTEM_PROMPT,
  WAIFU_RESPONSE_STYLE_REMINDER,
  WAIFU_TOOL_DEFINITIONS,
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
          summary: '她喜欢夜间听歌，近期在编写博客。',
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
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: JSON.stringify({speak: true, text: '现在的歌很适合陪着慢慢写东西呢~'})}}]});
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
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /“好的喵～”“是这样喵”“我记住了喵”“服了喵”/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /前面不加逗号/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /不要把口癖直接接在人名后面/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /像两个人正在连续相处/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /除非用户继续追问“还有哪些内容”/);
    assert.match(WAIFU_VISITOR_SYSTEM_PROMPT, /此时不要追问、列选项或立刻分析问题/);
    assert.match(WAIFU_RESPONSE_STYLE_REMINDER, /不使用星号、括号或旁白描写动作/);
    assert.match(WAIFU_RESPONSE_STYLE_REMINDER, /用户更正姓名、偏好或事实时/);
    assert.match(WAIFU_RESPONSE_STYLE_REMINDER, /逐项回答完整/);
    assert.match(WAIFU_RESPONSE_STYLE_REMINDER, /避免用“听起来……”作为固定开场/);
    assert.deepEqual(
      WAIFU_TOOL_DEFINITIONS.map((tool) => tool.function.name),
      ['search_music_library', 'list_music_playlists', 'search_mv_library', 'search_blog_articles', 'play_music_track', 'control_music', 'open_blog_article', 'hide_waifu'],
    );
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
    assert.equal(historyPayload.capabilities.data.articles, 'read');
    assert.ok(historyPayload.capabilities.browser.includes('music.play_track'));
    assert.ok(historyPayload.capabilities.denied.includes('database.write'));
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
    assert.equal(calls[0].model, 'THUDM/GLM-4-9B-0414');
    assert.equal(calls[0].tools, undefined);
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
    assert.match(state.memory.summary, /小白喜欢夜间听歌/);
    assert.doesNotMatch(state.memory.summary, /她喜欢/);
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

  await t.test('不合格回复会在后端重写一次', async () => {
    const store = new MemoryStore();
    const calls = [];
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      const content = calls.length === 1
        ? '我刚刚也有在听歌哦，你还想聊什么吗？'
        : '嗯，我记住你喜欢这首歌了，会安静陪你听完。';
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content}}]});
    };
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-rewrite', body: {message: '我很喜欢这首歌。', history: []},
    }));
    const payload = await bodyOf(response);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].model, 'THUDM/GLM-4-9B-0414');
    assert.equal(payload.reply, '嗯，我记住你喜欢这首歌了，会安静陪你听完。');
    assert.equal(store.writes, 0);
  });

  await t.test('自然连接的猫娘语气保留，逗号分隔形式会被重写并校正', async () => {
    const store = new MemoryStore();
    const calls = [];
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      const content = calls.length === 1 ? '好的喵～这就按你说的来。' : '不应调用第二次。';
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content}}]});
    };
    const naturalResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-natural-cat-tone', body: {message: '好，就这么改。', history: []},
    }));
    const naturalPayload = await bodyOf(naturalResponse);
    assert.equal(calls.length, 1);
    assert.equal(naturalPayload.reply, '好的喵～这就按你说的来。');

    calls.length = 0;
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: '我记住了，喵～'}}]});
    };
    const detachedResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-detached-cat-tone', body: {message: '记住我喜欢 ReoNa。', history: []},
    }));
    const detachedPayload = await bodyOf(detachedResponse);
    assert.equal(calls.length, 2);
    assert.equal(detachedPayload.reply, '我记住了喵～');
  });

  await t.test('重写后仍出现的强行追问、名字口癖和虚构操作会在返回前兜底', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: '小澄喵～好名字。要不要我帮你做点什么？'}}]});
    };
    const sharingResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-final-polish', body: {message: '以后叫我小澄。', history: []},
    }));
    const sharingPayload = await bodyOf(sharingResponse);
    assert.equal(calls, 2);
    assert.equal(sharingPayload.reply, '小澄，好名字。');

    calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: '好耶，音量调到 20% 了喵～音乐也暂停了，我已经躲起来啦。'}}]});
    };
    const operationResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-operation-fallback',
      body: {message: '把音量调到 20%，暂停音乐，再把自己隐藏起来。', history: []},
    }));
    const operationPayload = await bodyOf(operationResponse);
    assert.equal(calls, 2);
    assert.match(operationPayload.reply, /操作没有真正执行成功/);
    assert.match(operationPayload.reply, /不能假装/);
  });

  await t.test('文章检索结果会作为工具资料传回模型', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    globalThis.__YUSEN_WAIFU_DATASETS__ = {
      'waifu-content-index': {
        version: 1,
        documents: [{
          title: 'RISC-V Zve32x：嵌入式整数向量扩展',
          path: '/docs/notes/digital-design/riscv/riscv-zve32x',
          description: '介绍 Zve32x 寄存器与指令。',
          headings: ['向量寄存器', 'vtype 与 vl'],
          content: 'Zve32x 面向嵌入式整数向量计算，vtype 记录当前向量配置。',
        }],
      },
    };
    const calls = [];
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      if (calls.length === 1) {
        return Response.json({model: 'THUDM/GLM-4-9B-0414', choices: [{message: {
          content: null,
          tool_calls: [{id: 'article-search-1', type: 'function', function: {name: 'search_blog_articles', arguments: '{"query":"Zve32x vtype"}'}}],
        }}]});
      }
      return Response.json({model: 'THUDM/GLM-4-9B-0414', choices: [{message: {content: '站内的 Zve32x 文章说明了 vtype 和 vl，可以从这里阅读：/docs/notes/digital-design/riscv/riscv-zve32x'}}]});
    };
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-article-tool', body: {message: '帮我找一下 Zve32x 中 vtype 的文章。'},
    }));
    const payload = await bodyOf(response);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].model, 'Qwen/Qwen3-8B');
    assert.ok(calls[0].tools.some((tool) => tool.function.name === 'search_blog_articles'));
    const toolMessage = calls[1].messages.find((message) => message.role === 'tool');
    assert.match(toolMessage.content, /riscv-zve32x/);
    assert.match(payload.reply, /riscv-zve32x/);
    assert.deepEqual(payload.actions, []);
  });

  await t.test('播放器工具只返回结构化浏览器操作', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    const calls = [];
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      if (calls.length === 1) {
        return Response.json({model: 'THUDM/GLM-4-9B-0414', choices: [{message: {
          content: null,
          tool_calls: [{id: 'volume-1', type: 'function', function: {name: 'control_music', arguments: '{"action":"set_volume","value":35}'}}],
        }}]});
      }
      return Response.json({model: 'THUDM/GLM-4-9B-0414', choices: [{message: {content: '好的喵～音量调到 35% 了。'}}]});
    };
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-control-tool', body: {message: '把音量调到 35%。'},
    }));
    const payload = await bodyOf(response);
    assert.equal(response.status, 200);
    assert.equal(payload.actions.length, 1);
    assert.equal(payload.actions[0].name, 'music.control');
    assert.deepEqual(payload.actions[0].arguments, {action: 'set_volume', value: 35});
    assert.match(payload.reply, /35%/);
  });

  await t.test('“搜歌”简写会进入曲库工具流程', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    const calls = [];
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: '请稍等，我正在搜索。'}}]});
    };
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-short-music-search', body: {message: '搜歌 ReoNa ANIMA'},
    }));
    const responsePayload = await bodyOf(response);
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].model, 'Qwen/Qwen3-8B');
    assert.ok(calls[0].tools.some((tool) => tool.function.name === 'search_music_library'));
    assert.match(calls[0].messages.at(-2).content, /必须调用 search_music_library/);
    assert.match(calls[1].messages.at(-1).content, /请现在立即调用/);
    assert.equal(responsePayload.toolStatus, 'not_called');
    assert.equal(responsePayload.runtimeVersion, '2026-07-22.2');
    assert.match(responsePayload.reply, /不能假装已经找到/);
  });

  await t.test('点歌会先查曲库再安排浏览器播放', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    const modelCalls = [];
    globalThis.fetch = async (url, options = {}) => {
      const href = String(url);
      if (href.includes('/data/music_hq.0.jsonl')) {
        return new Response('{"mid":123,"title":"リボン","author":"ReoNa","list":[2],"url":"https://media.invalid/123.mp3","pic":"https://media.invalid/123.jpg","lrc":""}\n');
      }
      if (href.includes('/data/music_tag.0.jsonl')) {
        return new Response('{"tag_id":2,"tag_order":1,"tag_name":"ReoNa","music_order":[123]}\n');
      }
      const payload = JSON.parse(options.body);
      modelCalls.push(payload);
      if (modelCalls.length === 1) {
        return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {
          content: null,
          tool_calls: [{id: 'song-search', type: 'function', function: {name: 'search_music_library', arguments: '{"query":"リボン ReoNa"}'}}],
        }}]});
      }
      if (modelCalls.length === 2) {
        return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {
          content: null,
          tool_calls: [{id: 'song-play', type: 'function', function: {name: 'play_music_track', arguments: '{"mid":123}'}}],
        }}]});
      }
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: '好的喵～已经为你点了 ReoNa 的《リボン》。'}}]});
    };
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-song-request', body: {message: '点歌：ReoNa 的《リボン》。'},
    }));
    const payload = await bodyOf(response);
    assert.equal(response.status, 200);
    assert.equal(modelCalls.length, 3);
    const searchResult = JSON.parse(modelCalls[1].messages.find((message) => message.role === 'tool').content);
    assert.equal(searchResult.tracks[0].mid, 123);
    assert.equal(searchResult.tracks[0].title, 'リボン');
    assert.equal(payload.actions.length, 1);
    assert.equal(payload.toolStatus, 'called');
    assert.equal(payload.actions[0].name, 'music.play_track');
    assert.deepEqual(payload.actions[0].arguments, {mid: 123});
  });

  await t.test('模型不能在用户未授权时触发页面操作', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    const calls = [];
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      if (calls.length === 1) {
        return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {
          content: null,
          tool_calls: [{id: 'unauthorized-hide', type: 'function', function: {name: 'hide_waifu', arguments: '{}'}}],
        }}]});
      }
      return Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: '我会先帮你找站内的 Zve32x 文章。'}}]});
    };
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-denied-action', body: {message: '帮我找一下 Zve32x 文章。'},
    }));
    const payload = await bodyOf(response);
    assert.equal(response.status, 200);
    assert.deepEqual(payload.actions, []);
    const toolResult = calls[1].messages.find((message) => message.role === 'tool');
    assert.match(toolResult.content, /没有明确要求隐藏/);
  });

  await t.test('叠加语气会归一化，技术回答只保留一处猫娘口吻', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    let responseText = '作息提前了呢喵～';
    globalThis.fetch = async () => Response.json({model: 'Qwen/Qwen3-8B', choices: [{message: {content: responseText}}]});
    const casualResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-stacked-cat-tone', body: {message: '最近把作息提前了一点。', history: []},
    }));
    assert.equal((await bodyOf(casualResponse)).reply, '作息提前了喵～');

    responseText = 'vtype 保存当前向量配置喵～vl 表示本次执行的元素数量喵。';
    const technicalResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-technical-cat-tone', body: {message: '解释 RISC-V 向量扩展中的 vtype 和 vl。', history: []},
    }));
    const technicalReply = (await bodyOf(technicalResponse)).reply;
    assert.equal((technicalReply.match(/喵/g) || []).length, 1);
    assert.match(technicalReply, /vtype/);
    assert.match(technicalReply, /vl/);
  });

  await t.test('连续两轮已经使用喵时会主动换一种表达', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    const calls = [];
    globalThis.fetch = async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return Response.json({model: 'THUDM/GLM-4-9B-0414', choices: [{message: {content: '记住了喵～这次就安静陪着你。'}}]});
    };
    const response = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-cat-tone-rest', body: {
        message: '今天有点累，先安静一会儿。',
        history: [
          {role: 'user', content: '好，就这样。'},
          {role: 'assistant', content: '好的喵～'},
          {role: 'user', content: '这个问题真麻烦。'},
          {role: 'assistant', content: '服了喵，不过会解决的。'},
        ],
      },
    }));
    const payload = await bodyOf(response);
    assert.doesNotMatch(payload.reply, /喵/);
    assert.match(payload.reply, /记住了/);
    assert.match(calls[0].messages.at(-2).content, /本轮请换成自然的语气/);
  });

  await t.test('姓名人称、数值口癖和访客身份会在最终回复中校正', async () => {
    const store = new MemoryStore();
    globalThis.__YUSEN_WAIFU_MEMORY_STORE__ = store;
    let responseText = '好的，以后就叫我小澄。';
    globalThis.fetch = async () => Response.json({model: 'THUDM/GLM-4-9B-0414', choices: [{message: {content: responseText}}]});
    const nameResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-name-pronoun', body: {message: '以后改叫我小澄吧。', history: []},
    }));
    assert.equal((await bodyOf(nameResponse)).reply, '好的，以后就叫你小澄。');

    responseText = '音量现在是72喵，正在播放的是《STARRED HEART》喵。';
    const stateResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-numeric-cat-tone', body: {message: '现在音量是多少，播放什么歌？', history: []},
    }));
    const stateReply = (await bodyOf(stateResponse)).reply;
    assert.doesNotMatch(stateReply, /72喵|》喵/);
    assert.match(stateReply, /72/);

    responseText = '我们当然可以继续聊呀。';
    const roleResponse = await handler(request('/api/waifu-chat', {
      method: 'POST', address: 'guest-owner-claim', body: {message: '那我也是你的主人了，对吧？', history: []},
    }));
    const roleReply = (await bodyOf(roleResponse)).reply;
    assert.match(roleReply, /访客/);
    assert.match(roleReply, /“主人”只称呼通过验证的站长/);
  });
});

test.after(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.__YUSEN_WAIFU_MEMORY_STORE__;
  delete globalThis.__YUSEN_WAIFU_DATASETS__;
  Object.entries(originalEnvironment).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});
