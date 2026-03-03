(function() {

    // انتظر حتى يصبح body جاهزاً
    function initTooltipSystem() {

        if (!document.body) {
            return setTimeout(initTooltipSystem, 50);
        }

        // ===========================
        // إنشاء Tooltip
        // ===========================
        const tooltip = document.createElement('div');
        tooltip.id = 'custom-tooltip';

        tooltip.classList.add('no-translate');
        tooltip.setAttribute('data-no-translate', 'true');

        Object.assign(tooltip.style, {
            position: 'absolute',
            padding: '6px 10px',
            background: '#4b5869',
            boxShadow: '0px 1px 5px #4b586960',
            color: '#fff',
            borderRadius: '4px',
            fontSize: '13px',
            pointerEvents: 'none',
            zIndex: 1000000000000000,
            maxWidth: '250px',
            wordWrap: 'break-word',
            opacity: 0,
            transition: 'opacity 0.2s',
            fontFamily: 'system-ui',
            display: 'none',
        });

        // السهم
        const arrow = document.createElement('div');
        arrow.classList.add('no-translate');
        Object.assign(arrow.style, {
            position: 'absolute',
            width: '0',
            height: '0'
        });

        tooltip.appendChild(arrow);
        document.body.appendChild(tooltip);

        let currentElement = null;
        let touchTimer = null;

        // ===========================
        // ترجمة النص
        // ===========================
        function translateIfNeeded(text) {
            try {
                if (typeof translateText === "function") {
                    const lang = localStorage.getItem("selectedLang") || "en";
                    return translateText(text, lang);
                }
            } catch(e) {}
            return text;
        }

        // ===========================
        // تموضع Tooltip
        // ===========================
        function positionTooltip(eOrEl) {
            const el = eOrEl.currentTarget || eOrEl;
            if (!el) return;

            const rect = el.getBoundingClientRect();
            const spacing = 10;
            const margin = 5;

            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            // ضع tooltip بشكل مبدئي بالقرب من العنصر
            tooltip.style.top = '0px';
            tooltip.style.left = '0px';
            tooltip.style.visibility = 'hidden';
            tooltip.style.display = 'block';

            // إعادة حساب الحجم بعد وضع النص
            const tRect = tooltip.getBoundingClientRect();

            let top, left, direction;

            const spaceTop = rect.top;
            const spaceBottom = window.innerHeight - rect.bottom;
            const spaceRight = window.innerWidth - rect.right;

            if (spaceTop >= tRect.height + spacing) {
                direction = 'top';
                top = rect.top + scrollY - tRect.height - spacing;
                left = rect.left + scrollX + rect.width / 2 - tRect.width / 2;
            }
            else if (spaceBottom >= tRect.height + spacing) {
                direction = 'bottom';
                top = rect.bottom + scrollY + spacing;
                left = rect.left + scrollX + rect.width / 2 - tRect.width / 2;
            }
            else if (spaceRight >= tRect.width + spacing) {
                direction = 'right';
                top = rect.top + scrollY + rect.height / 2 - tRect.height / 2;
                left = rect.right + scrollX + spacing;
            }
            else {
                direction = 'left';
                top = rect.top + scrollY + rect.height / 2 - tRect.height / 2;
                left = rect.left + scrollX - tRect.width - spacing;
            }

            // منع خروج الـ tooltip خارج الشاشة
            const newRect = tooltip.getBoundingClientRect();
            left = Math.max(scrollX + margin, Math.min(left, scrollX + window.innerWidth - newRect.width - margin));
            top = Math.max(scrollY + margin, Math.min(top, scrollY + window.innerHeight - newRect.height - margin));

            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
            tooltip.style.visibility = 'visible';

            const arrowSize = 6;
            arrow.style.border = 'none';

            // ======== السهم ملتصق دائمًا بالـ tooltip ========
            if (direction === 'top') {
                arrow.style.left = Math.min(Math.max(rect.left + rect.width/2 + scrollX - left - arrowSize, arrowSize),
                    newRect.width - arrowSize*2) + 'px';
                arrow.style.top = (newRect.height - 1) + 'px';
                arrow.style.borderLeft = arrowSize + 'px solid transparent';
                arrow.style.borderRight = arrowSize + 'px solid transparent';
                arrow.style.borderTop = arrowSize + 'px solid #4b5869';
            }

            if (direction === 'bottom') {
                arrow.style.left = Math.min(Math.max(rect.left + rect.width/2 + scrollX - left - arrowSize, arrowSize),
                    newRect.width - arrowSize*2) + 'px';
                arrow.style.top = (-arrowSize + 1) + 'px';
                arrow.style.borderLeft = arrowSize + 'px solid transparent';
                arrow.style.borderRight = arrowSize + 'px solid transparent';
                arrow.style.borderBottom = arrowSize + 'px solid #4b5869';
            }

            if (direction === 'right') {
                arrow.style.top = Math.min(Math.max(rect.top + rect.height/2 + scrollY - top - arrowSize, arrowSize),
                    newRect.height - arrowSize*2) + 'px';
                arrow.style.left = (-arrowSize + 1) + 'px';
                arrow.style.borderTop = arrowSize + 'px solid transparent';
                arrow.style.borderBottom = arrowSize + 'px solid transparent';
                arrow.style.borderRight = arrowSize + 'px solid #4b5869';
            }

            if (direction === 'left') {
                arrow.style.top = Math.min(Math.max(rect.top + rect.height/2 + scrollY - top - arrowSize, arrowSize),
                    newRect.height - arrowSize*2) + 'px';
                arrow.style.left = (newRect.width - 1) + 'px';
                arrow.style.borderTop = arrowSize + 'px solid transparent';
                arrow.style.borderBottom = arrowSize + 'px solid transparent';
                arrow.style.borderLeft = arrowSize + 'px solid #4b5869';
            }
        }

        // ===========================
        // عرض Tooltip
        // ===========================
        function showTooltip(e) {
            const el = e.currentTarget;

            let text = el.dataset.title || el.getAttribute('title');
            if (!text) return;

            currentElement = el;

            text = translateIfNeeded(text);

            tooltip.childNodes.forEach(node => {
                if (node.nodeType === 3) tooltip.removeChild(node);
            });

            tooltip.insertBefore(document.createTextNode(text), arrow);

            el.dataset.title = el.getAttribute('title') || el.dataset.title || text;
            el.removeAttribute('title');

            tooltip.style.opacity = 1;

            // إعادة حساب الحجم قبل التموضع
            tooltip.offsetHeight;

            positionTooltip(e);
        }

        function hideTooltip() {
            currentElement = null;
            tooltip.style.opacity = 0;
        }

        // ===========================
        // دعم اللمس
        // ===========================
        function handleTouch(e) {
            showTooltip(e);

            if (touchTimer) clearTimeout(touchTimer);

            touchTimer = setTimeout(() => {
                hideTooltip();
            }, 1700);
        }

        // ===========================
        // التفعيل
        // ===========================
        function enableTooltipLazy(el) {
            if (el.__tooltip_initialized) return;

            el.addEventListener('mouseenter', showTooltip);
            el.addEventListener('mouseleave', hideTooltip);
            el.addEventListener('mousemove', positionTooltip);
            el.addEventListener('touchstart', handleTouch, { passive: true });

            el.__tooltip_initialized = true;
        }

        document.querySelectorAll('[title], [data-title]').forEach(enableTooltipLazy);

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (node.id === 'custom-tooltip') return;

                    if (node.hasAttribute('title') || node.hasAttribute('data-title'))
                        enableTooltipLazy(node);

                    node.querySelectorAll &&
                    node.querySelectorAll('[title], [data-title]').forEach(enableTooltipLazy);
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // تشغيل بعد تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTooltipSystem);
    } else {
        initTooltipSystem();
    }

})();
