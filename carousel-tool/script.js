const translations = {
    tr: {
        tagText: "Profesyonel Görsel Aracı",
        mainTitle: "Instagram Carousel Bölme",
        mainDesc: "Görselinizi seçin ve otomatik olarak bölün.",
        mode3: "3'lü Bölme",
        mode6: "6'lı Bölme",
        mode9: "9'lu Bölme",
        dropText: "Bir görsel sürükleyin veya <span>dosya seçin</span>",
        downloadAll: "Tümünü ZIP İndir",
        processing: "Görsel İşleniyor...",
        colNames: ["Sol", "Orta", "Sağ"],
        rowText: "Satır",
        partText: "Parça",
        downloadBtn: "JPG İndir",
        zipPreparing: "Hazırlanıyor...",
        followText: "Geliştiriciyi takip edin:",
        errorProcess: "Görsel işlenirken bir hata oluştu.",
        errorZip: "ZIP dosyası oluşturulurken bir hata oluştu."
    },
    en: {
        tagText: "Professional Image Tool",
        mainTitle: "Instagram Carousel Splitter",
        mainDesc: "Choose your image and split it automatically.",
        mode3: "3x Split",
        mode6: "6x Split",
        mode9: "9x Split",
        dropText: "Drag an image or <span>select file</span>",
        downloadAll: "Download All as ZIP",
        processing: "Processing Image...",
        colNames: ["Left", "Middle", "Right"],
        rowText: "Row",
        partText: "Part",
        downloadBtn: "Download JPG",
        zipPreparing: "Preparing...",
        followText: "Follow the developer:",
        errorProcess: "An error occurred while processing the image.",
        errorZip: "An error occurred while creating the ZIP file."
    }
};

let currentLang = localStorage.getItem('lang') || 'tr';
let currentTheme = localStorage.getItem('theme') || 'dark';

function updateUI() {
    const t = translations[currentLang];
    document.getElementById('tag-text').textContent = t.tagText;
    document.getElementById('main-title').textContent = t.mainTitle;
    document.getElementById('main-desc').textContent = t.mainDesc;
    document.getElementById('mode-3-text').textContent = t.mode3;
    document.getElementById('mode-6-text').textContent = t.mode6;
    document.getElementById('mode-9-text').textContent = t.mode9;
    document.getElementById('drop-text').innerHTML = t.dropText;
    document.getElementById('download-all-btn').innerHTML = `<i class="fa-solid fa-file-zipper"></i> ${t.downloadAll}`;
    document.getElementById('processing-text').textContent = t.processing;
    document.getElementById('btn-lang').textContent = currentLang.toUpperCase();
    document.getElementById('follow-text').textContent = t.followText;
}

function toggleLanguage() {
    currentLang = currentLang === 'tr' ? 'en' : 'tr';
    localStorage.setItem('lang', currentLang);
    updateUI();
    // Re-render if results exist
    if (window.loadedImageForCarousel) {
        window.startProcess();
    }
}

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    const themeIcon = document.querySelector('#btn-theme i');
    themeIcon.className = currentTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

// Initialize theme and UI
document.documentElement.setAttribute('data-theme', currentTheme);
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    const themeIcon = document.querySelector('#btn-theme i');
    themeIcon.className = currentTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';

    const dropZone = document.getElementById('drop-zone');
    const imageInput = document.getElementById('image-input');
    const resultsGrid = document.getElementById('results-grid');
    const resultsHeader = document.getElementById('results-header');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const overlay = document.getElementById('processing-overlay');
    const uploadCard = document.getElementById('upload-card');

    const tempCanvas = document.getElementById('temp-canvas');
    const ctxTemp = tempCanvas.getContext('2d');

    const modeBtns = document.querySelectorAll('.mode-btn');
    let currentMode = 3; // Default
    let loadedImage = null;

    window.loadedImageForCarousel = null;

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = parseInt(btn.dataset.mode);

            if (loadedImage) {
                startProcess();
            }
        });
    });

    dropZone.addEventListener('click', () => imageInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadCard.classList.add('drag-over');
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            uploadCard.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFileUpload(file);
        }
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });

    function handleFileUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            loadedImage = new Image();
            loadedImage.onload = () => {
                window.loadedImageForCarousel = loadedImage;
                resultsGrid.classList.remove('visible');
                resultsHeader.style.display = 'none';
                startProcess();
            };
            loadedImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    window.startProcess = function () {
        if (!loadedImage) return;
        overlay.style.display = 'flex';
        setTimeout(() => {
            try {
                processImage();
                resultsGrid.classList.add('visible');
                resultsHeader.style.display = 'flex';
                resultsGrid.scrollIntoView({ behavior: 'smooth' });
            } catch (error) {
                console.error('Process error:', error);
                alert(translations[currentLang].errorProcess);
            } finally {
                overlay.style.display = 'none';
            }
        }, 300);
    }

    function processImage() {
        const rows = currentMode / 3;
        const targetW = 3104;
        const targetH = 1350 * rows;
        const t = translations[currentLang];

        tempCanvas.width = targetW;
        tempCanvas.height = targetH;

        const sourceW = loadedImage.width;
        const sourceH = loadedImage.height;
        const sourceAspect = sourceW / sourceH;
        const targetAspect = targetW / targetH;

        let drawW, drawH, sx, sy;
        if (sourceAspect > targetAspect) {
            drawH = sourceH;
            drawW = sourceH * targetAspect;
            sx = (sourceW - drawW) / 2;
            sy = 0;
        } else {
            drawW = sourceW;
            drawH = sourceW / targetAspect;
            sx = 0;
            sy = (sourceH - drawH) / 2;
        }

        ctxTemp.clearRect(0, 0, targetW, targetH);
        ctxTemp.drawImage(loadedImage, sx, sy, drawW, drawH, 0, 0, targetW, targetH);

        resultsGrid.innerHTML = '';

        const colOffsets = [0, 1012, 2024];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < 3; c++) {
                const partIndex = r * 3 + c + 1;
                const rowName = rows > 1 ? `${r + 1}. ${t.rowText} ` : '';
                const partName = `${rowName}${t.colNames[c]} ${t.partText} (${partIndex})`;
                const startX = colOffsets[c];
                const startY = r * 1350;

                createResultItem(partName, startX, startY, partIndex);
            }
        }
    }

    function createResultItem(name, startX, startY, index) {
        const t = translations[currentLang];
        const item = document.createElement('div');
        item.className = 'result-item';

        item.innerHTML = `
            <span class="tag">${name}</span>
            <div class="result-canvas-container">
                <canvas width="1080" height="1350" style="width:100%; border-radius:12px;"></canvas>
            </div>
            <a href="#" class="btn btn-download" download="parca-${index}.jpg">
                <i class="fa-solid fa-download"></i> ${t.downloadBtn}
            </a>
        `;

        const canvas = item.querySelector('canvas');
        const downloadBtn = item.querySelector('.btn-download');
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempCanvas, startX, startY, 1080, 1350, 0, 0, 1080, 1350);
        downloadBtn.href = canvas.toDataURL('image/jpeg', 0.92);
        resultsGrid.appendChild(item);
    }

    async function downloadAll() {
        const t = translations[currentLang];
        const zip = new JSZip();
        const canvases = resultsGrid.querySelectorAll('canvas');

        downloadAllBtn.disabled = true;
        const originalText = downloadAllBtn.innerHTML;
        downloadAllBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${t.zipPreparing}`;

        try {
            for (let i = 0; i < canvases.length; i++) {
                const canvas = canvases[i];
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                const base64Data = dataUrl.split(',')[1];
                zip.file(`carousel-parca-${i + 1}.jpg`, base64Data, { base64: true });
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `instagram-carousel-${currentMode}-parca.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('ZIP error:', error);
            alert(t.errorZip);
        } finally {
            downloadAllBtn.disabled = false;
            downloadAllBtn.innerHTML = originalText;
        }
    }

    downloadAllBtn.addEventListener('click', downloadAll);
});
