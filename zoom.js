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





window.onload = function() {
    // قائمة العناصر المستهدفة
    const targetElements = 'div, a, button, input, select';

    // تخزين الـ cursor الأصلي لكل عنصر
    const originalCursors = new WeakMap();

    // دالة لإضافة cursor بالقوة (!important)
    function setCursorImportant(el, value) {
        el.style.setProperty('cursor', value, 'important');
    }

    // عند لمس الشاشة
    function handleTouchStart(e) {
        const el = e.target.closest(targetElements);
        if (!el) return;

        // حفظ cursor الأصلي إذا لم يُحفظ مسبقاً
        if (!originalCursors.has(el)) {
            originalCursors.set(el, el.style.cursor || '');
        }

        // تعيين cursor بالقوة
        setCursorImportant(el, 'context-menu');
    }

    // عند تحريك الماوس/المؤشر
    function handleMouseMove(e) {
        const el = e.target.closest(targetElements);
        if (!el) return;

        // إعادة الـ cursor الأصلي بالقوة
        if (originalCursors.has(el)) {
            setCursorImportant(el, originalCursors.get(el));
            originalCursors.delete(el);
        }
    }

    // إضافة المستمعين للأحداث
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('mousemove', handleMouseMove);
};
