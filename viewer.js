document.addEventListener("DOMContentLoaded", () => {
const sidebar = document.getElementById('sidebar');
const pageView = document.getElementById('page-view');

let images = JSON.parse(localStorage.getItem('pdfImages') || '[]');
let pageContainers = [];
let isLoading = false;
let loadedCount = 0;
const BATCH_SIZE = 10; // تحميل 10 صور في كل دفعة

// =======================================
// تحميل الصور على دفعات
// =======================================
async function loadImageBatch(startIndex) {
    if (isLoading || startIndex >= images.length) return;
    
    isLoading = true;
    const endIndex = Math.min(startIndex + BATCH_SIZE, images.length);
    
    // إنشاء عناصر وهمية أولاً للحفاظ على التخطيط
    for (let i = startIndex; i < endIndex; i++) {
        if (!pageContainers[i]) {
            createPlaceholder(i);
        }
    }
    
    // تحميل الصور الفعلية
    const loadPromises = [];
    for (let i = startIndex; i < endIndex; i++) {
        loadPromises.push(loadPageImage(i));
    }
    
    await Promise.all(loadPromises);
    loadedCount = endIndex;
    isLoading = false;
    
    // تحميل الدفعة التالية إذا كان المستخدم قريباً من النهاية
    checkAndLoadMore();
}

// =======================================
// إنشاء عنصر وهمي (Placeholder)
// =======================================
function createPlaceholder(index) {
    const src = images[index];
    
    // عنصر القائمة الجانبية
    const item = document.createElement('div');
    item.classList.add('sidebar-item');
    if (index === 0) item.classList.add('active');
    
    const inner = document.createElement('div');
    inner.classList.add('sidebar-item-inner', 'Wave-cloud');
    
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    canvas.dataset.index = index;
    canvas.dataset.src = src;
    
    // رسم placeholder
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#999';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`صفحة ${index + 1}`, 150, 150);
    
    inner.appendChild(canvas);
    
    const pageNum = document.createElement('div');
    pageNum.classList.add('page-number');
    pageNum.textContent = `${index + 1}`;
    
    item.appendChild(inner);
    item.appendChild(pageNum);
    
    item.addEventListener('click', () => scrollToPage(index));
    
    sidebar.appendChild(item);
    
    // عنصر الصفحة الرئيسية
    const container = document.createElement('div');
    container.classList.add('page-container');
    container.dataset.index = index;
    
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = 794 * 3;
    pageCanvas.height = 1123 * 3;
    pageCanvas.style.width = '794px';
    pageCanvas.style.height = '1123px';
    pageCanvas.dataset.src = src;
    
    // رسم placeholder للصفحة
    const pageCtx = pageCanvas.getContext('2d');
    pageCtx.fillStyle = '#f0f0f0';
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageCtx.fillStyle = '#999';
    pageCtx.font = 'bold 40px Arial';
    pageCtx.textAlign = 'center';
    pageCtx.textBaseline = 'middle';
    pageCtx.fillText(`جاري تحميل الصفحة ${index + 1}...`, pageCanvas.width/2, pageCanvas.height/2);
    
    container.appendChild(pageCanvas);
    pageView.appendChild(container);
    pageContainers[index] = container;
}

// =======================================
// تحميل صورة صفحة واحدة
// =======================================
function loadPageImage(index) {
    return new Promise((resolve) => {
        const container = pageContainers[index];
        if (!container) {
            resolve();
            return;
        }
        
        const oldCanvas = container.querySelector('canvas');
        const src = oldCanvas.dataset.src;
        
        const newCanvas = document.createElement('canvas');
        newCanvas.width = oldCanvas.width;
        newCanvas.height = oldCanvas.height;
        newCanvas.style.width = oldCanvas.style.width;
        newCanvas.style.height = oldCanvas.style.height;
        
        const ctx = newCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        
        const img = new Image();
        
        // استخدام setTimeout لمنع تجمد الواجهة
        setTimeout(() => {
            img.src = src;
        }, 0);
        
        img.onload = () => {
            ctx.clearRect(0, 0, newCanvas.width, newCanvas.height);
            const scale = Math.min(newCanvas.width / img.width, newCanvas.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, (newCanvas.width - w) / 2, (newCanvas.height - h) / 2, w, h);
            
            // استبدال canvas في القائمة الجانبية
            const sidebarCanvas = sidebar.children[index]?.querySelector('canvas');
            if (sidebarCanvas) {
                const sidebarCtx = sidebarCanvas.getContext('2d');
                sidebarCtx.clearRect(0, 0, 300, 300);
                const sidebarScale = Math.min(300 / img.width, 300 / img.height);
                const sidebarW = img.width * sidebarScale;
                const sidebarH = img.height * sidebarScale;
                sidebarCtx.drawImage(img, (300 - sidebarW) / 2, (300 - sidebarH) / 2, sidebarW, sidebarH);
            }
            
            // استبدال canvas في الصفحة الرئيسية
            container.replaceChild(newCanvas, oldCanvas);
            resolve();
        };
        
        img.onerror = () => {
            console.error(`فشل تحميل الصورة ${index + 1}`);
            resolve();
        };
    });
}

// =======================================
// التحقق من الحاجة لتحميل المزيد
// =======================================
function checkAndLoadMore() {
    if (loadedCount >= images.length) return;
    
    const scrollPosition = pageView.scrollTop + pageView.clientHeight;
    const totalHeight = pageView.scrollHeight;
    
    // إذا كان المستخدم قريباً من النهاية (آخر 20%)
    if (scrollPosition > totalHeight * 0.8) {
        loadImageBatch(loadedCount);
    }
}

// =======================================
// التمرير إلى صفحة
// =======================================
function scrollToPage(index) {
    if (index >= loadedCount) {
        // تحميل الصفحة المطلوبة إذا لم تكن محملة
        loadImageBatch(index);
    }
    
    // تأخير التمرير قليلاً للسماح بتحميل الصفحة
    setTimeout(() => {
        if (pageContainers[index]) {
            pageContainers[index].scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            updateSidebarActive(index);
        }
    }, 100);
}

// =======================================
// تحديث العنصر النشط
// =======================================
function updateSidebarActive(index) {
    Array.from(sidebar.children).forEach((el, i) => {
        if (i === index) {
            el.classList.add('active');
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
// تتبع الصفحة الحالية
// =======================================
let scrollTimeout;
pageView.addEventListener('scroll', () => {
    // استخدام debounce لمنع التنفيذ المتكرر
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        let viewMiddle = pageView.scrollTop + pageView.clientHeight / 2;
        
        let closestIndex = 0;
        let minDist = Infinity;
        
        pageContainers.forEach((container, i) => {
            if (container) {
                const containerMiddle = container.offsetTop + container.offsetHeight / 2;
                const dist = Math.abs(containerMiddle - viewMiddle);
                
                if (dist < minDist) {
                    minDist = dist;
                    closestIndex = i;
                }
            }
        });
        
        updateSidebarActive(closestIndex);
        checkAndLoadMore();
    }, 100);
});

// =======================================
// عرض الصور المحفوظة
// =======================================
async function displaySavedImages() {
    if (images.length === 0) {
        pageView.innerHTML = '<div style="text-align: center; padding: 50px;">لا توجد صور محفوظة</div>';
        return;
    }
    
    // إنشاء العناصر الوهمية أولاً
    for (let i = 0; i < images.length; i++) {
        createPlaceholder(i);
    }
    
    // بدء تحميل الدفعة الأولى
    await loadImageBatch(0);
}

// =======================================
// دوال PDF (بدون تغيير)
// =======================================
function getImageTypeFromBase64(str) {
    if (str.startsWith('data:image/jpeg')) return 'JPEG';
    if (str.startsWith('data:image/png')) return 'PNG';
    return 'JPEG';
}

async function generatePDFBlob() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'in',
        format: [6, 9]
    });
    
    const pageWidth = 6;
    const pageHeight = 9;
    const marginTop = 0.5;
    const marginBottom = 0.75;
    const marginOuter = 0.5;
    const marginInner = 0.75;
    
    // معالجة الصور بشكل متسلسل لمنع التجميد
    for (let i = 0; i < images.length; i++) {
        // السماح بتحديث الواجهة كل 5 صور
        if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        let src = images[i];
        let imgType = getImageTypeFromBase64(src);
        
        if (imgType !== 'PNG') {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            const tempImg = new Image();
            
            tempImg.src = src;
            await new Promise((res) => {
                tempImg.onload = res;
                tempImg.onerror = res;
            });
            
            tempCanvas.width = tempImg.width;
            tempCanvas.height = tempImg.height;
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(tempImg, 0, 0);
            src = tempCanvas.toDataURL('image/png');
            imgType = 'PNG';
        }
        
        const isEven = (i + 1) % 2 === 0;
        const marginLeft = isEven ? marginOuter : marginInner;
        const marginRight = isEven ? marginInner : marginOuter;
        const contentWidth = pageWidth - marginLeft - marginRight;
        const contentHeight = pageHeight - marginTop - marginBottom;
        
        const img = new Image();
        img.src = src;
        await new Promise((res) => {
            img.onload = res;
            img.onerror = res;
        });
        
        const ratio = Math.min(
            contentWidth / (img.width / 300),
            contentHeight / (img.height / 300)
        );
        
        const w = (img.width / 300) * ratio;
        const h = (img.height / 300) * ratio;
        const x = marginLeft + (contentWidth - w) / 2;
        const y = marginTop + (contentHeight - h) / 2;
        
        pdf.addImage(src, imgType, x, y, w, h, undefined, 'FAST');
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(String(i + 1), pageWidth / 2, pageHeight - 0.4, { align: "center" });
        
        if (i < images.length - 1) {
            pdf.addPage();
        }
    }
    
    return pdf.output('blob');
}

// =======================================
// تنزيل PDF
// =======================================
async function downloadPDF() {
    const btn = document.getElementById('download-button');
    btn.disabled = true;
    
    try {
        const fileName = prompt("أدخل اسم الملف قبل التنزيل:", "Amazon-KDP-Book");
        if (!fileName) {
            btn.disabled = false;
            return;
        }
        
        // إظهار مؤشر التحميل
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.textContent = 'جاري إنشاء PDF... قد يستغرق هذا دقيقة';
        document.body.appendChild(loadingDiv);
        
        const blob = await generatePDFBlob();
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.pdf') ? fileName : fileName + '.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        document.body.removeChild(loadingDiv);
        
    } catch (e) {
        alert('فشل إنشاء PDF');
        console.error(e);
    } finally {
        btn.disabled = false;
    }
}

// =======================================
// مشاركة PDF
// =======================================
async function sharePDF() {
    if (!navigator.share) {
        alert('المتصفح لا يدعم المشاركة');
        return;
    }
    
    const fileName = prompt("أدخل اسم الملف للمشاركة:", "Amazon-KDP-Book") || "Amazon-KDP-Book";
    const blob = await generatePDFBlob();
    const file = new File([blob], fileName + '.pdf', { type: 'application/pdf' });
    
    await navigator.share({
        title: fileName,
        files: [file]
    });
}

// =======================================
// إضافة مؤشر التحميل في CSS
// =======================================
const style = document.createElement('style');
style.textContent = `
    .loading-indicator {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 9999;
        font-size: 18px;
    }
`;
document.head.appendChild(style);

// =======================================
// التشغيل
// =======================================
displaySavedImages();
scrollToPage(0);

document.getElementById('share-button').addEventListener('click', sharePDF);
document.getElementById('download-button').addEventListener('click', downloadPDF);
});
