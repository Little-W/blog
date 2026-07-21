(function () {
  "use strict";

  var STORAGE_KEY = "yusen-effect-settings-v1";
  var DEFAULTS = {
    enabled: true,
    live2d: true,
    sakura: true,
    bubbles: true,
    stars: true,
    particles: true,
    fireworks: true,
    blur: true,
    frameRate: 0,
    live2dFrameRate: -1,
    lowPowerTimeout: 0,
    complexity: "balanced"
  };
  var FRAME_RATE_OPTIONS = [0, 15, 24, 30, 45, 60];
  var LIVE2D_FRAME_RATE_OPTIONS = [-1].concat(FRAME_RATE_OPTIONS);
  var LOW_POWER_TIMEOUT_OPTIONS = [0, 30, 60, 180, 300, 600];
  var LOW_POWER_FRAME_RATE = 15;
  var COMPLEXITY_OPTIONS = ["low", "balanced", "high"];
  var COMPLEXITY_MULTIPLIERS = { low: 0.5, balanced: 1, high: 1.5 };
  var nativeRequestAnimationFrame = (window.requestAnimationFrame || function (callback) {
    return window.setTimeout(function () { callback(Date.now()); }, 16);
  }).bind(window);
  var nativeCancelAnimationFrame = (window.cancelAnimationFrame || window.clearTimeout).bind(window);
  var frameRequests = {};
  var lastFrameByCallback = new WeakMap();
  var nextFrameRequestId = 1;
  var lowPowerTimer = 0;
  var lowPowerModeActive = false;
  var lastInteractionAt = Date.now();

  function normalizeSettings(stored) {
    var settings = Object.assign({}, DEFAULTS, stored || {});
    var frameRate = Number(settings.frameRate);
    var live2dFrameRate = Number(settings.live2dFrameRate);
    var lowPowerTimeout = Number(settings.lowPowerTimeout);
    settings.frameRate = FRAME_RATE_OPTIONS.indexOf(frameRate) === -1 ? 0 : frameRate;
    settings.live2dFrameRate = LIVE2D_FRAME_RATE_OPTIONS.indexOf(live2dFrameRate) === -1
      ? DEFAULTS.live2dFrameRate
      : live2dFrameRate;
    settings.lowPowerTimeout = LOW_POWER_TIMEOUT_OPTIONS.indexOf(lowPowerTimeout) === -1
      ? DEFAULTS.lowPowerTimeout
      : lowPowerTimeout;
    settings.blur = settings.blur !== false;
    settings.complexity = COMPLEXITY_OPTIONS.indexOf(settings.complexity) === -1 ? "balanced" : settings.complexity;
    return settings;
  }

  function readSettings() {
    var stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch (error) {
      console.warn("[Effects] Ignoring invalid saved settings.", error);
    }
    return normalizeSettings(stored);
  }

  var settings = readSettings();
  var loaded = {};

  function isEnabled(name) {
    return settings.enabled !== false && settings[name] !== false;
  }

  function getFrameRate() {
    return getEffectiveFrameRate(settings.frameRate || 0);
  }

  function getLive2DFrameRate() {
    var frameRate = settings.live2dFrameRate === -1
      ? getFrameRate()
      : settings.live2dFrameRate || 0;
    return getEffectiveFrameRate(frameRate);
  }

  function getEffectiveFrameRate(frameRate) {
    if (!lowPowerModeActive) return frameRate || 0;
    return frameRate ? Math.min(frameRate, LOW_POWER_FRAME_RATE) : LOW_POWER_FRAME_RATE;
  }

  function getLowPowerTimeout() {
    return settings.lowPowerTimeout || 0;
  }

  function setLowPowerMode(active) {
    active = !!active;
    if (lowPowerModeActive === active) return;
    lowPowerModeActive = active;
    document.documentElement.dataset.yusenLowPower = active ? "on" : "off";
    window.dispatchEvent(new CustomEvent("yusen:low-power-mode-change", {
      detail: {active: active, frameRate: active ? LOW_POWER_FRAME_RATE : getFrameRate()}
    }));
  }

  function armLowPowerTimer() {
    window.clearTimeout(lowPowerTimer);
    lowPowerTimer = 0;

    var timeoutSeconds = getLowPowerTimeout();
    if (!timeoutSeconds) {
      setLowPowerMode(false);
      return;
    }

    var remaining = timeoutSeconds * 1000 - (Date.now() - lastInteractionAt);
    if (remaining <= 0) {
      setLowPowerMode(true);
      return;
    }

    lowPowerTimer = window.setTimeout(function () {
      lowPowerTimer = 0;
      if (Date.now() - lastInteractionAt >= timeoutSeconds * 1000 - 20) {
        setLowPowerMode(true);
      } else {
        armLowPowerTimer();
      }
    }, remaining);
  }

  function noteUserInteraction(event) {
    if (!getLowPowerTimeout()) return;
    var now = Date.now();
    // 鼠标移动事件频率很高；在未进入低功耗模式时按短间隔合并重置即可。
    if (event && event.type === "pointermove" && !lowPowerModeActive && now - lastInteractionAt < 750) return;
    lastInteractionAt = now;
    setLowPowerMode(false);
    armLowPowerTimer();
  }

  function applyBlurPreference() {
    document.documentElement.dataset.yusenBlur = settings.blur === false ? "off" : "on";
  }

  function applyLive2DPreference() {
    var enabled = isEnabled("live2d");
    var widget = document.getElementById("waifu");
    if (widget) {
      widget.hidden = !enabled;
      widget.setAttribute("aria-hidden", String(!enabled));
    }
    if (typeof window.__setLive2dRenderingEnabled === "function") {
      window.__setLive2dRenderingEnabled(enabled);
    }
  }

  function setEffectEnabled(name, enabled) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, name) || name === "enabled") {
      return false;
    }
    var nextSettings = Object.assign({}, settings);
    nextSettings[name] = !!enabled;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
    } catch (error) {
      // Storage can be unavailable in privacy mode; keep the setting for this page.
    }
    window.dispatchEvent(new CustomEvent("yusen:effects-settings-change", {
      detail: nextSettings
    }));
    return true;
  }

  function applyRuntimeSettings(nextSettings) {
    settings = normalizeSettings(nextSettings);
    if (window.YusenEffects) {
      window.YusenEffects.settings = Object.assign({}, settings);
    }
    applyBlurPreference();
    applyLive2DPreference();
    lastInteractionAt = Date.now();
    setLowPowerMode(false);
    armLowPowerTimer();
  }

  function getEffectComplexity(name, baseValue, minimum) {
    var multiplier = COMPLEXITY_MULTIPLIERS[settings.complexity] || COMPLEXITY_MULTIPLIERS.balanced;
    // 为将来单项复杂度扩展预留：旧设置不存在该字段时自然回退到全局档位。
    if (settings.effectComplexity && Number(settings.effectComplexity[name]) > 0) {
      multiplier = Number(settings.effectComplexity[name]);
    }
    return Math.max(minimum || 1, Math.round(Number(baseValue) * multiplier));
  }

  function requestEffectAnimationFrame(callback) {
    var frameRate = getFrameRate();
    if (!frameRate) return nativeRequestAnimationFrame(callback);
    var requestId = nextFrameRequestId++;
    var frame = { nativeId: 0 };
    frameRequests[requestId] = frame;
    var interval = 1000 / frameRate;
    function tick(timestamp) {
      if (!frameRequests[requestId]) return;
      var previous = lastFrameByCallback.get(callback) || 0;
      if (!previous || timestamp - previous >= interval - 0.5) {
        lastFrameByCallback.set(callback, timestamp);
        delete frameRequests[requestId];
        callback(timestamp);
        return;
      }
      frame.nativeId = nativeRequestAnimationFrame(tick);
    }
    frame.nativeId = nativeRequestAnimationFrame(tick);
    return requestId;
  }

  function cancelEffectAnimationFrame(requestId) {
    var frame = frameRequests[requestId];
    if (!frame) {
      nativeCancelAnimationFrame(requestId);
      return;
    }
    delete frameRequests[requestId];
    nativeCancelAnimationFrame(frame.nativeId);
  }

  function createCanvas(options) {
    var canvas = options.selector && document.querySelector(options.selector);
    if (canvas) return canvas;
    canvas = document.createElement("canvas");
    if (options.id) canvas.id = options.id;
    if (options.className) canvas.className = options.className;
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    return canvas;
  }

  function loadScript(effect) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = effect.src;
      script.async = false;
      script.dataset.siteEffect = effect.name;
      if (effect.attributes) {
        Object.keys(effect.attributes).forEach(function (name) {
          script.setAttribute(name, effect.attributes[name]);
        });
      }
      script.onload = function () {
        loaded[effect.name] = true;
        resolve(effect.name);
      };
      script.onerror = function () {
        reject(new Error("Failed to load " + effect.src));
      };
      document.body.appendChild(script);
    });
  }

  var effects = [
    {
      name: "sakura",
      src: "/custom/js/sakura.js"
    },
    {
      name: "bubbles",
      src: "/custom/js/paopao.js",
      prepare: function () {
        createCanvas({selector: "#paopao", id: "paopao", className: "paopao"});
      }
    },
    {
      name: "stars",
      src: "/custom/js/nagareboshi.js"
    },
    {
      name: "particles",
      src: "/custom/js/canvas-nest.min.js",
      attributes: {
        count: String(getEffectComplexity("particles", 45, 12)),
        opacity: "0.32",
        color: "0,165,235",
        zIndex: "-1"
      }
    },
    {
      name: "fireworks",
      src: "/custom/js/fireworks.min.js",
      prepare: function () {
        createCanvas({selector: ".fireworks", className: "fireworks"});
      }
    },
    {
      name: "live2d",
      src: "/live2d/js/loadmodel.js"
    }
  ];

  window.YusenEffects = {
    storageKey: STORAGE_KEY,
    defaults: Object.assign({}, DEFAULTS),
    settings: Object.assign({}, settings),
    isEnabled: isEnabled,
    getFrameRate: getFrameRate,
    getLive2DFrameRate: getLive2DFrameRate,
    getLowPowerTimeout: getLowPowerTimeout,
    isLowPowerModeActive: function() { return lowPowerModeActive; },
    isBlurEnabled: function() { return settings.blur !== false; },
    getComplexity: function() { return settings.complexity; },
    getEffectComplexity: getEffectComplexity,
    setEffectEnabled: setEffectEnabled,
    requestAnimationFrame: requestEffectAnimationFrame,
    cancelAnimationFrame: cancelEffectAnimationFrame,
    loaded: loaded
  };

  window.addEventListener("yusen:effects-settings-change", function(event) {
    if (!event || !event.detail || typeof event.detail !== "object") return;
    applyRuntimeSettings(event.detail);
  });
  window.addEventListener("storage", function(event) {
    if (event.key !== STORAGE_KEY) return;
    try {
      applyRuntimeSettings(JSON.parse(event.newValue || "{}") || {});
    } catch (error) {
      console.warn("[Effects] Ignoring invalid synchronized settings.", error);
    }
  });

  ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"].forEach(function(type) {
    window.addEventListener(type, noteUserInteraction, {passive: true});
  });

  document.documentElement.dataset.yusenLowPower = "off";
  armLowPowerTimer();

  if (settings.enabled === false) {
    applyBlurPreference();
    document.documentElement.dataset.effects = "off";
    return;
  }

  applyBlurPreference();
  document.documentElement.dataset.effects = "on";
  effects.reduce(function (chain, effect) {
    if (!isEnabled(effect.name)) return chain;
    return chain.then(function () {
      if (effect.prepare) effect.prepare();
      return loadScript(effect).catch(function (error) {
        console.warn("[Effects] " + effect.name + " was not loaded.", error);
      });
    });
  }, Promise.resolve());
})();
