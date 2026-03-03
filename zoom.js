(function () {

  /* منع زوم المتصفح */
  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === '+' || key === '-' || key === '=' || key === '0') {
        e.preventDefault();
      }
    }
  });

  /* ===================================== */

  document.querySelectorAll('.zoome').forEach(wrapper => {

    let scale = 1;
    const minScale = 1;
    const maxScale = 4;

    wrapper.style.transformOrigin = "top left";

    wrapper.addEventListener('wheel', function (e) {

      if (!e.ctrlKey) return;
      e.preventDefault();

      const prevScale = scale;

      if (e.deltaY < 0) {
        scale += 0.1;
      } else {
        scale -= 0.1;
      }

      scale = Math.min(Math.max(minScale, scale), maxScale);

      /* نحسب مكان الماوس داخل الديف */
      const rect = wrapper.getBoundingClientRect();
      const offsetX = e.clientX - rect.left + wrapper.scrollLeft;
      const offsetY = e.clientY - rect.top + wrapper.scrollTop;

      /* تكبير حقيقي */
      wrapper.style.zoom = scale;   // يعمل جيداً في Chrome

      /* الحفاظ على مكان الماوس بعد التكبير */
      wrapper.scrollLeft = (offsetX * scale / prevScale) - (e.clientX - rect.left);
      wrapper.scrollTop  = (offsetY * scale / prevScale) - (e.clientY - rect.top);

    }, { passive: false });

  });

})();
