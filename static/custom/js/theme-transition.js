(function () {
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  function install() {
    if (!document.body || document.getElementById('theme-transition-sweep')) return;
    var sweep = document.createElement('div');
    sweep.id = 'theme-transition-sweep';
    sweep.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sweep);

    var previousTheme = root.getAttribute('data-theme') || 'light';
    var clearTimer = null;
    var coverTimer = null;
    var transitionFrame = null;
    var replayingThemeToggle = false;

    function isThemeToggle(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('button.clean-btn[aria-label*="dark"][aria-label*="light"], button[aria-label*="浅色"][aria-label*="暗黑"]');
    }

    // 在实际切换主题前先只给内容区盖上一层半透明旧主题。动画只改变 opacity，
    // 不读布局、不让页面上成百上千个节点同时 transition。
    document.addEventListener('click', function(event) {
      var button = isThemeToggle(event.target);
      if (!button || replayingThemeToggle || event.defaultPrevented) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.clearTimeout(coverTimer);
      window.clearTimeout(clearTimer);
      window.cancelAnimationFrame(transitionFrame);
      sweep.dataset.from = root.getAttribute('data-theme') || 'light';
      root.classList.remove('theme-transitioning');
      root.classList.add('theme-transition-covering');
      coverTimer = window.setTimeout(function() {
        replayingThemeToggle = true;
        button.click();
        replayingThemeToggle = false;
      }, 110);
    }, true);

    var observer = new MutationObserver(function (records) {
      var changed = records.some(function (record) { return record.attributeName === 'data-theme'; });
      var nextTheme = root.getAttribute('data-theme') || 'light';
      if (!changed || nextTheme === previousTheme) return;

      sweep.dataset.from = previousTheme;
      sweep.dataset.to = nextTheme;
      root.classList.remove('theme-transitioning', 'theme-transition-covering');
      window.clearTimeout(clearTimer);
      window.cancelAnimationFrame(transitionFrame);
      // 下一帧再淡出，避免读取布局造成强制回流。
      transitionFrame = window.requestAnimationFrame(function () {
        root.classList.add('theme-transitioning');
        clearTimer = window.setTimeout(function () {
          root.classList.remove('theme-transitioning');
        }, 360);
      });
      previousTheme = nextTheme;
    });

    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}());
