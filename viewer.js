document.addEventListener("DOMContentLoaded", () => {
const sidebar = document.getElementById('sidebar');
const pageView = document.getElementById('page-view');

let images = JSON.parse(localStorage.getItem('pdfImages') || '[]');
let pageContainers = [];

// دالة تأخير
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

        const inner = document.createElement('div');
        inner.classList.add('sidebar-item-inner', 'Wave-cloud');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 300;
        canvas.height = 300;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        const image = new Image();
        image.src = src;
        image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let scale = Math.min(canvas.width / image.width, canvas.height / image.height);
            let w = image.width * scale;
            let h = image.height * scale;
            ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
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
// عرض الصفحات
// =======================================
async function displayPages() {
    pageView.innerHTML = '';
    pageContainers = [];

    for (let index = 0; index < images.length; index++) {
        const src = images[index];

        const container = document.createElement('div');
        container.classList.add('page-container');

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scaleFactor = 3;
        canvas.width = 794 * scaleFactor;
        canvas.height = 1123 * scaleFactor;
        canvas.style.width = '794px';
        canvas.style.height = '1123px';

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        const image = new Image();
        image.src = src;
        image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let scale = Math.min(canvas.width / image.width, canvas.height / image.height);
            let w = image.width * scale;
            let h = image.height * scale;
            ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        };

        container.appendChild(canvas);
        pageView.appendChild(container);
        pageContainers.push(container);

        await delay(1);
    }
}

// =======================================
// التمرير إلى صفحة
// =======================================
function scrollToPage(index) {
    pageContainers[index].scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
    updateSidebarActive(index);
}

// =======================================
// تحديث العنصر النشط + تمرير القائمة الجانبية
// =======================================
function updateSidebarActive(index) {
    Array.from(sidebar.children).forEach((el, i) => {
        if (i === index) {
            el.classList.add('active');

            // تمرير القائمة الجانبية تلقائياً للعنصر
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
// تتبع الصفحة الحالية بدقة
// =======================================
pageView.addEventListener('scroll', () => {
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

    updateSidebarActive(closestIndex);
});

// =======================================
// نوع الصورة
// =======================================
function getImageTypeFromBase64(str) {
    if (str.startsWith('data:image/jpeg')) return 'JPEG';
    if (str.startsWith('data:image/png')) return 'PNG';
    return 'JPEG';
}

// =======================================
// إنشاء PDF مع دعم الشفافية
// =======================================
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

    for (let i = 0; i < images.length; i++) {

    let src = images[i]; // <-- هنا نغير const إلى let

    let imgType = getImageTypeFromBase64(src);
    if (imgType !== 'PNG') {
        // تحويل JPEG إلى PNG للحفاظ على الشفافية
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        const tempImg = new Image();
        tempImg.src = src;
        await new Promise((res, rej) => {
            tempImg.onload = res;
            tempImg.onerror = rej;
        });

        tempCanvas.width = tempImg.width;
        tempCanvas.height = tempImg.height;
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(tempImg, 0, 0);

        src = tempCanvas.toDataURL('image/png'); // الآن PNG
        imgType = 'PNG';
    }

        const isEven = (i + 1) % 2 === 0;
        const marginLeft = isEven ? marginOuter : marginInner;
        const marginRight = isEven ? marginInner : marginOuter;

        const contentWidth = pageWidth - marginLeft - marginRight;
        const contentHeight = pageHeight - marginTop - marginBottom;

        const img = new Image();
        img.src = src;

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

        pdf.addImage(src, imgType, x, y, w, h, undefined, 'FAST');

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(
            String(i + 1),
            pageWidth / 2,
            pageHeight - 0.4,
            { align: "center" }
        );

        if (i < images.length - 1) {
            pdf.addPage();
        }
    }

    return pdf.output('blob');
}

// =======================================
// تنزيل مع تسمية مسبقة
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

        const blob = await generatePDFBlob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.pdf') ? fileName : fileName + '.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

    } catch (e) {
        alert('فشل إنشاء PDF');
        console.error(e);
    } finally {
        btn.disabled = false;
    }
}

// =======================================
// مشاركة
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
// تشغيل
// =======================================
(async () => {
    await displaySidebar();
    await displayPages();
    scrollToPage(0);

    document.getElementById('share-button').addEventListener('click', sharePDF);
    document.getElementById('download-button').addEventListener('click', downloadPDF);
})();
});
