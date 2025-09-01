// הגדרת כל המאזינים לאירועי הדף

function setupEventListeners() {
    // מפתח API
    setupApiKeyListeners();
    
    // עיבוד אודיו
    setupAudioProcessingListeners();
    
    // תמלול
    setupTranscriptionListeners();
    
    // שיפור טקסט
    setupTextImprovement();
    
    // ייצוא והורדה
    setupExportButtons();
    
    // קבצים
    setupFileHandling();
    
    // פקדי ממשק
    setupUIControls();
    
    // איפוס
    setupResetButton();
}

// מאזינים למפתח API
function setupApiKeyListeners() {
    const apiKeyInput = document.getElementById('apiKey');
    if (!apiKeyInput) return;
    
    apiKeyInput.addEventListener('input', (e) => {
        const key = e.target.value.trim();
        if (key && key.length > 10) {
            storage.saveApiKey(key);
        }
        checkButtonsState();
    });

    apiKeyInput.addEventListener('blur', (e) => {
        const key = e.target.value.trim();
        if (key) {
            storage.saveApiKey(key);
        }
    });
}

// מאזינים לעיבוד אודיו
function setupAudioProcessingListeners() {
    const processButton = document.getElementById('processButton');
    if (!processButton) return;
    
    processButton.addEventListener('click', async () => {
        if (!selectedFile) return;
        
        setButtonState(processButton, 'מעבד...', 'loading');
        
        try {
            if (!audioContext) {
                initAudioContext();
            }
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            processedFile = await processAudio(selectedFile);
            
            const audioPlayer = document.getElementById('audioPlayer');
            if (audioPlayer) {
                audioPlayer.src = URL.createObjectURL(processedFile);
            }
            
            setButtonState(processButton, 'עובד ✓', 'success');
            
            const fileNameElement = document.getElementById('fileName');
            const fileSizeElement = document.getElementById('fileSize');
            if (fileNameElement) fileNameElement.textContent = selectedFile.name + ' (מעובד)';
            if (fileSizeElement) fileSizeElement.textContent = formatFileSize(processedFile.size);
            
            drawWaveform(processedFile);
            checkButtonsState();
            
        } catch (error) {
            console.error('Audio processing error:', error);
            setButtonState(processButton, 'שגיאה בעיבוד', 'error');
            alert('שגיאה בעיבוד האודיו: ' + error.message + '\n\nנסה קובץ אחר או התמלל בלי עיבוד.');
        }
        
        setTimeout(() => {
            processButton.disabled = false;
            if (processButton.textContent !== 'עובד ✓') {
                setButtonState(processButton, 'עבד אודיו', 'default');
            }
        }, 3000);
    });
}

// מאזינים לתמלול
function setupTranscriptionListeners() {
    const transcribeButton = document.getElementById('transcribeButton');
    if (!transcribeButton) return;
    
    transcribeButton.addEventListener('click', async () => {
        const fileToTranscribe = processedFile || selectedFile;
        const apiKeyInput = document.getElementById('apiKey');
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        
        if (!fileToTranscribe || !apiKey) {
            alert('אנא בחר קובץ והזן מפתח API');
            return;
        }

        const progressBar = document.getElementById('progressBar');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const resultArea = document.getElementById('resultArea');
        
        transcribeButton.disabled = true;
        if (progressBar) progressBar.style.display = 'block';
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (resultArea) resultArea.style.display = 'none';
        
        try {
            await performTranscription(fileToTranscribe, apiKey);
        } catch (error) {
            console.error('Transcription error:', error);
            showStatus('שגיאה: ' + error.message, 'error');
        } finally {
            transcribeButton.disabled = false;
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            finalizeProgress();
        }
    });
}

// מאזינים לפקדי ממשק
function setupUIControls() {
    // טוגלים
    setupToggles();
    
    // סליידרים
    setupSliders();
    
    // אתחול AudioContext עם קליק ראשון
    document.body.addEventListener('click', () => {
        if (!audioContext) {
            try {
                initAudioContext();
            } catch (e) {
                console.warn('Could not init audio context', e);
            }
        }
    }, { once: true });
}

// מאזין לכפתור איפוס
function setupResetButton() {
    const resetButton = document.getElementById('resetButton');
    if (!resetButton) return;
    
    resetButton.addEventListener('click', resetApp);
}
