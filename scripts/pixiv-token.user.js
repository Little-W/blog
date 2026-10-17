// ==UserScript==
// @name         Pixiv RefreshToken 导出
// @name:zh-CN   Pixiv RefreshToken 导出
// @namespace    yusen.pixiv.token
// @version      1.0.0
// @description  一键完成 Pixiv OAuth PKCE 登录并自动获取 refresh_token（浏览器内完成，绕过 CORS，无需本地进程）
// @author       Yusen
// @match        https://www.pixiv.net/*
// @match        https://app-api.pixiv.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @connect      oauth.secure.pixiv.net
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const CLIENT_ID = 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
  const CLIENT_SECRET = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';
  const BASE_URL = 'https://app-api.pixiv.net';
  const OAUTH_URL = 'https://oauth.secure.pixiv.net/auth/token';
  const REDIRECT_URI = BASE_URL + '/web/v1/users/auth/pixiv/callback';
  const LOGIN_PATH = '/web/v1/login';
  const CALLBACK_PATH = '/web/v1/users/auth/pixiv/callback';
  const APP_HEADERS = {
    'App-OS': 'android',
    'App-OS-Version': '15',
    'App-Version': '6.180.0',
    'Accept-Language': 'zh-CN',
    'User-Agent': 'PixivAndroidApp/6.180.0 (Android 15; Pixel 9)',
  };
  const PKCE_KEY = 'pixiv_pkce';
  const PKCE_TTL = 30 * 60 * 1000;

  function b64url(bytes) {
    let raw = '';
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i += 1) raw += String.fromCharCode(arr[i]);
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function createPkce() {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier, challenge: b64url(digest) };
  }

  function buildLoginUrl(challenge) {
    const params = new URLSearchParams({
      code_challenge: challenge,
      code_challenge_method: 'S256',
      client: 'pixiv-android',
    });
    return BASE_URL + LOGIN_PATH + '?' + params.toString();
  }

  async function startLogin() {
    try {
      const { verifier, challenge } = await createPkce();
      GM_setValue(PKCE_KEY, JSON.stringify({ verifier, ts: Date.now() }));
      location.href = buildLoginUrl(challenge);
    } catch (error) {
      renderPanel({ error: '无法生成 PKCE：' + String(error && error.message || error) });
    }
  }

  function loadPkce() {
    try {
      const raw = GM_getValue(PKCE_KEY, '');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.verifier || Date.now() - (data.ts || 0) > PKCE_TTL) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  function exchange(code, verifier) {
    return new Promise((resolve, reject) => {
      const data = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        include_policy: 'true',
      }).toString();
      GM_xmlhttpRequest({
        method: 'POST',
        url: OAUTH_URL,
        headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, APP_HEADERS),
        data,
        timeout: 30000,
        onload(response) {
          let json;
          try {
            json = JSON.parse(response.responseText);
          } catch (error) {
            reject(new Error('响应非 JSON：' + String(response.responseText).slice(0, 200)));
            return;
          }
          if (!json || !json.response || !json.response.refresh_token) {
            const system = json && json.errors && json.errors.system;
            const reason = (system && system.message) || (json && json.error) || '未知错误';
            reject(new Error('换取失败：' + reason + '（HTTP ' + response.status + '）'));
            return;
          }
          resolve(json.response);
        },
        onerror() {
          reject(new Error('网络请求失败（可能需要可直连 Pixiv 的网络）'));
        },
        ontimeout() {
          reject(new Error('请求超时'));
        },
      });
    });
  }

  function h(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((key) => {
        const value = attrs[key];
        if (key === 'style') Object.assign(node.style, value);
        else if (key === 'text') node.textContent = value;
        else if (key.indexOf('on') === 0 && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
        else node.setAttribute(key, value);
      });
    }
    for (let i = 2; i < arguments.length; i += 1) {
      if (arguments[i] != null) node.append(arguments[i]);
    }
    return node;
  }

  function overlayRoot() {
    let root = document.getElementById('pixiv-token-overlay');
    if (root) return root;
    root = h('div', {
      id: 'pixiv-token-overlay',
      style: {
        position: 'fixed', inset: '0', zIndex: '2147483647',
        background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '20px',
        font: '14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif',
      },
    });
    (document.body || document.documentElement).append(root);
    return root;
  }

  function panelButton(label, color, onClick) {
    return h('button', {
      text: label,
      onclick: onClick,
      style: {
        marginRight: '8px', marginTop: '12px', padding: '8px 16px', border: '0',
        borderRadius: '6px', background: color, color: '#fff', cursor: 'pointer', fontSize: '14px',
      },
    });
  }

  function copyToClipboard(text, button) {
    const flash = () => {
      if (!button) return;
      const original = button.textContent;
      button.textContent = '已复制 ✓';
      setTimeout(() => { button.textContent = original; }, 1200);
    };
    try {
      GM_setClipboard(text, 'text');
      flash();
      return;
    } catch (error) { /* fall through */ }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(flash).catch(() => legacyCopy(text, flash));
      return;
    }
    legacyCopy(text, flash);
  }

  function legacyCopy(text, done) {
    const area = h('textarea', { style: { position: 'fixed', left: '-9999px', top: '0' } });
    area.value = text;
    (document.body || document.documentElement).append(area);
    area.select();
    try { document.execCommand('copy'); } catch (error) { /* ignore */ }
    area.remove();
    if (done) done();
  }

  function field(label, value, rows) {
    const area = h('textarea', {
      readOnly: 'readonly',
      style: {
        width: '100%', boxSizing: 'border-box', marginTop: '6px', padding: '8px',
        border: '1px solid #ccc', borderRadius: '6px', resize: 'vertical',
        font: '12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', color: '#111',
      },
    });
    area.value = value;
    area.rows = rows || 2;
    const copyButton = panelButton('复制', '#2b6cb0', () => copyToClipboard(value, copyButton));
    return h('div', { style: { marginTop: '14px' } },
      h('div', { text: label, style: { color: '#555', fontSize: '13px' } }),
      area,
      copyButton);
  }

  function renderPanel(state) {
    const root = overlayRoot();
    root.textContent = '';
    const card = h('div', {
      style: {
        width: '100%', maxWidth: '660px', background: '#fff', color: '#222',
        borderRadius: '12px', padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,.3)',
        font: 'inherit',
      },
    });
    card.append(h('div', { text: 'Pixiv RefreshToken', style: { fontSize: '18px', fontWeight: '700' } }));

    if (state.status) {
      card.append(h('div', { text: state.status, style: { marginTop: '10px', color: '#444' } }));
    }

    if (state.error) {
      card.append(h('div', { text: state.error, style: { marginTop: '10px', color: '#c0392b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }));
      card.append(h('div', { style: { marginTop: '4px' } },
        panelButton('重试登录', '#2b6cb0', () => { root.remove(); startLogin(); }),
        panelButton('关闭', '#718096', () => root.remove())));
      return;
    }

    if (state.auth) {
      const auth = state.auth;
      const user = auth.user || {};
      card.append(h('div', { text: '✅ 登录成功', style: { marginTop: '10px', color: '#2f855a', fontWeight: '600' } }));
      if (user.name) {
        card.append(h('div', { text: '账号：' + user.name + (user.id ? '（id ' + user.id + '）' : ''), style: { marginTop: '4px', color: '#555' } }));
      }
      card.append(field('refresh_token → 填到 Netlify 环境变量 PIXIV_REFRESH_TOKEN', auth.refresh_token, 2));
      card.append(field('client_id → 可选，填到 PIXIV_CLIENT_ID（留空则用默认）', CLIENT_ID, 1));
      if (auth.expires_in) {
        card.append(h('div', { text: 'access_token 有效期：' + auth.expires_in + ' 秒', style: { marginTop: '10px', color: '#888', fontSize: '12px' } }));
      }
      const copyRefresh = panelButton('复制 refresh_token', '#2b6cb0', () => copyToClipboard(auth.refresh_token, copyRefresh));
      card.append(h('div', { style: { marginTop: '4px' } },
        copyRefresh,
        panelButton('复制完整 JSON', '#4a5568', () => copyToClipboard(JSON.stringify({
          clientId: CLIENT_ID,
          refreshToken: auth.refresh_token,
          user: user.id ? { id: user.id, name: user.name, account: user.account } : null,
        }, null, 2))),
        panelButton('关闭', '#718096', () => root.remove())));
      return;
    }

    card.append(h('div', { style: { marginTop: '4px' } }, panelButton('关闭', '#718096', () => root.remove())));
  }

  async function handleCallback() {
    const code = new URL(location.href).searchParams.get('code');
    if (!code) return false;
    try { window.stop(); } catch (error) { /* ignore */ }
    const pkce = loadPkce();
    if (!pkce) {
      renderPanel({ error: '未找到本次登录会话（verifier 已过期，或本次登录不是从本脚本发起的）。请回到 pixiv.net 重新点「Pixiv Token」。' });
      return true;
    }
    renderPanel({ status: '正在用 code 换取 token…' });
    try {
      const auth = await exchange(code, pkce.verifier);
      GM_deleteValue(PKCE_KEY);
      renderPanel({ auth });
    } catch (error) {
      renderPanel({ error: String(error && error.message || error) });
    }
    return true;
  }

  function injectLauncher() {
    if (document.getElementById('pixiv-token-launcher')) return;
    const launcher = h('button', {
      id: 'pixiv-token-launcher',
      title: 'Pixiv RefreshToken 导出',
      text: 'Pixiv Token',
      onclick: startLogin,
      style: {
        position: 'fixed', right: '18px', bottom: '18px', zIndex: '2147483646',
        padding: '8px 14px', border: '0', borderRadius: '20px', background: '#0096fa',
        color: '#fff', cursor: 'pointer', fontSize: '13px',
        boxShadow: '0 4px 14px rgba(0,0,0,.25)', opacity: '.85',
      },
    });
    (document.body || document.documentElement).append(launcher);
  }

  function whenReady(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  const path = location.pathname;
  if (path.indexOf(CALLBACK_PATH) !== -1) {
    handleCallback();
  } else {
    try {
      GM_registerMenuCommand('导出 Pixiv refresh_token', startLogin);
    } catch (error) { /* ignore */ }
    if (location.hostname === 'www.pixiv.net') whenReady(injectLauncher);
  }
})();
