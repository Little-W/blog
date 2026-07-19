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
    frameRate: 0,
    complexity: "balanced"
  };
  var FRAME_RATE_OPTIONS = [0, 15, 24, 30, 45, 60];
  var COMPLEXITY_OPTIONS = ["low", "balanced", "high"];
  var COMPLEXITY_MULTIPLIERS = { low: 0.5, balanced: 1, high: 1.5 };
  var nativeRequestAnimationFrame = (window.requestAnimationFrame || function (callback) {
    return window.setTimeout(function () { callback(Date.now()); }, 16);
  }).bind(window);
  var nativeCancelAnimationFrame = (window.cancelAnimationFrame || window.clearTimeout).bind(window);
  var frameRequests = {};
  var lastFrameByCallback = new WeakMap();
  var nextFrameRequestId = 1;

  function readSettings() {
    var stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch (error) {
      console.warn("[Effects] Ignoring invalid saved settings.", error);
    }
    var settings = Object.assign({}, DEFAULTS, stored);
    var frameRate = Number(settings.frameRate);
    settings.frameRate = FRAME_RATE_OPTIONS.indexOf(frameRate) === -1 ? 0 : frameRate;
    settings.complexity = COMPLEXITY_OPTIONS.indexOf(settings.complexity) === -1 ? "balanced" : settings.complexity;
    return settings;
  }

  var settings = readSettings();
  var loaded = {};

  function isEnabled(name) {
    return settings.enabled !== false && settings[name] !== false;
  }

  function getFrameRate() {
    return settings.frameRate || 0;
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
    getComplexity: function() { return settings.complexity; },
    getEffectComplexity: getEffectComplexity,
    requestAnimationFrame: requestEffectAnimationFrame,
    cancelAnimationFrame: cancelEffectAnimationFrame,
    loaded: loaded
  };

  if (settings.enabled === false) {
    document.documentElement.dataset.effects = "off";
    return;
  }

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
