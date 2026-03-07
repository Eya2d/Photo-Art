document.addEventListener("DOMContentLoaded", () => {
const sidebar = document.getElementById('sidebar');
const pageView = document.getElementById('page-view');

// متغيرات IndexedDB
const DB_NAME = 'ImageGalleryDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';
let db;
let images = [];
let pageContainers = [];

// عناصر مؤشر التحميل
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// =======================================
// متغيرات التحكم في إيقاف PDF
// =======================================
let stopPDFGeneration = false;
let isGeneratingPDF = false;

// متغيرات للتحكم في التحميل الديناميكي
let loadedPages = new Set();
let canvasReferences = new Map();
let currentVisiblePage = -1; // تتبع الصفحة الحالية المرئية

// متغيرات للتحكم في التمرير السريع
let isScrolling = false;
let scrollTimeout;
let touchEndTimeout;
let isTouching = false;
let lastScrollTop = 0;
let scrollDirection = 'down';
let fastScrollCount = 0;
let lastScrollPosition = 0;
let scrollStopDetected = false;

// متغير للتخزين المؤقت للـ PDF
let cachedPDFBlob = null;
let isPreGeneratingPDF = false;

// متغيرات للتحكم في حالة الأزرار
let isShareButtonReady = false;
let isDownloadButtonReady = false;

// دوال تأخير
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =======================================
// دالة لإظهار تأثير Shimmer على الأزرار فقط
// =======================================
function showShimmer(button) {
    if (button) {
        button.classList.add('shimmer-loading');
    }
}

function hideShimmer() {
    // إزالة كلاس shimmer من جميع الأزرار
    document.querySelectorAll('.shimmer-loading').forEach(btn => {
        btn.classList.remove('shimmer-loading');
    });
}

// =======================================
// دالة لتفعيل/تعطيل الأزرار الرئيسية (معدلة)
// =======================================
function setButtonsState(shareState, downloadState, preserveExisting = true) {
    const shareBtn = document.getElementById('share-button');
    const downloadBtn = document.getElementById('download-button');
    
    if (preserveExisting && cachedPDFBlob !== null) {
        // إذا كان لدينا PDF مخزن، نفعّل الأزرار دائماً
        shareState = true;
        downloadState = true;
    }
    
    if (shareBtn) {
        shareBtn.disabled = !shareState;
        shareBtn.style.opacity = shareState ? '1' : '0.5';
        shareBtn.style.cursor = shareState ? 'pointer' : 'not-allowed';
    }
    
    if (downloadBtn) {
        downloadBtn.disabled = !downloadState;
        downloadBtn.style.opacity = downloadState ? '1' : '0.5';
        downloadBtn.style.cursor = downloadState ? 'pointer' : 'not-allowed';
    }
    
    isShareButtonReady = shareState;
    isDownloadButtonReady = downloadState;
}

// =======================================
// دالة للتحقق من جاهزية PDF (معدلة)
// =======================================
function checkPDFReady() {
    // زر التنزيل يصبح جاهزاً إذا كان هناك PDF مخزن أو إذا انتهى التحميل المسبق
    const downloadReady = cachedPDFBlob !== null || !isPreGeneratingPDF;
    
    // زر المشاركة يحتاج إلى PDF مخزن فقط (لضمان التفاعل المباشر)
    const shareReady = cachedPDFBlob !== null;
    
    // لا نعيد تعيين الأزرار إذا كانت مفعلة بالفعل ولديها PDF
    if (cachedPDFBlob !== null) {
        setButtonsState(true, true);
    } else {
        setButtonsState(shareReady, downloadReady);
    }
    
    if (shareReady || downloadReady) {
        hideShimmer();
    }
}

// =======================================
// إيقاف إنشاء PDF
// =======================================
function stopPDF() {
    if (isGeneratingPDF) {
        stopPDFGeneration = true;
        const stopBtn = document.getElementById('stop-bar');
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
        progressText.textContent = 'جاري الإيقاف...';
    }
}

// =======================================
// تهيئة IndexedDB
// =======================================
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject('Error opening database');
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('order', 'order', { unique: false });
                console.log('Object store created');
            }
        };
    });
}

// =======================================
// تحميل الصور من IndexedDB
// =======================================
async function loadImagesFromDB() {
    try {
        if (!db) await initDB();
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('order');
        const request = index.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const items = request.result;
                items.sort((a, b) => a.order - b.order);
                images = items.map(item => item.dataURL);
                resolve(images);
            };
            
            request.onerror = () => {
                reject('Error loading images');
            };
        });
    } catch (error) {
        console.error('Error loading from DB:', error);
        images = [];
    }
}

// =======================================
// عرض القائمة الجانبية
// =======================================
async function displaySidebar() {
    sidebar.innerHTML = '';

    for (let index = 0; index < images.length; index++) {
        const src = images[index];

        const item = document.createElement('div');
        item.classList.add('sidebar-item');
        if (index === 0) item.classList.add('active');

        const inner = document.createElement('button');
        inner.classList.add('sidebar-item-inner', 'Wave-cloud');
        
        // ★★★ ضمان عدم إزالة الصورة من الكانفا ★★★
        // حفظ الرابط الأصلي في attribute مخصص لاستخدامه لاحقاً إذا لزم الأمر
        inner.setAttribute('data-original-src', src);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: true });
        canvas.width = 300;
        canvas.height = 300;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        const image = new Image();
        image.src = src;
        image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (isImageWhite(image)) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }
            
            let scale = Math.min(canvas.width / image.width, canvas.height / image.height);
            let w = image.width * scale;
            let h = image.height * scale;
            ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            
            ctx.shadowColor = 'transparent';
        };

        inner.appendChild(canvas);

        const pageNum = document.createElement('div');
        pageNum.classList.add('page-number');
        pageNum.textContent = `${index + 1}`;

        item.appendChild(inner);
        item.appendChild(pageNum);

        item.addEventListener('click', () => scrollToPage(index));

        sidebar.appendChild(item);
        await delay(1);
    }
}

// =======================================
// تحميل صورة في Canvas (معدلة لإضافة وإزالة عنصر التحميل من DOM)
// =======================================
function loadImageIntoCanvas(canvas, imageSrc, index) {
    return new Promise((resolve) => {
        // الحصول على الـ container الخاص بالصفحة
        const container = pageContainers[index];
        
        // إنشاء عنصر التحميل وإضافته للـ DOM فقط عند الحاجة
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'page-loading';
        loadingDiv.innerHTML = '<img src="Image/loading.gif">';
        loadingDiv.style.display = 'flex'; // إظهاره فور إضافته
        container.appendChild(loadingDiv); // إضافته للـ DOM الآن
        
        const ctx = canvas.getContext('2d', { alpha: true });
        
        const image = new Image();
        image.src = imageSrc;
        image.onload = () => {
            // إزالة الصورة السابقة أولاً
            unloadPreviousPage(index);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (isImageWhite(image)) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 4;
                ctx.shadowOffsetY = 4;
            }
            
            let scale = Math.min(canvas.width / image.width, canvas.height / image.height);
            let w = image.width * scale;
            let h = image.height * scale;
            ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            
            ctx.shadowColor = 'transparent';
            
            loadedPages.add(index);
            canvasReferences.set(index, image);
            currentVisiblePage = index; // تحديث الصفحة الحالية
            
            // إزالة عنصر التحميل تماماً من DOM بعد ظهور الصورة
            if (loadingDiv && loadingDiv.parentNode) {
                loadingDiv.remove(); // إزالة كاملة من DOM
            }
            
            resolve();
        };
        
        // معالجة الخطأ في تحميل الصورة
        image.onerror = () => {
            console.error(`فشل تحميل الصورة ${index + 1}`);
            if (loadingDiv && loadingDiv.parentNode) {
                loadingDiv.remove(); // إزالة عنصر التحميل في حالة الفشل أيضاً
            }
            resolve(); // نكمل على أي حال
        };
    });
}

// =======================================
// إزالة الصفحة السابقة (معدلة لإزالة عناصر التحميل العالقة)
// =======================================
function unloadPreviousPage(newPageIndex) {
    if (currentVisiblePage !== -1 && currentVisiblePage !== newPageIndex) {
        const previousContainer = pageContainers[currentVisiblePage];
        if (previousContainer) {
            const previousCanvas = previousContainer.querySelector('canvas');
            unloadImageFromCanvas(previousCanvas, currentVisiblePage);
            
            // التأكد من إزالة أي عنصر تحميل عالق في الصفحة السابقة
            const oldLoadingDiv = previousContainer.querySelector('.page-loading');
            if (oldLoadingDiv) {
                oldLoadingDiv.remove();
            }
            
            console.log(`تم إزالة الصفحة ${currentVisiblePage + 1} من DOM`);
        }
    }
}

// =======================================
// تفريغ صورة من Canvas (معدلة)
// =======================================
function unloadImageFromCanvas(canvas, index) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    loadedPages.delete(index);
    canvasReferences.delete(index);
    
    // إزالة أي عنصر تحميل متبقي عند تفريغ الكانفاس
    const container = pageContainers[index];
    if (container) {
        const loadingDiv = container.querySelector('.page-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }
}

// =======================================
// عرض الصفحات (معدلة - بدون إضافة عنصر التحميل مسبقاً)
// =======================================
async function displayPages() {
    pageView.innerHTML = '';
    pageContainers = [];
    loadedPages.clear();
    canvasReferences.clear();
    currentVisiblePage = -1; // إعادة تعيين الصفحة الحالية

    for (let index = 0; index < images.length; index++) {
        const container = document.createElement('div');
        container.classList.add('page-container');
        container.dataset.index = index;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: true });

        const scaleFactor = 4;
        canvas.width = 794 * scaleFactor;
        canvas.height = 1123 * scaleFactor;
        canvas.style.width = '794px';
        canvas.style.height = '1123px';

        container.appendChild(canvas);
        
        // ❌ لم نعد نضيف عنصر التحميل هنا
        // سيتم إضافته فقط عند الحاجة في loadImageIntoCanvas
        
        pageView.appendChild(container);
        pageContainers.push(container);
    }

    if (images.length > 0) {
        await loadImageIntoCanvas(pageContainers[0].querySelector('canvas'), images[0], 0);
    }
}

// =======================================
// التحقق إذا كانت الصورة بيضاء بالكامل
// =======================================
function isImageWhite(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let whitePixels = 0;
    const totalPixels = data.length / 4;
    
    for (let i = 0; i < data.length; i += 40) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        if (r > 250 && g > 250 && b > 250 && a > 250) {
            whitePixels++;
        }
    }
    
    return (whitePixels / (totalPixels / 10)) > 0.9;
}

// =======================================
// معالجة التمرير (معدلة للتمرير السريع مع كشف التوقف)
// =======================================
function handleScroll() {
    const currentScrollTop = pageView.scrollTop;
    
    // تحديد اتجاه التمرير
    scrollDirection = currentScrollTop > lastScrollTop ? 'down' : 'up';
    lastScrollTop = currentScrollTop;
    
    // زيادة عداد التمرير السريع
    fastScrollCount++;
    
    // منع التحميل أثناء التمرير
    if (!isScrolling) {
        isScrolling = true;
        scrollStopDetected = false;
    }
    
    // التحقق من توقف التمرير
    if (Math.abs(currentScrollTop - lastScrollPosition) < 5) {
        // إذا كان التمرير بطيئاً جداً أو متوقفاً
        if (!scrollStopDetected) {
            scrollStopDetected = true;
            // تحميل الصفحة الحالية فوراً إذا كان التمرير بطيئاً
            loadCurrentPage();
        }
    }
    lastScrollPosition = currentScrollTop;
    
    // إعادة تعيين المؤقت في كل مرة يتحرك فيها المستخدم
    clearTimeout(scrollTimeout);
    clearTimeout(touchEndTimeout);
    
    // انتظار حتى يتوقف التمرير
    scrollTimeout = setTimeout(() => {
        // التحقق من أن المستخدم توقف بالفعل عن التمرير
        if (!isTouching) {
            handleScrollEnd();
        }
    }, 10);
    
    // تحديث العنصر النشط أثناء التمرير (بدون تحميل)
    updateSidebarActive(getCurrentPageIndex());
}

// =======================================
// تحميل الصفحة الحالية (معدلة)
// =======================================
function loadCurrentPage() {
    const centerIndex = getCenterPageIndex();
    if (centerIndex >= 0 && centerIndex < images.length) {
        if (!loadedPages.has(centerIndex) || currentVisiblePage !== centerIndex) {
            console.log(`تحميل الصفحة ${centerIndex + 1} فور توقف التمرير`);
            const container = pageContainers[centerIndex];
            const canvas = container.querySelector('canvas');
            
            // التأكد من عدم وجود عنصر تحميل قديم قبل البدء
            const oldLoadingDiv = container.querySelector('.page-loading');
            if (oldLoadingDiv) {
                oldLoadingDiv.remove();
            }
            
            loadImageIntoCanvas(canvas, images[centerIndex], centerIndex);
        }
    }
}

// =======================================
// معالجة بداية اللمس
// =======================================
function handleTouchStart() {
    isTouching = true;
    isScrolling = true;
    fastScrollCount = 0;
    scrollStopDetected = false;
}

// =======================================
// معالجة حركة اللمس (مضافة جديدة)
// =======================================
function handleTouchMove() {
    // إعادة تعيين مؤقت التوقف
    clearTimeout(touchEndTimeout);
    scrollStopDetected = false;
}

// =======================================
// معالجة نهاية اللمس (محدثة)
// =======================================
function handleTouchEnd() {
    isTouching = false;
    
    // تحميل الصفحة الحالية فور رفع اللمس
    loadCurrentPage();
    
    // انتظر قليلاً للتأكد من أن المستخدم لا يزال في نفس المكان
    touchEndTimeout = setTimeout(() => {
        if (!isScrolling) {
            handleScrollEnd();
        } else {
            // إذا كان لا يزال في وضع التمرير، انتظر أكثر
            setTimeout(() => {
                if (!isScrolling && !isTouching) {
                    handleScrollEnd();
                }
            }, 50);
        }
    }, 100);
}

// =======================================
// التحقق إذا كانت الصفحة مرئية
// =======================================
function isPageVisible(index) {
    const container = pageContainers[index];
    if (!container) return false;
    
    const viewportHeight = pageView.clientHeight;
    const scrollTop = pageView.scrollTop;
    const containerTop = container.offsetTop;
    const containerBottom = containerTop + container.offsetHeight;
    
    return (containerBottom >= scrollTop && containerTop <= scrollTop + viewportHeight);
}

// =======================================
// الحصول على الصفحة المركزية في الشاشة
// =======================================
function getCenterPageIndex() {
    const viewportHeight = pageView.clientHeight;
    const scrollTop = pageView.scrollTop;
    const viewportCenter = scrollTop + viewportHeight / 2;
    
    let centerIndex = 0;
    let minDistance = Infinity;
    
    pageContainers.forEach((container, index) => {
        const containerTop = container.offsetTop;
        const containerBottom = containerTop + container.offsetHeight;
        const containerCenter = (containerTop + containerBottom) / 2;
        
        const distance = Math.abs(containerCenter - viewportCenter);
        
        if (distance < minDistance) {
            minDistance = distance;
            centerIndex = index;
        }
    });
    
    return centerIndex;
}

// =======================================
// معالجة نهاية التمرير (تحميل الصفحة المركزية فقط)
// =======================================
function handleScrollEnd() {
    if (fastScrollCount > 10) {
        console.log('تمرير سريع detected, تحميل الصفحة المركزية فقط');
    }
    
    // تحميل الصفحة المركزية
    loadCurrentPage();
    
    // إعادة تعيين المتغيرات
    isScrolling = false;
    fastScrollCount = 0;
    scrollStopDetected = false;
    
    // تحديث العنصر النشط
    updateSidebarActive(getCenterPageIndex());
}

// =======================================
// الحصول على رقم الصفحة الحالية
// =======================================
function getCurrentPageIndex() {
    let viewMiddle = pageView.scrollTop + pageView.clientHeight / 2;
    let closestIndex = 0;
    let minDist = Infinity;

    pageContainers.forEach((container, i) => {
        const containerMiddle = container.offsetTop + container.offsetHeight / 2;
        const dist = Math.abs(containerMiddle - viewMiddle);

        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
        }
    });

    return closestIndex;
}

// =======================================
// التمرير إلى صفحة (معدلة للتحميل المباشر)
// =======================================
function scrollToPage(index) {

    const container = pageContainers[index];
    if (!container) return;

    // إلغاء أي مؤقتات تمرير
    clearTimeout(scrollTimeout);
    clearTimeout(touchEndTimeout);

    // منع نظام التمرير من العمل أثناء الانتقال
    isScrolling = true;
    isTouching = false;

    // ❌ لا نقوم بتحميل الصورة هنا إطلاقاً
    // سيتم تحميلها تلقائياً عند توقف التمرير

    container.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });

    updateSidebarActive(index);

    // بعد انتهاء التمرير نسمح للنظام بتحميل الصفحة
    setTimeout(() => {
        isScrolling = false;
        handleScrollEnd(); // هذا سيحمّل الصفحة المركزية فقط
    }, 10);
}

// =======================================
// تحديث العنصر النشط (معدل)
// =======================================
function updateSidebarActive(index) {
    Array.from(sidebar.children).forEach((el, i) => {
        if (i === index) {
            el.classList.add('active');
            // تمرير الشريط الجانبي بسلاسة
            el.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        } else {
            el.classList.remove('active');
        }
    });
}

// =======================================
// تحويل الصورة إلى DataURL
// =======================================
async function imageToProcessedDataURL(imgSrc, preserveTransparency = true) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imgSrc;
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d', { alpha: preserveTransparency });
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (!preserveTransparency) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            if (preserveTransparency) {
                resolve(canvas.toDataURL('image/png'));
            } else {
                resolve(canvas.toDataURL('image/jpeg', 1.0));
            }
        };
        
        img.onerror = reject;
    });
}

// =======================================
// إنشاء PDF (معدل للسرعة مع تقليل التأخير)
// =======================================
async function generatePDFBlob(progressCallback) {
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'in',
        format: [6, 9],
        compress: true
    });

    const pageWidth = 6;
    const pageHeight = 9;
    const marginTop = 0.5;
    const marginBottom = 0.75;
    const marginOuter = 0.5;
    const marginInner = 0.75;

    // حساب حجم الدفعات (batch size) للصور الكبيرة
    const batchSize = images.length > 50 ? 5 : (images.length > 30 ? 3 : 1);
    
    for (let i = 0; i < images.length; i++) {
        if (stopPDFGeneration) {
            throw new Error('PDF generation stopped by user');
        }
        
        // تحديث التقدم بشكل أقل تكراراً للصور الكثيرة
        if (progressCallback) {
            const progress = Math.floor(((i + 1) / images.length) * 100);
            
            // للصور الكثيرة، نحدث التقدم كل بضع صور
            if (images.length > 50) {
                if (i % 5 === 0 || i === images.length - 1) {
                    progressCallback(progress);
                }
            } else if (images.length > 30) {
                if (i % 3 === 0 || i === images.length - 1) {
                    progressCallback(progress);
                }
            } else {
                progressCallback(progress);
            }
            
            // تقليل التأخير بشكل كبير
            await delay(10);
        }

        try {
            const imgSrc = images[i];
            
            if (stopPDFGeneration) {
                throw new Error('PDF generation stopped by user');
            }
            
            const isPNG = imgSrc.startsWith('data:image/png');
            
            // معالجة الصور بشكل أسرع
            let processedSrc;
            if (i % batchSize === 0) {
                // معالجة دفعة من الصور
                processedSrc = await imageToProcessedDataURL(imgSrc, isPNG);
            } else {
                // استخدام معالجة أسرع للصور المتتالية
                processedSrc = await imageToProcessedDataURL(imgSrc, isPNG);
            }
            
            const isEven = (i + 1) % 2 === 0;
            const marginLeft = isEven ? marginOuter : marginInner;
            const marginRight = isEven ? marginInner : marginOuter;

            const contentWidth = pageWidth - marginLeft - marginRight;
            const contentHeight = pageHeight - marginTop - marginBottom;

            const img = new Image();
            img.src = processedSrc;

            await new Promise((res, rej) => {
                img.onload = res;
                img.onerror = rej;
            });

            const ratio = Math.min(
                contentWidth / (img.width / 300),
                contentHeight / (img.height / 300)
            );

            const w = (img.width / 300) * ratio;
            const h = (img.height / 300) * ratio;
            const x = marginLeft + (contentWidth - w) / 2;
            const y = marginTop + (contentHeight - h) / 2;

            pdf.addImage(processedSrc, 'JPEG', x, y, w, h, undefined, 'FAST');

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);
            pdf.setTextColor(128, 128, 128);
            pdf.text(
                String(i + 1),
                pageWidth / 2,
                pageHeight - 0.4,
                { align: "center" }
            );

            if (i < images.length - 1) {
                pdf.addPage();
            }
            
        } catch (error) {
            if (error.message === 'PDF generation stopped by user') {
                throw error;
            }
            console.error(`Error processing image ${i + 1}:`, error);
            
            try {
                const img = new Image();
                img.src = images[i];
                await new Promise((res, rej) => {
                    img.onload = res;
                    img.onerror = rej;
                });
                
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                
                const fallbackSrc = canvas.toDataURL('image/jpeg', 0.95);
                
                const isEven = (i + 1) % 2 === 0;
                const marginLeft = isEven ? marginOuter : marginInner;
                const marginRight = isEven ? marginInner : marginOuter;
                const contentWidth = pageWidth - marginLeft - marginRight;
                const contentHeight = pageHeight - marginTop - marginBottom;
                
                const ratio = Math.min(
                    contentWidth / (img.width / 300),
                    contentHeight / (img.height / 300)
                );
                
                const w = (img.width / 300) * ratio;
                const h = (img.height / 300) * ratio;
                const x = marginLeft + (contentWidth - w) / 2;
                const y = marginTop + (contentHeight - h) / 2;
                
                pdf.addImage(fallbackSrc, 'JPEG', x, y, w, h, undefined, 'FAST');
                
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(10);
                pdf.setTextColor(128, 128, 128);
                pdf.text(String(i + 1), pageWidth / 2, pageHeight - 0.4, { align: "center" });
                
                if (i < images.length - 1) pdf.addPage();
                
            } catch (fallbackError) {
                if (fallbackError.message === 'PDF generation stopped by user') {
                    throw fallbackError;
                }
                console.error(`Fallback also failed for image ${i + 1}:`, fallbackError);
                throw new Error(`Failed to process image ${i + 1}`);
            }
        }
    }

    return pdf.output('blob');
}

// =======================================
// إنشاء PDF مسبقاً
// =======================================
async function preGeneratePDF() {
    if (images.length === 0 || isPreGeneratingPDF) return;
    
    isPreGeneratingPDF = true;
    console.log('بدء إنشاء PDF مسبقاً...');
    
    // إظهار Shimmer على زر المشاركة والتنزيل فقط
    showShimmer(document.getElementById('share-button'));
    showShimmer(document.getElementById('download-button'));
    
    try {
        const oldStopGeneration = stopPDFGeneration;
        stopPDFGeneration = false;
        
        cachedPDFBlob = await generatePDFBlob((progress) => {
            console.log(`تقدم إنشاء PDF المسبق: ${progress}%`);
        });
        
        stopPDFGeneration = oldStopGeneration;
        
        console.log('تم إنشاء PDF مسبقاً بنجاح');
        
    } catch (error) {
        console.error('فشل إنشاء PDF المسبق:', error);
        cachedPDFBlob = null;
    } finally {
        isPreGeneratingPDF = false;
        checkPDFReady();
    }
}

// =======================================
// تنزيل PDF (معدل - يحافظ على حالة الأزرار)
// =======================================
async function downloadPDF() {
    // التحقق من أن الزر مفعل
    if (!isDownloadButtonReady) {
        alert('الرجاء الانتظار حتى اكتمال تجهيز الملف');
        return;
    }
    
    const downloadBtn = document.getElementById('download-button');
    const shareBtn = document.getElementById('share-button');
    const stopBtn = document.getElementById('stop-bar');
    
    // تعطيل زر التنزيل فقط مؤقتاً
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = '0.5';
    
    // نترك زر المشاركة مفعلاً
    shareBtn.disabled = false;
    shareBtn.style.opacity = '1';
    
    stopBtn.disabled = false;
    stopBtn.style.opacity = '1';
    
    stopPDFGeneration = false;
    isGeneratingPDF = true;

    const fileName = prompt("أدخل اسم الملف قبل التنزيل:", "Amazon-KDP-Book");

    if (!fileName) {
        // إعادة تفعيل زر التنزيل فقط إذا ألغى المستخدم
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
        isGeneratingPDF = false;
        return;
    }

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    try {
        let blob;
        
        if (cachedPDFBlob) {
            console.log('استخدام PDF المخزن مؤقتاً');
            blob = cachedPDFBlob;
            
            // محاكاة تقدم سريع جداً (5 خطوات فقط)
            const steps = 5;
            for (let i = 1; i <= steps; i++) {
                const progress = Math.floor((i / steps) * 100);
                progressBar.style.width = progress + '%';
                progressText.textContent = progress + '%';
                await delay(20);
            }
        } else {
            // إنشاء PDF مع تقدم أسرع
            blob = await generatePDFBlob((progress) => {
                // تضخيم النسبة لتظهر أسرع للمستخدم
                let amplifiedProgress = progress;
                
                // إذا كان عدد الصور كبيراً، نضخم النسبة أكثر
                if (images.length > 30) {
                    amplifiedProgress = Math.min(95, Math.floor(progress * 1.5));
                } else if (images.length > 20) {
                    amplifiedProgress = Math.min(95, Math.floor(progress * 1.3));
                } else if (images.length > 10) {
                    amplifiedProgress = Math.min(95, Math.floor(progress * 1.2));
                }
                
                progressBar.style.width = amplifiedProgress + '%';
                progressText.textContent = amplifiedProgress + '%';
            });
        }

        // قفزة سريعة إلى 100%
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        await delay(100);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.pdf') ? fileName : fileName + '.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // لا نقوم بإنشاء PDF جديد تلقائياً - نترك المستخدم يقرر
        // setTimeout(preGeneratePDF, 500);

    } catch (e) {
        if (e.message === 'PDF generation stopped by user') {
            progressText.textContent = 'تم الإيقاف';
            await delay(500);
        } else {
            alert('فشل إنشاء PDF: ' + e.message);
            console.error(e);
        }
    } finally {
        progressContainer.style.display = 'none';
        
        // إعادة تفعيل زر التنزيل فقط
        downloadBtn.disabled = false;
        downloadBtn.style.opacity = '1';
        
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
        isGeneratingPDF = false;
        
        // التحقق من حالة الأزرار مع الحفاظ على التفعيل
        if (cachedPDFBlob !== null) {
            setButtonsState(true, true);
        } else {
            checkPDFReady();
        }
    }
}

// =======================================
// مشاركة PDF (معدلة - تحافظ على حالة الأزرار)
// =======================================
async function sharePDF() {
    // التحقق من أن الزر مفعل
    if (!isShareButtonReady) {
        alert('الرجاء الانتظار حتى اكتمال تجهيز الملف للمشاركة');
        return;
    }
    
    if (!navigator.share) {
        alert('المتصفح لا يدعم المشاركة');
        return;
    }

    const shareBtn = document.getElementById('share-button');
    const downloadBtn = document.getElementById('download-button');
    const stopBtn = document.getElementById('stop-bar');
    
    // تعطيل زر المشاركة فقط مؤقتاً لمنع النقر المتكرر
    shareBtn.disabled = true;
    shareBtn.style.opacity = '0.5';
    
    // نترك زر التنزيل مفعلاً
    downloadBtn.disabled = false;
    downloadBtn.style.opacity = '1';
    
    stopBtn.disabled = false;
    stopBtn.style.opacity = '1';
    
    stopPDFGeneration = false;
    isGeneratingPDF = true;

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    try {
        // يجب أن يكون PDF مخزناً مسبقاً
        if (!cachedPDFBlob) {
            alert('PDF غير جاهز للمشاركة بعد. الرجاء الانتظار.');
            return;
        }
        
        // محاكاة تقدم سريع جداً (3 خطوات فقط)
        const steps = 3;
        for (let i = 1; i <= steps; i++) {
            const progress = Math.floor((i / steps) * 100);
            progressBar.style.width = progress + '%';
            progressText.textContent = progress + '%';
            await delay(15);
        }

        progressBar.style.width = '100%';
        progressText.textContent = 'اكتمل الإنشاء';
        await delay(50);

        // إنشاء كائن File
        const file = new File([cachedPDFBlob], "Amazon-KDP-Book.pdf", {
            type: "application/pdf"
        });

        // التحقق من دعم مشاركة الملفات
        if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
            alert("مشاركة الملفات غير مدعومة في هذا المتصفح");
            
            if (confirm("هل تريد تنزيل الملف بدلاً من ذلك؟")) {
                const url = URL.createObjectURL(cachedPDFBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "Amazon-KDP-Book.pdf";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            return;
        }

        // مشاركة الملف
        progressText.textContent = 'فتح قائمة المشاركة...';
        await delay(50);
        
        await navigator.share({
            title: "Amazon-KDP-Book",
            text: "كتاب PDF جاهز للنشر على Amazon KDP",
            files: [file]
        });

        progressText.textContent = 'تمت المشاركة بنجاح';
        await delay(500);

        // لا نقوم بإنشاء PDF جديد تلقائياً - نترك المستخدم يقرر
        // setTimeout(preGeneratePDF, 500);

    } catch (err) {
        if (err.message === 'PDF generation stopped by user') {
            progressText.textContent = 'تم الإيقاف';
            await delay(500);
        } else if (err.name !== "AbortError") {
            console.error('Share error:', err);
            
            if (err.message.includes('user gesture')) {
                alert('خطأ في المشاركة: يرجى المحاولة مرة أخرى بعد ثانية');
            } else {
                alert('فشل المشاركة: ' + err.message);
            }
        }
    } finally {
        progressContainer.style.display = 'none';
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';
        isGeneratingPDF = false;
        
        // إعادة تفعيل زر المشاركة فقط (مع الحفاظ على حالة زر التنزيل)
        shareBtn.disabled = false;
        shareBtn.style.opacity = '1';
        
        // التحقق من حالة الأزرار مع الحفاظ على التفعيل
        if (cachedPDFBlob !== null) {
            setButtonsState(true, true);
        } else {
            checkPDFReady();
        }
    }
}

// =======================================
// تشغيل التطبيق (معدل مع إضافة مستمعات اللمس المحسنة)
// =======================================
(async () => {
    try {
        // تعطيل الأزرار في البداية مع عدم الحفظ المسبق
        setButtonsState(false, false, false);
        
        // إظهار Shimmer على الأزرار فقط
        showShimmer(document.getElementById('share-button'));
        showShimmer(document.getElementById('download-button'));
        
        // تحميل الصور من IndexedDB
        await loadImagesFromDB();
        
        if (images.length === 0) {
            pageView.innerHTML = '<div class="no-images">لا توجد صور. الرجاء العودة للصفحة <a href="index.html">الرئيسية</a> ورفع صور.</div>';
            hideShimmer();
            return;
        }
        
        await displaySidebar();
        await displayPages();
        scrollToPage(0);

        // إضافة مستمعات التمرير واللمس المحسنة
        pageView.addEventListener('scroll', handleScroll);
        pageView.addEventListener('touchstart', handleTouchStart);
        pageView.addEventListener('touchmove', handleTouchMove);
        pageView.addEventListener('touchend', handleTouchEnd);
        
        // مستمعات إضافية للموس
        pageView.addEventListener('mousedown', () => {
            isTouching = true;
            isScrolling = true;
            scrollStopDetected = false;
        });
        
        pageView.addEventListener('mousemove', () => {
            if (isTouching) {
                // إعادة تعيين مؤقت التوقف أثناء حركة الماوس
                clearTimeout(scrollTimeout);
                scrollStopDetected = false;
            }
        });
        
        pageView.addEventListener('mouseup', () => {
            isTouching = false;
            // تحميل الصفحة الحالية فور رفع الماوس
            loadCurrentPage();
            setTimeout(() => {
                if (!isScrolling) {
                    handleScrollEnd();
                }
            }, 100);
        });
        
        pageView.addEventListener('mouseleave', () => {
            if (isTouching) {
                isTouching = false;
                loadCurrentPage();
                handleScrollEnd();
            }
        });
        
        // مستمع لعجلة الماوس للكشف عن التمرير السريع
        pageView.addEventListener('wheel', () => {
            clearTimeout(scrollTimeout);
            scrollStopDetected = false;
        });
        
        setTimeout(handleScroll, 100);

        // بدء إنشاء PDF مسبقاً
        setTimeout(preGeneratePDF, 2000);

        document.getElementById('share-button').addEventListener('click', sharePDF);
        document.getElementById('download-button').addEventListener('click', downloadPDF);
        
        const stopBtn = document.getElementById('stop-bar');
        if (stopBtn) {
            stopBtn.addEventListener('click', stopPDF);
            stopBtn.disabled = true;
            stopBtn.style.opacity = '0.5';
        }
        
    } catch (error) {
        console.error('Error initializing viewer:', error);
        pageView.innerHTML = '<div class="error">حدث خطأ في تحميل الصور</div>';
        hideShimmer();
    }
})();
});
