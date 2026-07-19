(function () {
  "use strict";

  if (window.__live2dLoader) return;

  var loaderState = {
    status: "waiting",
    started: false,
    loaded: false,
    runtime: null
  };
  window.__live2dLoader = loaderState;

  var desktopMedia = window.matchMedia("(min-width: 900px)");
  var reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
  var scheduled = false;

  function canLoad() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return desktopMedia.matches &&
      !reducedMotionMedia.matches &&
      !(connection && connection.saveData) &&
      !/Android|webOS|iPhone|iPod|iPad|BlackBerry/i.test(navigator.userAgent);
  }

  function loadStyle(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(src);
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing && existing.dataset.loaded === "true") return Promise.resolve(src);
    return new Promise(function (resolve, reject) {
      var script = existing || document.createElement("script");
      function complete() {
        script.dataset.loaded = "true";
        resolve(src);
      }
      script.addEventListener("load", complete, {once: true});
      script.addEventListener("error", function () { reject(new Error("Failed to load " + src)); }, {once: true});
      if (!existing) {
        script.src = src;
        script.async = false;
        document.head.appendChild(script);
      }
    });
  }

  function mountWidget() {
    if (document.getElementById("waifu")) return;
    var baseWidth = Math.max(170, Math.min(240, window.innerWidth / 7));
    var baseHeight = baseWidth * 1.3;
    var widget = document.createElement("div");
    widget.className = "waifu";
    widget.id = "waifu";
    widget.tabIndex = 0;
    widget.setAttribute("aria-label", "Live2D 看板娘，聚焦或移入鼠标可显示设置");
    widget.dataset.live2dBaseWidth = String(Math.round(baseWidth));
    widget.dataset.live2dBaseHeight = String(Math.round(baseHeight));
    widget.style.width = Math.round(baseWidth) + "px";
    widget.style.height = Math.round(baseHeight) + "px";
    widget.innerHTML = '<div class="waifu-tips" id="waifu-tips" aria-live="polite"></div>' +
      '<canvas id="live2d" class="live2d" aria-hidden="true"></canvas>';
    document.body.appendChild(widget);
  }

  function supportsWebGL2() {
    try {
      var probe = document.createElement("canvas");
      var context = probe.getContext("webgl2", {
        alpha: true,
        antialias: false,
        powerPreference: "low-power"
      });
      if (!context) return false;
      var loseContext = context.getExtension("WEBGL_lose_context");
      if (loseContext) loseContext.loseContext();
      return true;
    } catch (error) {
      return false;
    }
  }

  function startLoading() {
    scheduled = false;
    if (loaderState.started || !canLoad()) {
      if (!loaderState.started) loaderState.status = "disabled";
      return;
    }
    if (document.hidden) {
      loaderState.status = "waiting-for-page";
      document.addEventListener("visibilitychange", function waitForVisible() {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", waitForVisible);
          scheduleLoading();
        }
      });
      return;
    }

    loaderState.started = true;
    loaderState.status = "loading";
    mountWidget();
    loadStyle("/live2d/live2dv3/waifu/waifu.css");

    var useCubismR5 = supportsWebGL2();
    loaderState.runtime = useCubismR5 ? "cubism-web-r5" : "pixi-compatibility";
    var resources = [
      ["/live2d/js/live2d-controls.js", "YusenLive2DControls"],
      ["/live2d/live2dv3/waifu/waifu-tips.js", null]
    ];
    if (useCubismR5) {
      resources = resources.concat([
        ["/live2d/cubism-r5/core/live2dcubismcore.min.js", "Live2DCubismCore"],
        ["/live2d/cubism-r5/live2d-cubism-r5.min.js", "YusenCubismR5"]
      ]);
    } else {
      resources = resources.concat([
        ["/live2d/live2dv3/pixi/pixi.min.js", "PIXI"],
        ["/live2d/live2dv3/js/live2dcubismcore.min.js", "Live2DCubismCore"],
        ["/live2d/live2dv3/js/live2dcubismframework.js", "LIVE2DCUBISMFRAMEWORK"],
        ["/live2d/live2dv3/js/live2dcubismpixi.js", "LIVE2DCUBISMPIXI"],
        ["/live2d/live2dv3/loadModelHome.js", "loadModel"]
      ]);
    }

    resources.reduce(function (chain, resource) {
      return chain.then(function () { return loadScript(resource[0], resource[1]); });
    }, Promise.resolve()).then(function () {
      var preferences = window.YusenLive2DControls
        ? window.YusenLive2DControls.getState()
        : {mouseTracking: true, idleMotion: true};
      if (useCubismR5) {
        if (!window.YusenCubismR5 || typeof window.YusenCubismR5.init !== "function") {
          throw new Error("Cubism Web R5 runtime is unavailable");
        }
        if (!window.YusenCubismR5.init({
          canvasId: "live2d",
          mouseTracking: preferences.mouseTracking,
          idleMotion: preferences.idleMotion
        })) {
          throw new Error("Cubism Web R5 could not initialize WebGL2");
        }
      } else {
        if (typeof window.loadModel !== "function") {
          throw new Error("Live2D compatibility loader is unavailable");
        }
        window.loadModel();
      }
      loaderState.loaded = true;
      loaderState.status = "ready";
    }).catch(function (error) {
      loaderState.status = "error";
      console.warn("[Live2D] The widget could not be initialized.", error);
      var widget = document.getElementById("waifu");
      if (widget) widget.remove();
    });
  }

  function scheduleLoading() {
    if (scheduled || loaderState.started || !canLoad()) {
      if (!canLoad() && !loaderState.started) loaderState.status = "disabled";
      return;
    }
    scheduled = true;
    loaderState.status = "scheduled";
    window.setTimeout(function () {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(startLoading, {timeout: 3000});
      } else {
        startLoading();
      }
    }, 2200);
  }

  function handleEnvironmentChange() {
    if (!loaderState.started && canLoad()) scheduleLoading();
    var widget = document.getElementById("waifu");
    if (widget) widget.style.display = canLoad() ? "flex" : "none";
    if (typeof window.__setLive2dRenderingEnabled === "function") {
      window.__setLive2dRenderingEnabled(canLoad());
    }
  }

  if (desktopMedia.addEventListener) desktopMedia.addEventListener("change", handleEnvironmentChange);
  if (reducedMotionMedia.addEventListener) reducedMotionMedia.addEventListener("change", handleEnvironmentChange);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleLoading, {once: true});
  } else {
    scheduleLoading();
  }
})();
