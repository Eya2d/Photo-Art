(function () {

  /* منع الزوم بالكيبورد */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === '+' || key === '-' || key === '=' || key === '0') {
        e.preventDefault();
      }
    }
  });

  /* منع Ctrl + عجلة الماوس */
  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, { passive: false });

  /* منع الزوم باللمس (Pinch) */
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  /* منع Double Tap */
  let lastTouch = 0;
  document.addEventListener('touchend', function (e) {
    const now = Date.now();
    if (now - lastTouch < 300) {
      e.preventDefault();
    }
    lastTouch = now;
  }, false);

  /* إجبار الزوم = 100% */
  document.body.style.zoom = "100%";
  document.documentElement.style.zoom = "100%";

})();
