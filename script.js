// Global state
let selectedFile = null;
let processedFile = null;
let transcriptResult = null;
let improvedResult = '';
let audioContext = null;
let progressInterval = null;

// DOM Elements
const elements = {
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    audioPreview: document.getElementById('audioPreview'),
    audioPlayer: document.getElementById('audioPlayer'),
    processButton: document.getElementById('processButton'),
    waveformCanvas: document.getElementById('waveformCanvas'),
    transcribeButton: document.getElementById('transcribeButton'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    status: document.getElementById('status'),
    resultArea: document.getElementById('resultArea'),
    transcriptText: document.getElementById('transcriptText'),
    improvedText: document.getElementById('improvedText'),
    improveButton: document.getElementById('improveButton'),
    improveModelSelect: document.getElementById('improveModelSelect'),
    downloadTxtButton: document.getElementById('downloadTxtButton'),
    downloadVttButton: document.getElementById('downloadVttButton'),
    copyButton: document.getElementById('copyButton'),
    languageSelect: document.getElementById('languageSelect'),
    resetButton: document.getElementById('resetButton'),
    apiKey: document.getElementById('apiKey'),
    noiseReductionToggle: document.getElementById('noiseReductionToggle'),
    noiseSliderContainer: document.getElementById('noiseSliderContainer'),
    noiseReductionLevel: document.getElementById('noiseReductionLevel'),
    noiseReductionValue: document.getElementById('noiseReductionValue'),
    normalizeToggle: document.getElementById('normalizeToggle'),
    volumeSliderContainer: document.getElementById('volumeSliderContainer'),
    volumeLevel: document.getElementById('volumeLevel'),
    volumeValue: document.getElementById('volumeValue'),
    speakerToggle: document.getElementById('speakerToggle'),
    timestampToggle: document.getElementById('timestampToggle'),
    paragraphToggle: document.getElementById('paragraphToggle'),
};

// --- LOCAL STORAGE ---
const storage = {
    saveApiKey(key) {
        if (key?.trim()) {
            try {
                localStorage.setItem('hebrew_transcription_api_key', key.trim());
            } catch (error) {
                console.warn('Could not save API key:', error);
            }
        }
    },
    loadApiKey() {
        try {
            const saved = localStorage.getItem('hebrew_transcription_api_key');
            if (saved?.trim()) {
                elements.apiKey.value = saved.trim();
                return true;
            }
        } catch (error) {
            console.warn('Could not load API key:', error);
        }
        return false;
    }
};

// --- UI & HELPERS ---
function checkButtonsState() {
    const apiKey = elements.apiKey.value.trim();
    const hasFile = selectedFile || processedFile;
    elements.transcribeButton.disabled = !apiKey || !hasFile;
    elements.processButton.disabled = !selectedFile;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showStatus(message, type = 'processing') {
    elements.status.className = `status ${type}`;
    elements.status.textContent = message;
    elements.status.style.display = 'block';
}

function hideStatus() {
    elements.status.style.display = 'none';
}

function setButtonState(button, text, state = 'default') {
    button.disabled = state === 'loading';
    button.textContent = text;
    
    const stateColors = {
        default: '',
        success: 'linear-gradient(135deg, #28a745, #20c997)',
        error: 'linear-gradient(135deg, #dc3545, #c82333)'
    };
    
    button.style.background = stateColors[state] || '';
}

function simulateProgress(start, end, duration) {
    if (progressInterval) clearInterval(progressInterval);
    
    let current = start;
    elements.progressFill.style.width = `${start}%`;
    
    const stepTime = 50;
    const steps = duration / stepTime;
    const increment = (end - start) / steps;

    progressInterval = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(progressInterval);
        }
        elements.progressFill.style.width = `${current}%`;
    }, stepTime);
}

function finalizeProgress() {
    if (progressInterval) clearInterval(progressInterval);
    elements.progressFill.style.width = `100%`;
    setTimeout(() => {
        elements.progressBar.style.display = 'none';
        elements.progressFill.style.width = `0%`;
    }, 500);
}

function formatVttTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 12);
}

// --- FILE HANDLING ---
function handleFileSelect(file) {
    if (!file) return;
    
    selectedFile = file;
    processedFile = null;
    
    try {
        elements.fileName.textContent = file.name;
        elements.fileSize.textContent = formatFileSize(file.size);
        elements.fileInfo.style.display = 'block';
        elements.audioPreview.style.display = 'block';
        elements.resultArea.style.display = 'none';
        
        setButtonState(elements.processButton, 'עבד אודיו', 'default');
        
        const url = URL.createObjectURL(file);
        elements.audioPlayer.src = url;
        
        drawWaveform(file);
        checkButtonsState();
        
        if (file.size > 25 * 1024 * 1024) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(1);
            alert(`⚠️ הקובץ גדול (${sizeMB}MB) מהמגבלה של OpenAI (25MB).\n\nהמערכת תדחוס אותו אוטומטית בעיבוד האודיו.`);
        }
        
    } catch (error) {
        console.error('Error in handleFileSelect:', error);
        alert('שגיאה בטעינת הקובץ: ' + error.message);
    }
}

// --- AUDIO PROCESSING & WAVEFORM ---
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function drawWaveform(file) {
    const canvas = elements.waveformCanvas;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#667eea';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('טוען צורת גל...', canvas.width / 2, canvas.height / 2);
    
    file.arrayBuffer().then(arrayBuffer => {
        if (audioContext) {
            return audioContext.decodeAudioData(arrayBuffer);
        }
        return Promise.reject('No audio context');
    }).then(audioBuffer => {
        drawAudioWaveform(ctx, canvas, audioBuffer);
    }).catch(error => {
        console.warn('Could not draw waveform:', error);
        drawSimpleWaveform(ctx, canvas);
    });
}

function drawSimpleWaveform(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const centerY = canvas.height / 2;
    for (let x = 0; x < canvas.width; x += 2) {
        const amplitude = Math.sin(x * 0.02) * Math.random() * 20;
        ctx.lineTo(x, centerY + amplitude);
    }
    ctx.stroke();
}

function drawAudioWaveform(ctx, canvas, audioBuffer) {
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
}

async function processAudio(file) {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    let currentNode = source;
    
    if (elements.noiseReductionToggle.classList.contains('active')) {
        const noiseReduction = offlineContext.createBiquadFilter();
        noiseReduction.type = 'highpass';
        noiseReduction.frequency.value = Math.min(200 + (elements.noiseReductionLevel.value * 3), 800);
        noiseReduction.Q.value = 1;
        currentNode.connect(noiseReduction);
        currentNode = noiseReduction;
    }
    
    if (elements.normalizeToggle.classList.contains('active')) {
        const compressor = offlineContext.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        currentNode.connect(compressor);
        currentNode = compressor;
    }
    
    const volumeLevel = elements.volumeLevel.value / 100;
    if (volumeLevel !== 1) {
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = volumeLevel;
        currentNode.connect(gainNode);
        currentNode = gainNode;
    }
    
    currentNode.connect(offlineContext.destination);
    source.start();
    const processedBuffer = await offlineContext.startRendering();
    
    return bufferToWaveFile(processedBuffer);
}

function bufferToWaveFile(audioBuffer, targetBitRate = 128) {
    const [numberOfChannels, sampleRate] = [audioBuffer.numberOfChannels, audioBuffer.sampleRate];
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const length = audioBuffer.length * numberOfChannels * bytesPerSample + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    let pos = 0;

    const writeString = (str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(pos + i, str.charCodeAt(i));
        pos += str.length;
    };
    const writeUint32 = (data) => {
        view.setUint32(pos, data, true);
        pos += 4;
    };
    const writeUint16 = (data) => {
        view.setUint16(pos, data, true);
        pos += 2;
    };

    writeString('RIFF');
    writeUint32(length - 8);
    writeString('WAVE');
    writeString('fmt ');
    writeUint32(16);
    writeUint16(1);
    writeUint16(numberOfChannels);
    writeUint32(sampleRate);
    writeUint32(sampleRate * numberOfChannels * bytesPerSample);
    writeUint16(numberOfChannels * bytesPerSample);
    writeUint16(bitsPerSample);
    writeString('data');
    writeUint32(length - pos - 4);

    const channels = Array.from({ length: numberOfChannels }, (_, i) => audioBuffer.getChannelData(i));
    let offset = 0;
    const maxValue = 32767;

    while (pos < length) {
        for (let i = 0; i < numberOfChannels; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset] || 0));
            view.setInt16(pos, sample * maxValue, true);
            pos += 2;
        }
        offset++;
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

// --- OPENAI API & RESULTS ---
async function performTranscription(file, apiKey) {
    showStatus('מעבד קובץ אודיו...');
    if (file.size > 25 * 1024 * 1024) throw new Error('קובץ גדול מדי. הגודל המקסימלי הוא 25MB');
    
    let fileToSend = file;
    if (file instanceof Blob && !file.name) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const originalName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "processed";
        fileToSend = new File([file], `${originalName}_processed_${timestamp}.wav`, { type: 'audio/wav' });
    }

    const formData = new FormData();
    formData.append('file', fileToSend);
    formData.append('model', 'whisper-1');
    const selectedLanguage = elements.languageSelect.value;
    if (selectedLanguage !== 'auto') formData.append('language', selectedLanguage);
    formData.append('response_format', 'verbose_json');

    showStatus('נשלח לתמלול...');
    simulateProgress(5, 90, 45000);
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
    });

    const result = await response.json();

    if (!response.ok) {
        let errorMessage = result.error?.message || `HTTP ${response.status}`;
        if (errorMessage.includes('rate limit')) errorMessage = 'חרגת ממגבלת הקריאות. המתן מספר דקות ונסה שוב';
        else if (errorMessage.includes('quota') || errorMessage.includes('credit')) errorMessage = 'חרגת ממכסת הקרדיט או אין אשראי בחשבון OpenAI';
        else if (errorMessage.includes('invalid api key') || errorMessage.includes('authentication')) errorMessage = 'מפתח API לא תקין. בדוק את המפתח בפלטפורמת OpenAI';
        else if (errorMessage.includes('audio file is invalid') || errorMessage.includes('unsupported')) errorMessage = 'קובץ האודיו לא נתמך או פגום. נסה להמיר ל-MP3 או WAV';
        throw new Error(errorMessage);
    }
    
    if (!result.text || result.text.trim() === '') {
        throw new Error('לא זוהה טקסט בקובץ האודיו. ייתכן שהקול לא ברור או שהקובץ ריק');
    }

    transcriptResult = result;
    displayResults();
}

async function improveText(text, apiKey) {
    const selectedModel = elements.improveModelSelect.value;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: selectedModel,
            messages: [{
                role: 'system',
                content: 'אתה עורך טקסט מקצועי בעברית. המשימה שלך היא לתקן שגיאות דקדוק, כתיב, פיסוק ולהשלים מילים חסרות בטקסט שקיבלת מתמלול אודיו. שמור על המשמעות המקורית והתוכן, רק תקן שגיאות ותשפר את הקריאות. תקן גם מילים שנשמעו לא נכון או לא מובנות.'
            }, {
                role: 'user',
                content: `אנא תקן ותשפר את הטקסט הבא מתמלול אודיו:\n\n${text}`
            }],
            max_tokens: 4000,
            temperature: 0.2
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    const improvedContent = result.choices[0]?.message?.content?.trim();
    
    if (!improvedContent || improvedContent === text) {
        throw new Error('לא ניתן לשפר את הטקסט או שהוא כבר מושלם');
    }
    
    return improvedContent;
}

function displayResults() {
    if (!transcriptResult || !transcriptResult.segments) return;

    const showTimestamps = elements.timestampToggle.classList.contains('active');
    const showParagraphs = elements.paragraphToggle.classList.contains('active');
    const showSpeakers = elements.speakerToggle.classList.contains('active');
    
    const separator = showParagraphs ? '\n\n' : ' ';
    
    let finalResult = transcriptResult.segments.map(segment => {
        let line = segment.text.trim();
        if (showTimestamps) {
            const time = formatVttTime(segment.start).substring(0, 8);
            line = `[${time}] ${line}`;
        }
        return line;
    }).join(separator);

    if (showSpeakers && !showParagraphs) {
         finalResult = 'משתתף 1: ' + finalResult;
    } else if (showSpeakers && showParagraphs) {
        finalResult = finalResult.replace(/\[/g, 'משתתף 1: [');
    }

    elements.transcriptText.textContent = finalResult;
    elements.resultArea.style.display = 'block';
    elements.improveButton.style.display = 'inline-block';
    elements.improvedText.style.display = 'none';
    
    showStatus('התמלול הושלם בהצלחה! ✅', 'success');
    elements.resultArea.scrollIntoView({ behavior: 'smooth' });
    
    setTimeout(hideStatus, 5000);
}

function generateVTTContent() {
    if (!transcriptResult || !transcriptResult.segments) return '';
    let vttContent = "WEBVTT\n\n";
    transcriptResult.segments.forEach(segment => {
        const start = formatVttTime(segment.start);
        const end = formatVttTime(segment.end);
        vttContent += `${start} --> ${end}\n`;
        vttContent += `${segment.text.trim()}\n\n`;
    });
    return vttContent;
}

// --- APP RESET & INITIALIZATION ---
function resetSettingsToDefault() {
    elements.languageSelect.value = 'he';
    elements.noiseReductionToggle.classList.add('active');
    elements.noiseReductionLevel.value = 30;
    elements.noiseReductionValue.textContent = '30%';
    elements.noiseReductionLevel.disabled = false;
    elements.noiseSliderContainer.classList.remove('disabled');
    elements.normalizeToggle.classList.add('active');
    elements.volumeLevel.value = 100;
    elements.volumeValue.textContent = '100%';
    elements.volumeLevel.disabled = false;
    elements.volumeSliderContainer.classList.remove('disabled');
    elements.timestampToggle.classList.remove('active');
    elements.speakerToggle.classList.remove('active');
    elements.paragraphToggle.classList.remove('active');
    elements.improveModelSelect.value = 'gpt-4o';
}

function resetApp() {
    if (confirm('האם אתה בטוח שברצונך לאפס את האפליקציה?\n\nכל הקבצים, התמלולים וההגדרות יחזרו למצב ברירת המחדל.')) {
        selectedFile = null;
        processedFile = null;
        transcriptResult = null;
        improvedResult = '';
        elements.fileInfo.style.display = 'none';
        elements.audioPreview.style.display = 'none';
        elements.resultArea.style.display = 'none';
        elements.progressBar.style.display = 'none';
        elements.loadingSpinner.style.display = 'none';
        elements.improvedText.style.display = 'none';
        elements.improveButton.style.display = 'none';
        hideStatus();
        elements.audioPlayer.src = '';
        setButtonState(elements.processButton, 'עבד אודיו');
        setButtonState(elements.improveButton, '🔧 תיקון אוטומטי');
        const ctx = elements.waveformCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.waveformCanvas.width, elements.waveformCanvas.height);
        elements.fileInput.value = '';
        elements.transcriptText.textContent = '';
        elements.improvedText.innerHTML = '<div style="font-weight: bold; margin-bottom: 10px; color: #28a745;">✨ טקסט מתוקן:</div>';
        resetSettingsToDefault();
        checkButtonsState();
        console.log('System reset completed');
    }
}

// --- EVENT LISTENERS SETUP ---
function setupEventListeners() {
    elements.apiKey.addEventListener('input', (e) => {
        const key = e.target.value.trim();
        if (key && key.length > 10) storage.saveApiKey(key);
        checkButtonsState();
    });

    elements.apiKey.addEventListener('blur', (e) => {
        const key = e.target.value.trim();
        if (key) storage.saveApiKey(key);
    });

    elements.processButton.addEventListener('click', async () => {
        if (!selectedFile) return;
        setButtonState(elements.processButton, 'מעבד...', 'loading');
        try {
            if (!audioContext) initAudioContext();
            if (audioContext.state === 'suspended') await audioContext.resume();
            processedFile = await processAudio(selectedFile);
            elements.audioPlayer.src = URL.createObjectURL(processedFile);
            setButtonState(elements.processButton, 'עובד ✓', 'success');
            elements.fileName.textContent = selectedFile.name + ' (מעובד)';
            elements.fileSize.textContent = formatFileSize(processedFile.size);
            drawWaveform(processedFile);
            checkButtonsState();
        } catch (error) {
            console.error('Audio processing error:', error);
            setButtonState(elements.processButton, 'שגיאה בעיבוד', 'error');
            alert('שגיאה בעיבוד האודיו: ' + error.message + '\n\nנסה קובץ אחר או התמלל בלי עיבוד.');
        }
        setTimeout(() => {
            elements.processButton.disabled = false;
            if (elements.processButton.textContent !== 'עובד ✓') {
                setButtonState(elements.processButton, 'עבד אודיו', 'default');
            }
        }, 3000);
    });

    elements.transcribeButton.addEventListener('click', async () => {
        const fileToTranscribe = processedFile || selectedFile;
        const apiKey = elements.apiKey.value.trim();
        if (!fileToTranscribe || !apiKey) {
            alert('אנא בחר קובץ והזן מפתח API');
            return;
        }
        elements.transcribeButton.disabled = true;
        elements.progressBar.style.display = 'block';
        elements.loadingSpinner.style.display = 'block';
        elements.resultArea.style.display = 'none';
        try {
            await performTranscription(fileToTranscribe, apiKey);
        } catch (error) {
            console.error('Transcription error:', error);
            showStatus('שגיאה: ' + error.message, 'error');
        } finally {
            elements.transcribeButton.disabled = false;
            elements.loadingSpinner.style.display = 'none';
            finalizeProgress();
        }
    });

    elements.improveButton.addEventListener('click', async () => {
        const apiKey = elements.apiKey.value.trim();
        if (!apiKey) {
            alert('נדרש מפתח API לתיקון טקסט');
            return;
        }
        setButtonState(elements.improveButton, '🔄 מתקן...', 'loading');
        try {
            const improvedTranscript = await improveText(elements.transcriptText.textContent, apiKey);
            improvedResult = improvedTranscript;
            elements.improvedText.innerHTML = `<div style="font-weight: bold; margin-bottom: 10px; color: #28a745;">✨ טקסט מתוקן:</div>${improvedTranscript}`;
            elements.improvedText.style.display = 'block';
            setButtonState(elements.improveButton, '✅ הושלם', 'success');
        } catch (error) {
            console.error('Text improvement error:', error);
            alert('שגיאה בתיקון הטקסט: ' + error.message);
            setButtonState(elements.improveButton, '❌ שגיאה', 'error');
        }
        setTimeout(() => {
            elements.improveButton.disabled = false;
            if (elements.improveButton.textContent !== '✅ הושלם') {
                setButtonState(elements.improveButton, '🔧 תיקון אוטומטי', 'default');
            }
        }, 3000);
    });
    
    const downloadHandler = (isVTT) => {
        const textToDownload = isVTT ? generateVTTContent() : (improvedResult || elements.transcriptText.textContent);
        const extension = isVTT ? '.vtt' : '.txt';
        const mimeType = isVTT ? 'text/vtt' : 'text/plain';
        const blob = new Blob([textToDownload], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const originalName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "transcript";
        a.download = `${originalName}_${timestamp}${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    elements.downloadTxtButton.addEventListener('click', () => downloadHandler(false));
    elements.downloadVttButton.addEventListener('click', () => downloadHandler(true));
    
    elements.copyButton.addEventListener('click', () => {
        const textToCopy = improvedResult || elements.transcriptText.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = elements.copyButton.textContent;
            elements.copyButton.textContent = 'הועתק!';
            setTimeout(() => {
                elements.copyButton.textContent = originalText;
            }, 2000);
        }).catch(err => console.error('Failed to copy text: ', err));
    });
    
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); elements.uploadArea.classList.add('dragover'); });
    elements.uploadArea.addEventListener('dragleave', () => elements.uploadArea.classList.remove('dragover'));
    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
    });
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
            setTimeout(() => e.target.value = '', 100);
        }
    });

    document.querySelectorAll('.toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            if (toggle.id === 'noiseReductionToggle') {
                const isActive = toggle.classList.contains('active');
                elements.noiseReductionLevel.disabled = !isActive;
                elements.noiseSliderContainer.classList.toggle('disabled', !isActive);
            } else if (toggle.id === 'normalizeToggle') {
                const isActive = toggle.classList.contains('active');
                elements.volumeLevel.disabled = !isActive;
                elements.volumeSliderContainer.classList.toggle('disabled', !isActive);
            } else if (transcriptResult) {
                displayResults();
            }
        });
    });

    elements.noiseReductionLevel.addEventListener('input', (e) => { elements.noiseReductionValue.textContent = e.target.value + '%'; });
    elements.volumeLevel.addEventListener('input', (e) => { elements.volumeValue.textContent = e.target.value + '%'; });
    
    elements.resetButton.addEventListener('click', resetApp);
}

// --- APP INITIALIZATION ---
function initApp() {
    storage.loadApiKey();
    resetSettingsToDefault();
    setupEventListeners();
    checkButtonsState();
    
    document.body.addEventListener('click', () => {
        if (!audioContext) {
            try { initAudioContext(); } catch (e) { console.warn('Could not init audio context', e); }
        }
    }, { once: true });
    
    console.log('Hebrew Transcription App loaded successfully! 🚀');
}

document.addEventListener('DOMContentLoaded', initApp);
</script>
</body>
</html>
