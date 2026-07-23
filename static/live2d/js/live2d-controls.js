(function () {
  "use strict";

  if (window.YusenLive2DControls) return;

  var STORAGE_KEY = "yusen-live2d-settings-v1";
  var SIZE_STEPS = [0.82, 1, 1.18, 1.36];
  var defaults = {
    scale: 1,
    mouseTracking: true,
    idleMotion: true,
    agentMode: false,
    tips: true,
    position: null
  };
  var state = loadState();
  var widget = null;
  var canvas = null;
  var tips = null;
  var toolbar = null;
  var moveMode = false;
  var dragState = null;
  var resizeFrame = 0;
  var tipsResizeObserver = null;
  var buttons = {};

  var icons = {
    move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2 9 5m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3m17-3-3-3m3 3-3 3"/></svg>',
    size: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5m13 5h5v-5M3 8l6-6m12 6-6-6M3 16l6 6m12-6-6 6"/></svg>',
    tracking: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 3 13.5 9-6.1 1.2L9 19.4 5 3Z"/><path d="m13 13 4 6"/></svg>',
    idle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.35-5.65M20 4v6h-6"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
    agent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a4 4 0 0 0-4 4v1H7a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h1v2h8v-2h1a3 3 0 0 0 3-3v-3a3 3 0 0 0-3-3h-1V7a4 4 0 0 0-4-4Z"/><path d="M9 12h.01M15 12h.01M9.5 16h5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>',
    tips: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 4v-15Z"/><path d="M8 9h8M8 13h5"/></svg>',
    hide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.5 9 5.5a15.4 15.4 0 0 1-3 3.7M6.6 6.6C4.4 8.1 3 10.5 3 10.5S6.5 16 12 16c1 0 1.9-.2 2.7-.5"/></svg>'
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeState(candidate) {
    candidate = candidate && typeof candidate === "object" ? candidate : {};
    var scale = Number(candidate.scale);
    if (!SIZE_STEPS.some(function (step) { return Math.abs(step - scale) < 0.01; })) {
      scale = defaults.scale;
    }
    var position = null;
    if (candidate.position && typeof candidate.position === "object") {
      var x = Number(candidate.position.x);
      var y = Number(candidate.position.y);
      if (isFinite(x) && isFinite(y)) {
        position = {x: clamp(x, 0, 1), y: clamp(y, 0, 1)};
      }
    }
    return {
      scale: scale,
      mouseTracking: candidate.mouseTracking !== false,
      idleMotion: candidate.idleMotion !== false,
      agentMode: candidate.agentMode === true,
      tips: candidate.tips !== false,
      position: position
    };
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (error) {
      return normalizeState({});
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Storage can be unavailable in privacy mode; settings still work for this page.
    }
    window.dispatchEvent(new CustomEvent("yusen:live2d-settings-change", {
      detail: getState()
    }));
  }

  function getState() {
    return {
      scale: state.scale,
      mouseTracking: state.mouseTracking,
      idleMotion: state.idleMotion,
      agentMode: state.agentMode,
      tips: state.tips,
      position: state.position ? {x: state.position.x, y: state.position.y} : null
    };
  }

  function createButton(action, icon, label, pressed) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "waifu-tool__button";
    button.dataset.action = action;
    button.dataset.label = label;
    button.setAttribute("aria-label", label);
    button.title = label;
    if (typeof pressed === "boolean") button.setAttribute("aria-pressed", String(pressed));
    button.innerHTML = icon;
    toolbar.appendChild(button);
    buttons[action] = button;
    return button;
  }

  function updateToolbarOrigin(rect) {
    if (!toolbar || !widget) return;
    rect = rect || widget.getBoundingClientRect();
    var viewportMargin = 8;
    var buttonCount = toolbar.querySelectorAll(".waifu-tool__button").length;
    var buttonSize = 36;
    var gap = 6;
    var verticalPadding = 20;
    var availableHeight = Math.max(buttonSize + verticalPadding, window.innerHeight - viewportMargin * 2);
    var rows = Math.max(1, Math.min(buttonCount,
      Math.floor((availableHeight - verticalPadding + gap) / (buttonSize + gap))));
    toolbar.style.setProperty("--waifu-tool-rows", String(rows));
    var originY = rect.top + rect.height / 2;
    var toolbarHeight = verticalPadding + rows * buttonSize + Math.max(0, rows - 1) * gap;
    var halfHeight = toolbarHeight / 2;
    var minimumCenter = viewportMargin + halfHeight;
    var maximumCenter = window.innerHeight - viewportMargin - halfHeight;
    var targetY = minimumCenter <= maximumCenter
      ? clamp(originY, minimumCenter, maximumCenter)
      : window.innerHeight / 2;
    toolbar.style.setProperty("--waifu-tool-origin-offset", Math.round(targetY - originY) + "px");
    updateToolbarTipsAvoidance();
  }

  function rectsOverlap(first, second, clearance) {
    clearance = Number(clearance) || 0;
    return first.left < second.right + clearance &&
      first.right > second.left - clearance &&
      first.top < second.bottom + clearance &&
      first.bottom > second.top - clearance;
  }

  function updateToolbarTipsAvoidance() {
    if (!toolbar) return;
    var toolbarButtons = Array.prototype.slice.call(toolbar.querySelectorAll(".waifu-tool__button"));
    toolbar.style.removeProperty("--waifu-tool-outward-extent");
    toolbarButtons.forEach(function (button) {
      button.style.removeProperty("--waifu-tool-wrap-offset");
      button.removeAttribute("data-wrap-column");
    });
    if (!tips || tips.hidden || !state.tips || getComputedStyle(tips).display === "none") return;

    var tipsRect = tips.getBoundingClientRect();
    if (!tipsRect.width || !tipsRect.height) return;
    var obstacleClearance = 8;
    var buttonClearance = 2;
    var colliding = toolbarButtons.filter(function (button) {
      return rectsOverlap(button.getBoundingClientRect(), tipsRect, obstacleClearance);
    });
    if (!colliding.length) return;

    var occupied = toolbarButtons.filter(function (button) {
      return colliding.indexOf(button) === -1;
    }).map(function (button) {
      return button.getBoundingClientRect();
    });
    var columnStep = 42;
    var viewportMargin = 8;
    var maximumOffset = 0;
    colliding.forEach(function (button) {
      var placed = false;
      for (var column = 1; column <= toolbarButtons.length; column += 1) {
        button.style.setProperty("--waifu-tool-wrap-offset", column * columnStep + "px");
        var candidate = button.getBoundingClientRect();
        var insideViewport = candidate.left >= viewportMargin &&
          candidate.right <= window.innerWidth - viewportMargin;
        var hitsTips = rectsOverlap(candidate, tipsRect, obstacleClearance);
        var hitsButton = occupied.some(function (rect) {
          return rectsOverlap(candidate, rect, buttonClearance);
        });
        if (insideViewport && !hitsTips && !hitsButton) {
          button.dataset.wrapColumn = String(column);
          occupied.push(candidate);
          maximumOffset = Math.max(maximumOffset, column * columnStep);
          placed = true;
          break;
        }
      }
      if (!placed) button.style.removeProperty("--waifu-tool-wrap-offset");
    });
    if (maximumOffset) {
      toolbar.style.setProperty("--waifu-tool-outward-extent", maximumOffset + "px");
    }
  }

  function createToolbar() {
    toolbar = document.createElement("div");
    toolbar.id = "waifu-tool";
    toolbar.className = "waifu-tool";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "看板娘显示设置");
    ["pointerdown", "mousedown", "click"].forEach(function (eventName) {
      toolbar.addEventListener(eventName, function (event) {
        event.stopPropagation();
      });
    });
    widget.appendChild(toolbar);

    createButton("move", icons.move, "移动位置", false);
    createButton("size", icons.size, "调整大小");
    createButton("tracking", icons.tracking, "鼠标跟踪", state.mouseTracking);
    createButton("idle", icons.idle, "自动播放待机动画", state.idleMotion);
    createButton("agent", icons.agent, "智能体模式", state.agentMode);
    createButton("chat", icons.chat, "和看板娘聊天");
    buttons.chat.dataset.runtimeLoader = "true";
    buttons.chat.setAttribute("aria-expanded", "false");
    createButton("tips", icons.tips, "Tips 文本框", state.tips);
    createButton("hide", icons.hide, "隐藏看板娘");
    updateToolbarOrigin();

    var status = document.createElement("span");
    status.className = "waifu-tool__status";
    status.setAttribute("aria-live", "polite");
    toolbar.appendChild(status);

    buttons.move.addEventListener("click", function () {
      setMoveMode(!moveMode);
      announce(moveMode ? "拖动看板娘来调整位置，双击按钮可归位" : "位置移动已关闭");
    });
    buttons.move.addEventListener("dblclick", function (event) {
      event.preventDefault();
      state.position = null;
      setMoveMode(false);
      saveState();
      applyPosition();
      announce("看板娘已回到默认位置");
    });
    buttons.size.addEventListener("click", cycleSize);
    buttons.tracking.addEventListener("click", function () {
      state.mouseTracking = !state.mouseTracking;
      saveState();
      applyRuntimeSettings();
      updateButtons();
      announce(state.mouseTracking ? "鼠标跟踪已开启" : "鼠标跟踪已关闭");
    });
    buttons.idle.addEventListener("click", function () {
      state.idleMotion = !state.idleMotion;
      saveState();
      applyRuntimeSettings();
      updateButtons();
      announce(state.idleMotion ? "待机动画自动播放已开启" : "待机动画自动播放已关闭");
    });
    buttons.agent.addEventListener("click", function () {
      state.agentMode = !state.agentMode;
      saveState();
      updateButtons();
      if (state.agentMode) ensureAgentRuntime();
      announce(state.agentMode
        ? "智能体模式已开启，我会结合时间、页面和音乐偶尔陪你聊一句~"
        : "智能体模式已关闭，恢复普通一言");
    });
    buttons.chat.addEventListener("click", function () {
      ensureAgentRuntime().then(function (agent) {
        if (agent && typeof agent.toggle === "function") agent.toggle();
      }).catch(function () {
        announce("对话组件暂时没有加载成功，请稍后再试");
      });
    });
    buttons.tips.addEventListener("click", function () {
      state.tips = !state.tips;
      saveState();
      applyTipsVisibility();
      updateButtons();
      if (state.tips) announce("Tips 文本框已开启");
    });
    buttons.hide.addEventListener("click", function () {
      var effects = window.YusenEffects;
      if (effects && typeof effects.setEffectEnabled === "function") {
        effects.setEffectEnabled("live2d", false);
        return;
      }
      try {
        var storageKey = effects && effects.storageKey || "yusen-effect-settings-v1";
        var effectSettings = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
        effectSettings.live2d = false;
        localStorage.setItem(storageKey, JSON.stringify(effectSettings));
        window.dispatchEvent(new CustomEvent("yusen:effects-settings-change", {
          detail: effectSettings
        }));
      } catch (error) {
        widget.hidden = true;
        if (typeof window.__setLive2dRenderingEnabled === "function") {
          window.__setLive2dRenderingEnabled(false);
        }
      }
    });
  }

  function setPressed(button, enabled) {
    if (!button) return;
    button.setAttribute("aria-pressed", String(!!enabled));
    button.classList.toggle("is-active", !!enabled);
    button.classList.toggle("is-disabled", !enabled);
  }

  function updateButtons() {
    setPressed(buttons.move, moveMode);
    setPressed(buttons.tracking, state.mouseTracking);
    setPressed(buttons.idle, state.idleMotion);
    setPressed(buttons.agent, state.agentMode);
    setPressed(buttons.tips, state.tips);
    if (buttons.size) {
      var percent = Math.round(state.scale * 100);
      var label = "调整大小（当前 " + percent + "%）";
      buttons.size.dataset.label = label;
      buttons.size.dataset.value = percent + "%";
      buttons.size.setAttribute("aria-label", label);
      buttons.size.title = label;
    }
  }

  function announce(message) {
    var status = toolbar && toolbar.querySelector(".waifu-tool__status");
    if (status) status.textContent = message;
    if (state.tips && typeof window.showMessage === "function") {
      window.showMessage(message, 2200);
    }
  }

  function ensureAgentRuntime() {
    if (window.__yusenWaifuChat) return Promise.resolve(window.__yusenWaifuChat);
    if (window.__yusenWaifuChatPromise) return window.__yusenWaifuChatPromise;
    window.__yusenWaifuChatPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "/live2d/js/live2d-chat.js";
      script.async = true;
      script.onload = function () {
        if (window.__yusenWaifuChat) resolve(window.__yusenWaifuChat);
        else reject(new Error("agent runtime did not initialize"));
      };
      script.onerror = function () { reject(new Error("agent runtime could not be loaded")); };
      document.head.appendChild(script);
    }).catch(function (error) {
      window.__yusenWaifuChatPromise = null;
      throw error;
    });
    return window.__yusenWaifuChatPromise;
  }

  function getBaseSize() {
    var baseWidth = Number(widget.dataset.live2dBaseWidth) || 220;
    var baseHeight = Number(widget.dataset.live2dBaseHeight) || Math.round(baseWidth * 1.3);
    return {width: baseWidth, height: baseHeight};
  }

  function applyScale() {
    if (!widget || !canvas) return;
    var base = getBaseSize();
    var width = Math.round(base.width * state.scale);
    var height = Math.round(base.height * state.scale);
    widget.style.width = width + "px";
    widget.style.height = height + "px";
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    widget.dataset.live2dScale = String(state.scale);
    window.dispatchEvent(new CustomEvent("yusen:live2d-layout", {
      detail: {width: width, height: height, scale: state.scale}
    }));
    schedulePositionUpdate();
  }

  function cycleSize() {
    var current = SIZE_STEPS.findIndex(function (step) {
      return Math.abs(step - state.scale) < 0.01;
    });
    state.scale = SIZE_STEPS[(current + 1) % SIZE_STEPS.length];
    saveState();
    applyScale();
    updateButtons();
    announce("看板娘大小已调整为 " + Math.round(state.scale * 100) + "%");
  }

  function applyTipsVisibility() {
    if (!tips || !widget) return;
    tips.hidden = !state.tips;
    widget.classList.toggle("waifu--tips-hidden", !state.tips);
    schedulePositionUpdate();
  }

  function applyRuntimeSettings() {
    var renderer = window.YusenLive2DRenderer;
    if (!renderer) return;
    if (typeof renderer.setMouseTrackingEnabled === "function") {
      renderer.setMouseTrackingEnabled(state.mouseTracking);
    }
    if (typeof renderer.setIdleMotionEnabled === "function") {
      renderer.setIdleMotionEnabled(state.idleMotion);
    }
  }

  function applyPosition() {
    if (!widget) return;
    if (!state.position) {
      widget.classList.remove("waifu--free-position");
      widget.style.removeProperty("left");
      widget.style.removeProperty("top");
      widget.style.right = "0px";
      widget.style.bottom = "0px";
    } else {
      var maxX = Math.max(0, window.innerWidth - widget.offsetWidth);
      var maxY = Math.max(0, window.innerHeight - widget.offsetHeight);
      widget.classList.add("waifu--free-position");
      widget.style.right = "auto";
      widget.style.bottom = "auto";
      widget.style.left = Math.round(state.position.x * maxX) + "px";
      widget.style.top = Math.round(state.position.y * maxY) + "px";
    }
    updateToolbarSide(true);
  }

  function schedulePositionUpdate() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = 0;
      applyPosition();
    });
  }

  function updateToolbarSide(forceLayout) {
    if (!widget) return;
    var rect = widget.getBoundingClientRect();
    var nextSide = rect.left < window.innerWidth * 0.42 ? "right" : "left";
    widget.dataset.toolbarSide = nextSide;
    updateToolbarOrigin(rect);
  }

  function setMoveMode(enabled) {
    moveMode = !!enabled;
    if (widget) widget.classList.toggle("waifu--move-mode", moveMode);
    updateButtons();
  }

  function beginDrag(event) {
    if (!moveMode || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var rect = widget.getBoundingClientRect();
    widget.classList.add("waifu--free-position", "waifu--dragging");
    widget.style.right = "auto";
    widget.style.bottom = "auto";
    widget.style.left = rect.left + "px";
    widget.style.top = rect.top + "px";
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    try { canvas.setPointerCapture(event.pointerId); } catch (error) {}
    window.addEventListener("pointermove", moveDrag, true);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
  }

  function moveDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var maxX = Math.max(0, window.innerWidth - widget.offsetWidth);
    var maxY = Math.max(0, window.innerHeight - widget.offsetHeight);
    var left = clamp(event.clientX - dragState.offsetX, 0, maxX);
    var top = clamp(event.clientY - dragState.offsetY, 0, maxY);
    widget.style.left = Math.round(left) + "px";
    widget.style.top = Math.round(top) + "px";
    updateToolbarSide();
  }

  function endDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var maxX = Math.max(0, window.innerWidth - widget.offsetWidth);
    var maxY = Math.max(0, window.innerHeight - widget.offsetHeight);
    var left = parseFloat(widget.style.left) || 0;
    var top = parseFloat(widget.style.top) || 0;
    state.position = {
      x: maxX ? clamp(left / maxX, 0, 1) : 0,
      y: maxY ? clamp(top / maxY, 0, 1) : 0
    };
    try { canvas.releasePointerCapture(dragState.pointerId); } catch (error) {}
    dragState = null;
    widget.classList.remove("waifu--dragging");
    window.removeEventListener("pointermove", moveDrag, true);
    window.removeEventListener("pointerup", endDrag, true);
    window.removeEventListener("pointercancel", endDrag, true);
    setMoveMode(false);
    saveState();
    applyPosition();
    announce("看板娘位置已保存");
  }

  function init() {
    widget = document.getElementById("waifu");
    canvas = document.getElementById("live2d");
    tips = document.getElementById("waifu-tips");
    if (!widget || !canvas) return false;

    createToolbar();
    if (typeof ResizeObserver === "function") {
      tipsResizeObserver = new ResizeObserver(schedulePositionUpdate);
      tipsResizeObserver.observe(tips);
    }
    canvas.addEventListener("pointerdown", beginDrag, true);
    window.addEventListener("resize", schedulePositionUpdate, {passive: true});
    window.addEventListener("yusen:live2d-renderer-ready", applyRuntimeSettings);
    window.addEventListener("yusen:live2d-ready", function () {
      widget.classList.add("waifu--ready");
      applyScale();
      applyPosition();
    });
    applyScale();
    applyPosition();
    applyTipsVisibility();
    applyRuntimeSettings();
    updateButtons();
    return true;
  }

  window.YusenLive2DControls = {
    version: 1,
    init: init,
    getState: getState,
    ensureAgentRuntime: ensureAgentRuntime,
    isMoveMode: function () { return moveMode; },
    resetPosition: function () {
      state.position = null;
      saveState();
      applyPosition();
    }
  };

  init();
})();
