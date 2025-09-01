// פונקציות עזר לממשק המשתמש

let progressInterval = null;

// בדיקת מצב כפתורים
function checkButtonsState() {
    const apiKeyInput = document.getElementById('apiKey');
    const transcribeButton = document.getElementById('transcribeButton');
    const processButton = document.getElementById('processButton');
    const transcriptionService = document.getElementById('transcriptionService');
    
    if (!transcribeButton || !processButton) return;
    
    const selectedService = transcriptionService ? transcriptionService.value : 'openai';
    const hasFile = selectedFile || processedFile;
    
    let canTranscribe = hasFile;
    
    if (selectedService === 'openai') {
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        canTranscribe = canTranscribe && apiKey;
    } else if (selectedService === 'ivrit-ai') {
        const runpodApiKey = document.getElementById('runpodApiKey');
        const endpointId = document.getElementById('endpointId');
        const workerUrl = document.getElementById('workerUrl');
        
        canTranscribe = canTranscribe && 
            runpodApiKey && runpodApiKey.value.trim() &&
            endpointId && endpointId.value.trim() &&
            workerUrl && workerUrl.value.trim();
    }
    
    transcribeButton.disabled = !canTranscribe;
    processButton.disabled = !selectedFile;
}

// פורמט גודל קובץ
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// הצגת הודעות סטטוס
function showStatus(message, type = 'processing') {
    const statusElement = document.getElementById('status');
    if (!statusElement) return;
    
    statusElement.className = `status ${type}`;
    statusElement.textContent = message;
    statusElement.style.display = 'block';
}

// הסתרת הודעות סטטוס
function hideStatus() {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}

// שינוי מצב כפתור
function setButtonState(button, text, state = 'default') {
    if (!button) return;
    
    button.disabled = state === 'loading';
    button.textContent = text;
    
    const stateColors = {
        default: '',
        success: 'linear-gradient(135deg, #28a745, #20c997)',
        error: 'linear-gradient(135deg, #dc3545, #c82333)'
    };
    
    button.style.background = stateColors[state] || '';
}

// סימולציה של התקדמות
function simulateProgress(start, end, duration) {
    const progressFill = document.getElementById('progressFill');
    if (!progressFill) return;
    
    if (progressInterval) clearInterval(progressInterval);
    
    let current = start;
    progressFill.style.width = `${start}%`;
    
    const stepTime = 50;
    const steps = duration / stepTime;
    const increment = (end - start) / steps;

    progressInterval = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(progressInterval);
        }
        progressFill.style.width = `${current}%`;
    }, stepTime);
}

// סיום התקדמות
function finalizeProgress() {
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    
    if (progressInterval) clearInterval(progressInterval);
    
    if (progressFill) {
        progressFill.style.width = '100%';
    }
    
    setTimeout(() => {
        if (progressBar) progressBar.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
    }, 500);
}

// פורמט זמן VTT
function formatVttTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 12);
}

// הגדרת מתגים (toggles)
function setupToggles() {
    document.querySelectorAll('.toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            
            // טיפול מיוחד למסנן רעש
            if (toggle.id === 'noiseReductionToggle') {
                const isActive = toggle.classList.contains('active');
                const slider = document.getElementById('noiseReductionLevel');
                const container = document.getElementById('noiseSliderContainer');
                
                if (slider) slider.disabled = !isActive;
                if (container) container.classList.toggle('disabled', !isActive);
            }
            
            // טיפול מיוחד לנרמול קול
            else if (toggle.id === 'normalizeToggle') {
                const isActive = toggle.classList.contains('active');
                const slider = document.getElementById('volumeLevel');
                const container = document.getElementById('volumeSliderContainer');
                
                if (slider) slider.disabled = !isActive;
                if (container) container.classList.toggle('disabled', !isActive);
            }
            
            // עדכון תוצאות אם יש תמלול קיים
            else if (transcriptResult) {
                displayResults();
            }
        });
    });
}

// הגדרת סליידרים
function setupSliders() {
    const noiseSlider = document.getElementById('noiseReductionLevel');
    const noiseValue = document.getElementById('noiseReductionValue');
    
    if (noiseSlider && noiseValue) {
        noiseSlider.addEventListener('input', (e) => {
            noiseValue.textContent = e.target.value + '%';
        });
    }
    
    const volumeSlider = document.getElementById('volumeLevel');
    const volumeValue = document.getElementById('volumeValue');
    
    if (volumeSlider && volumeValue) {
        volumeSlider.addEventListener('input', (e) => {
            volumeValue.textContent = e.target.value + '%';
        });
    }
}
