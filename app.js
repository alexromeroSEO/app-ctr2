document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzonePre = document.getElementById('dropzone-pre');
    const dropzonePost = document.getElementById('dropzone-post');
    const fileInputPre = document.getElementById('file-input-pre');
    const fileInputPost = document.getElementById('file-input-post');
    const compareBtn = document.getElementById('compare-btn');
    const dashboard = document.getElementById('dashboard');
    const uploadSection = document.getElementById('upload-section');
    const resetBtn = document.getElementById('reset-btn');
    const resetContainer = document.getElementById('reset-container');

    // Data storage
    let preData = null;
    let postData = null;

    // Chart instances
    let chartPre = null;
    let chartPost = null;
    let chartComparison = null;

    // Load data from localStorage on init
    loadFromLocalStorage();

    // Setup dropzone for Pre period
    setupDropzone(dropzonePre, fileInputPre, 'pre');

    // Setup dropzone for Post period
    setupDropzone(dropzonePost, fileInputPost, 'post');

    // Compare button click
    compareBtn.addEventListener('click', () => {
        if (preData && postData) {
            saveToLocalStorage();
            showComparison();
        }
    });

    // Reset button click
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('¿Estás seguro de que quieres borrar los datos y cargar nuevos archivos?')) {
            resetData();
        }
    });

    function saveToLocalStorage() {
        if (preData && postData) {
            localStorage.setItem('ctr_pre_data', JSON.stringify(preData));
            localStorage.setItem('ctr_post_data', JSON.stringify(postData));
        }
    }

    function loadFromLocalStorage() {
        const savedPre = localStorage.getItem('ctr_pre_data');
        const savedPost = localStorage.getItem('ctr_post_data');

        if (savedPre && savedPost) {
            try {
                preData = JSON.parse(savedPre);
                postData = JSON.parse(savedPost);
                // Usamos un pequeño delay para asegurar que el DOM y Chart.js estén listos
                setTimeout(() => {
                    showComparison();
                    resetContainer.style.display = 'block';
                }, 100);
            } catch (e) {
                console.error('Error loading from localStorage', e);
                localStorage.removeItem('ctr_pre_data');
                localStorage.removeItem('ctr_post_data');
            }
        }
    }

    function resetData() {
        localStorage.removeItem('ctr_pre_data');
        localStorage.removeItem('ctr_post_data');
        preData = null;
        postData = null;

        // Reset UI
        dashboard.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        resetContainer.style.display = 'none';

        // Clear markers
        dropzonePre.classList.remove('loaded');
        dropzonePost.classList.remove('loaded');
        dropzonePre.querySelector('.dropzone-loaded-indicator').classList.add('hidden');
        dropzonePost.querySelector('.dropzone-loaded-indicator').classList.add('hidden');

        // Reset file inputs
        fileInputPre.value = '';
        fileInputPost.value = '';

        checkCompareButton();
    }

    function setupDropzone(dropzone, fileInput, period) {
        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0], period, dropzone);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0], period, dropzone);
            }
        });
    }

    function handleFile(file, period, dropzone) {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            alert('Por favor, sube un archivo CSV.');
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const processedData = processData(results.data);
                if (processedData) {
                    if (period === 'pre') {
                        preData = processedData;
                    } else {
                        postData = processedData;
                    }
                    markDropzoneLoaded(dropzone, file.name);
                    checkCompareButton();
                }
            },
            error: (err) => {
                console.error('Error parsing CSV:', err);
                alert('Error al analizar el archivo CSV.');
            }
        });
    }

    function processData(data) {
        const headers = Object.keys(data[0]);
        const queryKey = headers.find(h => h.toLowerCase() === 'query');
        const posKey = headers.find(h => h.toLowerCase() === 'position');
        const ctrKey = headers.find(h => h.toLowerCase() === 'ctr');
        const clicksKey = headers.find(h => h.toLowerCase() === 'clicks');
        const impKey = headers.find(h => h.toLowerCase() === 'impressions');

        if (!queryKey || !posKey || !ctrKey || !clicksKey || !impKey) {
            alert('El archivo CSV debe contener las columnas "Query", "Position", "CTR", "Clicks" e "Impressions".');
            return null;
        }

        const cleanedData = data.map(row => {
            let ctrRaw = row[ctrKey] || '0';
            // CTR is only used for reference in individual rows, 
            // but for weighted average we'll calculate it from clicks/impressions
            let ctrVal = parseFloat(ctrRaw.replace('%', '').replace(',', '.'));
            if (isNaN(ctrVal)) ctrVal = 0;

            let posRaw = row[posKey] || '0';
            let posVal = Math.floor(parseFloat(posRaw.replace(',', '.')));

            let clicksVal = 0;
            if (clicksKey && row[clicksKey]) {
                let clicksStr = String(row[clicksKey]).replace(/\./g, '').replace(/,/g, '');
                clicksVal = parseInt(clicksStr, 10);
                if (isNaN(clicksVal)) clicksVal = 0;
            }

            let impVal = 0;
            if (impKey && row[impKey]) {
                // Assuming same format as Clicks (dot as thousands separator)
                let impStr = String(row[impKey]).replace(/\./g, '').replace(/,/g, '');
                impVal = parseInt(impStr, 10);
                if (isNaN(impVal)) impVal = 0;
            }

            return {
                query: row[queryKey],
                position: posVal,
                ctr: ctrVal,
                clicks: clicksVal,
                impressions: impVal
            };
        }).filter(row => row.position > 0 && row.impressions > 10); // Changed filter to Impressions > 10

        // Group by position and calculate weighted averages
        const grouped = {};
        cleanedData.forEach(row => {
            if (!grouped[row.position]) {
                grouped[row.position] = { sumClicks: 0, sumImpressions: 0, count: 0 };
            }
            grouped[row.position].sumClicks += row.clicks;
            grouped[row.position].sumImpressions += row.impressions;
            grouped[row.position].count += 1;
        });

        // Create chart data for positions 1-10
        const chartData = [];
        for (let pos = 1; pos <= 10; pos++) {
            let weightedCtr = 0;
            if (grouped[pos] && grouped[pos].sumImpressions > 0) {
                weightedCtr = (grouped[pos].sumClicks / grouped[pos].sumImpressions) * 100;
            }

            chartData.push({
                position: pos,
                avgCtr: weightedCtr
            });
        }

        // Calculate total rows and keywords >= 10 clicks (replicating Python logic)
        let totalKeywords = 0;
        let keywordsGte10 = 0;

        data.forEach(row => {
            totalKeywords++;
            if (clicksKey && row[clicksKey]) {
                let clicksStr = String(row[clicksKey]).replace(/\./g, '').replace(/,/g, '');
                let clicksVal = parseInt(clicksStr, 10);
                if (!isNaN(clicksVal) && clicksVal >= 10) {
                    keywordsGte10++;
                }
            }
        });

        return {
            chartData,
            totalQueries: cleanedData.length,
            totalKeywords: totalKeywords,
            keywordsGte10: keywordsGte10
        };
    }

    function markDropzoneLoaded(dropzone, filename) {
        dropzone.classList.add('loaded');
        const indicator = dropzone.querySelector('.dropzone-loaded-indicator');
        const filenameSpan = indicator.querySelector('.loaded-filename');

        // Truncate filename if too long
        const displayName = filename.length > 25 ? filename.substring(0, 22) + '...' : filename;
        filenameSpan.textContent = displayName;
        indicator.classList.remove('hidden');
    }

    function checkCompareButton() {
        compareBtn.disabled = !(preData && postData);
    }

    function showComparison() {
        uploadSection.classList.add('hidden');
        dashboard.classList.remove('hidden');
        resetContainer.style.display = 'block';

        renderPreChart();
        renderPostChart();
        renderChangeCards();
        renderComparisonChart();
        updateSummaryMetrics();
    }

    function updateSummaryMetrics() {
        document.getElementById('val-total-pre').textContent = preData.totalKeywords.toLocaleString();
        document.getElementById('val-gte10-pre').textContent = preData.keywordsGte10.toLocaleString();

        document.getElementById('val-total-post').textContent = postData.totalKeywords.toLocaleString();
        document.getElementById('val-gte10-post').textContent = postData.keywordsGte10.toLocaleString();
    }

    function renderPreChart() {
        const ctx = document.getElementById('chart-pre').getContext('2d');

        if (chartPre) {
            chartPre.destroy();
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.1)');

        chartPre = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: preData.chartData.map(d => `Pos ${d.position}`),
                datasets: [{
                    label: 'CTR Pre (%)',
                    data: preData.chartData.map(d => d.avgCtr),
                    backgroundColor: gradient,
                    borderColor: '#6366f1',
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.7,
                }]
            },
            options: getChartOptions('Pre AI Overviews')
        });
    }

    function renderPostChart() {
        const ctx = document.getElementById('chart-post').getContext('2d');

        if (chartPost) {
            chartPost.destroy();
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.1)');

        chartPost = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: postData.chartData.map(d => `Pos ${d.position}`),
                datasets: [{
                    label: 'CTR Post (%)',
                    data: postData.chartData.map(d => d.avgCtr),
                    backgroundColor: gradient,
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.7,
                }]
            },
            options: getChartOptions('Post AI Overviews')
        });
    }

    function getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111827',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `CTR: ${context.parsed.y.toFixed(2)}%`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        callback: (value) => value + '%',
                        font: { size: 11 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                }
            }
        };
    }

    function renderChangeCards() {
        const container = document.getElementById('change-cards');
        container.innerHTML = '';

        for (let i = 0; i < 10; i++) {
            const preCtr = preData.chartData[i].avgCtr;
            const postCtr = postData.chartData[i].avgCtr;
            const delta = postCtr - preCtr;
            const percentChange = preCtr !== 0 ? ((delta / preCtr) * 100) : 0;
            const isPositive = delta >= 0;

            const card = document.createElement('div');
            card.className = `change-card ${isPositive ? 'positive' : 'negative'}`;

            card.innerHTML = `
                <div class="change-card-position">Posición ${i + 1}</div>
                <div class="change-card-values">
                    <span class="ctr-pre">${preCtr.toFixed(2)}%</span>
                    <span class="arrow">→</span>
                    <span class="ctr-post">${postCtr.toFixed(2)}%</span>
                </div>
                <div class="change-card-delta">
                    ${isPositive ? '+' : ''}${delta.toFixed(2)}%
                    <span class="change-indicator">${isPositive ? '↑' : '↓'}</span>
                </div>
            `;

            container.appendChild(card);
        }
    }

    function renderComparisonChart() {
        const ctx = document.getElementById('chart-comparison').getContext('2d');

        if (chartComparison) {
            chartComparison.destroy();
        }

        chartComparison = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: preData.chartData.map(d => `Posición ${d.position}`),
                datasets: [
                    {
                        label: 'Pre AI Overviews',
                        data: preData.chartData.map(d => d.avgCtr),
                        backgroundColor: 'rgba(99, 102, 241, 0.8)',
                        borderColor: '#6366f1',
                        borderWidth: 2,
                        borderRadius: 6,
                    },
                    {
                        label: 'Post AI Overviews',
                        data: postData.chartData.map(d => d.avgCtr),
                        backgroundColor: 'rgba(245, 158, 11, 0.8)',
                        borderColor: '#f59e0b',
                        borderWidth: 2,
                        borderRadius: 6,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 13, weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#111827',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            callback: (value) => value + '%',
                            font: { size: 12 }
                        },
                        title: {
                            display: true,
                            text: 'Click-Through Rate (%)',
                            font: { size: 13, weight: '600' }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } },
                        title: {
                            display: true,
                            text: 'Posición en SERP',
                            font: { size: 13, weight: '600' }
                        }
                    }
                }
            }
        });
    }
});
