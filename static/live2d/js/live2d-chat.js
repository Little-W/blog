(function () {
  "use strict";

  if (window.__yusenWaifuChat) return;
  var widget = document.getElementById("waifu");
  var toolbar = document.getElementById("waifu-tool");
  if (!widget || !toolbar) return;

  var STORAGE_KEY = "yusen-waifu-chat-v2";
  var LEGACY_STORAGE_KEY = "yusen-waifu-chat-v1";
  var MAX_LOCAL_MESSAGES = 120;
  var MAX_REQUEST_HISTORY = 12;
  var history = loadLocalHistory();
  var owner = false;
  var capabilities = null;
  var initialized = false;
  var pending = false;
  var proactivePending = false;
  var lastActivityAt = Date.now();
  var nextProactiveAt = Infinity;

  function cleanLocalHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(-MAX_LOCAL_MESSAGES).map(function (item, index) {
      var role = item && item.role === "assistant" ? "assistant" : item && item.role === "user" ? "user" : "";
      var content = item && typeof item.content === "string" ? item.content.trim().slice(0, 1200) : "";
      if (!role || !content) return null;
      return {
        id: item.id || "local-" + Date.now().toString(36) + "-" + index.toString(36),
        role: role,
        content: content,
        kind: item.kind === "proactive" ? "proactive" : "chat",
        createdAt: item.createdAt || new Date().toISOString()
      };
    }).filter(Boolean);
  }

  function loadLocalHistory() {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (error) {}
    if (!Array.isArray(stored)) {
      try { stored = JSON.parse(sessionStorage.getItem(LEGACY_STORAGE_KEY) || "null"); } catch (error) {}
      if (Array.isArray(stored)) {
        stored = cleanLocalHistory(stored);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
          sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (error) {}
      }
    }
    return cleanLocalHistory(stored);
  }

  function saveLocalHistory() {
    if (owner) return;
    history = history.slice(-MAX_LOCAL_MESSAGES);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (error) {}
  }

  function newLocalMessage(role, content, kind) {
    return {
      id: "browser-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10),
      role: role,
      content: String(content || "").trim(),
      kind: kind === "proactive" ? "proactive" : "chat",
      createdAt: new Date().toISOString()
    };
  }

  function iconButton(className, label, svg) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.label = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.innerHTML = svg;
    return button;
  }

  var chatButton = toolbar.querySelector('[data-action="chat"]') || iconButton(
    "waifu-tool__button waifu-tool__button--chat", "和看板娘聊天",
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>'
  );
  if (!chatButton.parentNode) {
    chatButton.dataset.action = "chat";
    var hideButton = toolbar.querySelector('[data-action="hide"]');
    toolbar.insertBefore(chatButton, hideButton || toolbar.lastChild);
  }
  chatButton.setAttribute("aria-expanded", "false");

  var panel = document.createElement("section");
  panel.className = "waifu-chat";
  panel.hidden = true;
  panel.setAttribute("aria-label", "与看板娘对话");
  panel.innerHTML =
    '<header class="waifu-chat__header"><div><strong>伊珂丝</strong><span class="waifu-chat__persistence">正在确认记忆位置…</span></div>' +
    '<button type="button" class="waifu-chat__close" aria-label="关闭对话" title="关闭对话">×</button></header>' +
    '<div class="waifu-chat__messages" role="log" aria-live="polite"></div>' +
    '<form class="waifu-chat__form"><textarea rows="1" maxlength="500" placeholder="和我说点什么吧…" aria-label="对话内容"></textarea>' +
    '<button type="submit">发送</button></form>';
  widget.appendChild(panel);

  var messages = panel.querySelector(".waifu-chat__messages");
  var persistence = panel.querySelector(".waifu-chat__persistence");
  var form = panel.querySelector(".waifu-chat__form");
  var input = form.querySelector("textarea");
  var send = form.querySelector('button[type="submit"]');
  var close = panel.querySelector(".waifu-chat__close");

  function appendMessage(role, content, temporary) {
    var row = document.createElement("div");
    row.className = "waifu-chat__message waifu-chat__message--" + role + (temporary ? " is-pending" : "");
    row.textContent = content;
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    return row;
  }

  function emptyGreeting() {
    return owner
      ? "主人，欢迎回来。今天也可以把想说的话都交给我哦~"
      : "欢迎来博客逛逛，我是伊珂丝。想聊点什么都可以哦~";
  }

  function renderHistory() {
    messages.textContent = "";
    if (!initialized) {
      appendMessage("assistant", "稍等一下，我正在整理记忆…", true);
      return;
    }
    if (!history.length) appendMessage("assistant", emptyGreeting());
    history.forEach(function (item) {
      appendMessage(item.role, item.content);
    });
  }

  function updatePersistenceLabel() {
    persistence.textContent = owner ? "主人模式 · 云端记忆" : "访客模式 · 仅此浏览器";
    persistence.dataset.persistence = owner ? "blob" : "local";
  }

  function setOpen(open) {
    panel.hidden = !open;
    widget.classList.toggle("waifu--chat-open", open);
    chatButton.classList.toggle("is-active", open);
    chatButton.setAttribute("aria-expanded", String(open));
    if (open) {
      renderHistory();
      window.setTimeout(function () { input.focus(); }, 0);
    }
  }

  function setPending(active) {
    pending = active;
    input.disabled = active;
    send.disabled = active;
    send.textContent = active ? "想一想" : "发送";
  }

  function errorMessage(payload, status) {
    if (payload && typeof payload.message === "string") return payload.message;
    if (status === 429) return "说得太快啦，先等一小会儿吧。";
    return "我刚刚没听清，可以再说一遍吗？";
  }

  function requestJSON(path, options) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 32000) : 0;
    var settings = Object.assign({credentials: "same-origin", headers: {accept: "application/json"}}, options || {});
    if (controller) settings.signal = controller.signal;
    return fetch(path, settings).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (payload) {
        if (!response.ok || !payload || payload.success !== true) {
          throw new Error(errorMessage(payload, response.status));
        }
        return payload;
      });
    }).finally(function () {
      if (timeout) window.clearTimeout(timeout);
    });
  }

  function requestHitokoto() {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 6000) : 0;
    var settings = {
      cache: "no-store",
      headers: {accept: "application/json"},
      mode: "cors",
      referrerPolicy: "no-referrer"
    };
    if (controller) settings.signal = controller.signal;
    return fetch("https://v1.hitokoto.cn/?encode=json&max_length=80", settings).then(function (response) {
      if (!response.ok) throw new Error("一言暂时没有回应。");
      return response.json();
    }).then(function (payload) {
      var text = payload && typeof payload.hitokoto === "string" ? payload.hitokoto.trim().slice(0, 180) : "";
      if (!text) throw new Error("一言内容为空。");
      return text;
    }).finally(function () {
      if (timeout) window.clearTimeout(timeout);
    });
  }

  function localHitokotoFallback(value) {
    var text = String(value || "").trim().replace(/^[“\"「『]+|[”\"」』]+$/g, "");
    if (!text) return "";
    return "刚刚捡到一句话，想悄悄放在这里：" + text;
  }

  function applyAgentControls(payload, fallbackDelay) {
    var delay = Number(payload && payload.agent && payload.agent.proactiveAfterMs);
    if (!Number.isFinite(delay) || delay < 15 * 1000 || delay > 60 * 60 * 1000) {
      delay = fallbackDelay;
    }
    nextProactiveAt = Date.now() + delay;
  }

  function currentPageContext() {
    var heading = document.querySelector("main h1, article h1, .theme-doc-markdown h1");
    return {
      path: location.pathname + location.search,
      title: document.title,
      heading: heading ? heading.textContent.trim() : ""
    };
  }

  function musicContext() {
    try {
      if (window.YusenMusicContext && typeof window.YusenMusicContext.getSnapshot === "function") {
        return window.YusenMusicContext.getSnapshot();
      }
    } catch (error) {}
    return {current: null, recent: []};
  }

  function runtimeContext() {
    var now = new Date();
    var timezone = "";
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (error) {}
    return {
      time: {
        iso: now.toISOString(),
        localText: now.toLocaleString(),
        timezone: timezone,
        weekday: now.toLocaleDateString(undefined, {weekday: "long"})
      },
      page: currentPageContext(),
      music: musicContext(),
      activity: {
        idleSeconds: Math.max(0, Math.round((Date.now() - lastActivityAt) / 1000)),
        visible: !document.hidden,
        language: navigator.language || ""
      }
    };
  }

  function executeBrowserAction(action) {
    var name = action && String(action.name || "");
    var args = action && action.arguments && typeof action.arguments === "object" ? action.arguments : {};
    if (name === "music.play_track") {
      if (!window.YusenMusicAgent || typeof window.YusenMusicAgent.playTrack !== "function") {
        return Promise.reject(new Error("音乐播放器还没有准备好。"));
      }
      return window.YusenMusicAgent.playTrack(args.mid).then(function (result) {
        if (result && result.blocked) {
          return {success: true, warning: "歌曲已选中，但浏览器阻止了自动播放，请手动按一次播放键。"};
        }
        return result || {success: true};
      });
    }
    if (name === "music.control") {
      if (!window.YusenMusicAgent || typeof window.YusenMusicAgent.control !== "function") {
        return Promise.reject(new Error("音乐播放器还没有准备好。"));
      }
      return window.YusenMusicAgent.control(args.action, args.value);
    }
    if (name === "navigation.open") {
      var target = String(args.path || "");
      var targetURL;
      try { targetURL = new URL(target, window.location.origin); } catch (error) {}
      if (!targetURL || targetURL.origin !== window.location.origin || !/^\/(?!\/)/.test(target) || /^\/api(?:\/|$)/.test(targetURL.pathname)) {
        return Promise.reject(new Error("站内文章路径无效。"));
      }
      window.setTimeout(function () { window.location.assign(targetURL.pathname + targetURL.search + targetURL.hash); }, 900);
      return Promise.resolve({success: true});
    }
    if (name === "waifu.hide") {
      window.setTimeout(function () {
        var effects = window.YusenEffects;
        if (effects && typeof effects.setEffectEnabled === "function") effects.setEffectEnabled("live2d", false);
        else widget.hidden = true;
      }, 1100);
      return Promise.resolve({success: true});
    }
    return Promise.reject(new Error("页面不支持这项操作。"));
  }

  function executeBrowserActions(actions) {
    var queue = Array.isArray(actions) ? actions.slice(0, 8) : [];
    var results = [];
    return queue.reduce(function (chain, action) {
      return chain.then(function () {
        return executeBrowserAction(action).then(function (result) {
          results.push({success: true, action: action, result: result || {success: true}});
        }).catch(function (error) {
          results.push({success: false, action: action, error: String(error && error.message || "操作未完成。")});
        });
      });
    }, Promise.resolve()).then(function () { return results; });
  }

  function markActivity() {
    lastActivityAt = Date.now();
  }

  ["pointerdown", "keydown", "touchstart"].forEach(function (eventName) {
    document.addEventListener(eventName, markActivity, {passive: true, capture: true});
  });

  var ready = requestJSON("/api/waifu-chat/history", {method: "GET"}).then(function (payload) {
    owner = payload.owner === true;
    capabilities = payload.capabilities || null;
    if (owner) {
      // 登录前的访客对话不上传。管理员只读取并续写本人已认证的云端记录。
      history = cleanLocalHistory(payload.history);
    }
    initialized = true;
    applyAgentControls(payload, 60 * 1000);
    updatePersistenceLabel();
    if (!panel.hidden) renderHistory();
  }).catch(function () {
    owner = false;
    initialized = true;
    applyAgentControls(null, 60 * 1000);
    updatePersistenceLabel();
    if (!panel.hidden) renderHistory();
  });

  function submitMessage(text) {
    if (pending || !text) return;
    setPending(true);
    ready.then(function () {
      var previousHistory = history.filter(function (item) {
        return item.kind !== "proactive";
      }).slice(-MAX_REQUEST_HISTORY).map(function (item) {
        return {role: item.role, content: item.content, kind: item.kind};
      });
      var userMessage = newLocalMessage("user", text, "chat");
      history.push(userMessage);
      saveLocalHistory();
      appendMessage("user", text);
      input.value = "";
      var thinking = appendMessage("assistant", "让我想想……", true);
      return requestJSON("/api/waifu-chat", {
        method: "POST",
        headers: {"content-type": "application/json", accept: "application/json"},
        body: JSON.stringify({message: text, history: previousHistory, context: runtimeContext()})
      }).then(function (payload) {
        thinking.remove();
        capabilities = payload.capabilities || capabilities;
        var reply = String(payload.reply || "").trim();
        if (!reply) throw new Error("我刚刚一下子词穷了……再问我一次好吗？");
        return executeBrowserActions(payload.actions).then(function (actionResults) {
          owner = payload.owner === true;
          updatePersistenceLabel();
          history.push(newLocalMessage("assistant", reply, "chat"));
          saveLocalHistory();
          appendMessage("assistant", reply);
          var failures = actionResults.filter(function (result) { return !result.success; });
          var warnings = actionResults.map(function (result) { return result.result && result.result.warning; }).filter(Boolean);
          if (failures.length) appendMessage("assistant", "页面操作未完成：" + failures.map(function (result) { return result.error; }).join("；"));
          warnings.forEach(function (warning) { appendMessage("assistant", warning); });
        });
      }).catch(function (error) {
        thinking.remove();
        var message = error && error.name === "AbortError"
          ? "我想得有点久了，这次先算我输啦。"
          : String(error && error.message || "对话服务暂时没有响应。");
        appendMessage("assistant", message);
      });
    }).finally(function () {
      setPending(false);
      input.focus();
    });
  }

  function proactive() {
    if (proactivePending || pending || Date.now() < nextProactiveAt || document.hidden) {
      return Promise.resolve(false);
    }
    proactivePending = true;
    nextProactiveAt = Infinity;
    var hitokoto = "";
    return ready.then(function () {
      return requestHitokoto().catch(function () { return ""; });
    }).then(function (sourceText) {
      hitokoto = sourceText;
      return requestJSON("/api/waifu-chat/proactive", {
        method: "POST",
        headers: {"content-type": "application/json", accept: "application/json"},
        body: JSON.stringify({
          history: history.slice(-12).map(function (item) {
            return {role: item.role, content: item.content, kind: item.kind};
          }),
          context: runtimeContext(),
          hitokoto: hitokoto
        })
      });
    }).then(function (payload) {
      applyAgentControls(payload, 5 * 60 * 1000);
      owner = payload.owner === true;
      updatePersistenceLabel();
      var reply = String(payload.reply || "").trim();
      if (!payload.silent && reply) {
        history.push(newLocalMessage("assistant", reply, "proactive"));
        saveLocalHistory();
        if (!panel.hidden) renderHistory();
        if (typeof window.showMessage === "function") window.showMessage(reply, 6500);
      }
      return true;
    }).catch(function () {
      applyAgentControls(null, 60 * 1000);
      var fallback = localHitokotoFallback(hitokoto);
      if (fallback) {
        history.push(newLocalMessage("assistant", fallback, "proactive"));
        saveLocalHistory();
        if (!panel.hidden) renderHistory();
        if (typeof window.showMessage === "function") window.showMessage(fallback, 6500);
        return true;
      }
      return false;
    }).finally(function () {
      proactivePending = false;
    });
  }

  [panel, chatButton].forEach(function (element) {
    ["pointerdown", "mousedown", "click"].forEach(function (eventName) {
      element.addEventListener(eventName, function (event) { event.stopPropagation(); });
    });
  });
  if (chatButton.dataset.runtimeLoader !== "true") {
    chatButton.addEventListener("click", function () { setOpen(panel.hidden); });
  }
  close.addEventListener("click", function () { setOpen(false); });
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submitMessage(input.value.trim());
  });
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  window.__yusenWaifuChat = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    toggle: function () { setOpen(panel.hidden); },
    proactive: proactive,
    getContext: runtimeContext,
    getState: function () {
      return {owner: owner, persistence: owner ? "blob" : "local", historyLength: history.length, capabilities: capabilities};
    }
  };
})();
