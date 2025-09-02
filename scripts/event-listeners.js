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
    
    // חדש - קוביות בחירה
    setupServiceCards();
    
    // חדש - חלון הגדרות
    setupSettingsModal();
    
    // חדש - כפתור הסרת קובץ
    setupRemoveFileButton();
}

// מאזינים למפתחות API
function setupApiKeyListeners() {
    const apiKeyInput = document.getElementById('apiKey');
    const transcriptionService = document.getElementById('transcriptionService');
    const openAiGroup = document.getElementById('openAiGroup');
    const ivritAiGroup = document.getElementById('ivritAiGroup');
    const languageGroup = document.getElementById('languageGroup');
    
    // מאזין לשירות תמלול
    if (transcriptionService) {
        transcriptionService.addEventListener('change', () => {
            const isOpenAI = transcriptionService.value === 'openai';
            
            if (openAiGroup) openAiGroup.style.display = isOpenAI ? 'block' : 'none';
            if (ivritAiGroup) ivritAiGroup.style.display = isOpenAI ? 'none' : 'block';
            if (languageGroup) languageGroup.style.display = isOpenAI ? 'block' : 'none';
            
            checkButtonsState();
        });
    }
    
    // מאזין למפתח OpenAI
    if (apiKeyInput) {
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
    
    // מאזינים לשדות ivrit.ai
    const ivritFields = ['runpodApiKey', 'endpointId', 'workerUrl'];
    ivritFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', () => {
                const runpodApiKey = document.getElementById('runpodApiKey').value.trim();
                const endpointId = document.getElementById('endpointId').value.trim();
                const workerUrl = document.getElementById('workerUrl').value.trim();
                
                if (runpodApiKey && endpointId && workerUrl) {
                    storage.saveIvritAiCredentials(runpodApiKey, endpointId, workerUrl);
                }
                checkButtonsState();
            });
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
        
        if (!fileToTranscribe) {
            alert('אנא בחר קובץ');
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
            await selectTranscriptionService(fileToTranscribe, apiKey);
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

// חדש - מאזינים לקוביות בחירת שירות
function setupServiceCards() {
    const serviceCards = document.querySelectorAll('.service-card');
    
    serviceCards.forEach(card => {
        card.addEventListener('click', function() {
            // הסרת בחירה מכל הכרטיסים
            serviceCards.forEach(c => c.classList.remove('selected'));
            
            // הוספת בחירה לכרטיס הנוכחי
            this.classList.add('selected');
            
            // עדכון הערך בselect המוסתר
            const service = this.dataset.service;
            const transcriptionSelect = document.getElementById('transcriptionService');
            if (transcriptionSelect) {
                transcriptionSelect.value = service;
                const event = new Event('change', { bubbles: true });
                transcriptionSelect.dispatchEvent(event);
            }
            
            // עדכון תצוגת ההגדרות במודל
            const openAiSettings = document.getElementById('openAiSettings');
            const ivritAiSettings = document.getElementById('ivritAiSettings');
            
            if (service === 'openai') {
                if (openAiSettings) openAiSettings.style.display = 'block';
                if (ivritAiSettings) ivritAiSettings.style.display = 'none';
            } else {
                if (openAiSettings) openAiSettings.style.display = 'none';
                if (ivritAiSettings) ivritAiSettings.style.display = 'block';
            }
            
            checkButtonsState();
        });
    });
}

// חדש - מאזינים לחלון הגדרות
function setupSettingsModal() {
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettings = document.getElementById('saveSettings');
    
    // פתיחת חלון הגדרות
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            if (settingsModal) {
                settingsModal.classList.add('active');
                
                // הצגת ההגדרות הנכונות בהתאם לשירות הנבחר
                const transcriptionService = document.getElementById('transcriptionService');
                const openAiSettings = document.getElementById('openAiSettings');
                const ivritAiSettings = document.getElementById('ivritAiSettings');
                
                if (transcriptionService) {
                    const isOpenAI = transcriptionService.value === 'openai';
                    if (openAiSettings) openAiSettings.style.display = isOpenAI ? 'block' : 'none';
                    if (ivritAiSettings) ivritAiSettings.style.display = isOpenAI ? 'none' : 'block';
                }
            }
        });
    }
    
    // סגירת חלון הגדרות עם X
    if (closeSettings) {
        closeSettings.addEventListener('click', () => {
            if (settingsModal) settingsModal.classList.remove('active');
        });
    }
    
    // שמירת הגדרות
    if (saveSettings) {
        saveSettings.addEventListener('click', () => {
            // שמירת הגדרות OpenAI
            const apiKey = document.getElementById('apiKey');
            if (apiKey && apiKey.value.trim()) {
                storage.saveApiKey(apiKey.value.trim());
            }
            
            // שמירת הגדרות ivrit.ai
            const runpodApiKey = document.getElementById('runpodApiKey');
            const endpointId = document.getElementById('endpointId');
            const workerUrl = document.getElementById('workerUrl');
            
            if (runpodApiKey && endpointId && workerUrl) {
                const runpod = runpodApiKey.value.trim();
                const endpoint = endpointId.value.trim();
                const worker = workerUrl.value.trim();
                
                if (runpod && endpoint && worker) {
                    storage.saveIvritAiCredentials(runpod, endpoint, worker);
                }
            }
            
            // סגירת החלון
            if (settingsModal) settingsModal.classList.remove('active');
            
            // עדכון מצב כפתורים
            checkButtonsState();
            
            // הצגת הודעת הצלחה
            showStatus('ההגדרות נשמרו בהצלחה ✓', 'success');
            setTimeout(hideStatus, 3000);
        });
    }
    
    // סגירת מודל בלחיצה מחוץ לו
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('active');
            }
        });
    }
    
    // מניעת סגירה בלחיצה על התוכן
    const settingsContent = document.querySelector('.settings-content');
    if (settingsContent) {
        settingsContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// חדש - מאזין לכפתור הסרת קובץ
function setupRemoveFileButton() {
    const removeFileBtn = document.getElementById('removeFileBtn');
    
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // למנוע הפעלת אירועים אחרים
            
            if (confirm('האם להסיר את הקובץ?')) {
                // איפוס הקבצים
                clearFiles();
                
                // הצגת הודעה
                showStatus('הקובץ הוסר', 'success');
                setTimeout(hideStatus, 2000);
            }
        });
    }
}
