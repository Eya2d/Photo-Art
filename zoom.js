(function () {

  /* ============================
     منع زوم المتصفح
  ============================ */
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

  /* منع Pinch لتكبير الموقع بالكامل */
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  /* ============================
     Zoom حقيقي داخل .zoome فقط
  ============================ */
  document.querySelectorAll('.zoome').forEach(wrapper => {

    let scale = 1;
    const minScale = 1;
    const maxScale = 4;

    wrapper.style.transformOrigin = "top left";

    // للمؤشر (ماوس)
    wrapper.addEventListener('wheel', function (e) {

      if (!e.ctrlKey) return;
      e.preventDefault();

      const prevScale = scale;
      if (e.deltaY < 0) scale += 0.1;
      else scale -= 0.1;
      scale = Math.min(Math.max(minScale, scale), maxScale);

      const rect = wrapper.getBoundingClientRect();
      const offsetX = e.clientX - rect.left + wrapper.scrollLeft;
      const offsetY = e.clientY - rect.top + wrapper.scrollTop;

      wrapper.style.zoom = scale;

      wrapper.scrollLeft = (offsetX * scale / prevScale) - (e.clientX - rect.left);
      wrapper.scrollTop  = (offsetY * scale / prevScale) - (e.clientY - rect.top);

    }, { passive: false });

    // للمس (Pinch)
    let startDistance = 0;

    wrapper.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        startDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    wrapper.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault(); // منع الزوم الافتراضي للصفحة

        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        const delta = currentDistance - startDistance;
        startDistance = currentDistance;

        const prevScale = scale;
        scale += delta * 0.005; // التحكم بحساسية التكبير
        scale = Math.min(Math.max(minScale, scale), maxScale);

        wrapper.style.zoom = scale;

        // اختياري: يمكنك ضبط scroll أثناء Pinch
        // wrapper.scrollLeft *= scale / prevScale;
        // wrapper.scrollTop  *= scale / prevScale;
      }
    }, { passive: false });

  });

})();
