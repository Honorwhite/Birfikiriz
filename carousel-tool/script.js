document.addEventListener('DOMContentLoaded', () => {
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

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = parseInt(btn.dataset.mode);

            // Re-process if image already exists
            if (loadedImage) {
                startProcess();
            }
        });
    });

    let loadedImage = null;

    // Handle Drag & Drop
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
                // Reset results
                resultsGrid.classList.remove('visible');
                resultsHeader.style.display = 'none';

                // Automatically start processing
                startProcess();
            };
            loadedImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function startProcess() {
        if (!loadedImage) return;

        overlay.style.display = 'flex';

        // Brief delay to allow UI to update (loader)
        setTimeout(() => {
            try {
                processImage();
                resultsGrid.classList.add('visible');
                resultsHeader.style.display = 'flex';
                resultsGrid.scrollIntoView({ behavior: 'smooth' });
            } catch (error) {
                console.error('İşleme hatası:', error);
                alert('Görsel işlenirken bir hata oluştu.');
            } finally {
                overlay.style.display = 'none';
            }
        }, 300);
    }

    function processImage() {
        const rows = currentMode / 3;
        const targetW = 3104;
        const targetH = 1350 * rows;

        // Resize temp canvas
        tempCanvas.width = targetW;
        tempCanvas.height = targetH;

        // Step 1: Draw to main canvas with Object-Fit: Cover logic
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

        // Step 2: Clear grid and Extract parts
        resultsGrid.innerHTML = '';

        const colOffsets = [0, 1012, 2024];
        const colNames = ['Sol', 'Orta', 'Sağ'];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < 3; c++) {
                const partIndex = r * 3 + c + 1;
                const rowName = rows > 1 ? `${r + 1}. Satır ` : '';
                const partName = `${rowName}${colNames[c]} Parça (${partIndex})`;
                const startX = colOffsets[c];
                const startY = r * 1350;

                createResultItem(partName, startX, startY, partIndex);
            }
        }
    }

    function createResultItem(name, startX, startY, index) {
        const item = document.createElement('div');
        item.className = 'result-item';

        item.innerHTML = `
            <span class="tag">${name}</span>
            <div class="result-canvas-container">
                <canvas width="1080" height="1350"></canvas>
            </div>
            <a href="#" class="btn btn-download" download="parca-${index}.jpg">
                <i class="fa-solid fa-download"></i> JPG İndir
            </a>
        `;

        const canvas = item.querySelector('canvas');
        const downloadBtn = item.querySelector('.btn-download');
        const ctx = canvas.getContext('2d');

        // Draw from temp canvas
        ctx.drawImage(tempCanvas, startX, startY, 1080, 1350, 0, 0, 1080, 1350);

        // Set download link
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        downloadBtn.href = dataUrl;

        resultsGrid.appendChild(item);
    }

    // ZIP Download Logic
    async function downloadAll() {
        const zip = new JSZip();
        const canvases = resultsGrid.querySelectorAll('canvas');

        downloadAllBtn.disabled = true;
        const originalText = downloadAllBtn.innerHTML;
        downloadAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hazırlanıyor...';

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
            console.error('ZIP hatası:', error);
            alert('ZIP dosyası oluşturulurken bir hata oluştu.');
        } finally {
            downloadAllBtn.disabled = false;
            downloadAllBtn.innerHTML = originalText;
        }
    }

    downloadAllBtn.addEventListener('click', downloadAll);
});
