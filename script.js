import { storage, fileToBase64, formatVttTime, sleep, formatFileSize } from './utils.js';

// Global state
let selectedFile = null;
let processedFile = null;
let transcriptResult = null;
let improvedResult = '';
let audioContext = null;
let progressInterval = null;

// DOM Elements
const elements = {
    // Service Selection
    serviceSelector: document.getElementById('serviceSelector'),
    openaiSettings: document.getElementById('openaiSettings'),
    ivritaiSettings: document.getElementById('ivritaiSettings'),
    apiKey: document.getElementById('apiKey'),
    proxyUrl: document.getElementById('proxyUrl'),
    endpointId: document.getElementById('endpointId'),
    runpodApiKey: document.getElementById('runpodApiKey'),

    // File Handling
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    
    // Audio Preview & Processing
    audioPreview: document.getElementById('audioPreview'),
    audioPlayer: document.getElementById('audioPlayer'),
    waveformCanvas: document.getElementById('waveformCanvas'),
    processButton: document.getElementById('processButton'),
    noiseReductionToggle: document.getElementById('noiseReductionToggle'),
    noiseSliderContainer: document.getElementById('noiseSliderContainer'),
    noiseReductionLevel: document.getElementById('noiseReductionLevel'),
    noiseReductionValue: document.getElementById('noiseReductionValue'),
    normalizeToggle: document.getElementById('normalizeToggle'),
    volumeSliderContainer: document.getElementById('volumeSliderContainer'),
    volumeLevel: document.getElementById('volumeLevel'),
    volumeValue: document.getElementById('volumeValue'),

    // Action & Status
    transcribeButton: document.getElementById('transcribeButton'),
    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    status: document.getElementById('status'),
    
    // Results
    resultArea: document.getElementById('resultArea'),
    transcriptText: document.getElementById('transcriptText'),
    improvedText: document.getElementById('improvedText'),
    improveButton: document.getElementById('improveButton'),
    improveModelSelect: document.getElementById('improveModelSelect'),
    
    // Download & Copy
    downloadTxtButton: document.getElementById('downloadTxtButton'),
    downloadVttButton: document.getElementById('downloadVttButton'),
    copyButton: document.getElementById('copyButton'),

    // Other settings
    languageSelect: document.getElementById('languageSelect'),
    resetButton: document.getElementById('resetButton'),
    speakerToggle: document.getElementById('speakerToggle'),
    timestampToggle: document.getElementById('timestampToggle'),
    paragraphToggle: document.getElementById('paragraphToggle'),
};

// --- UI & STATE MANAGEMENT ---
function checkButtonsState() {
    const service = elements.serviceSelector.value;
    let hasCredentials = false;
    if (service === 'openai') {
        hasCredentials = !!elements.apiKey.value.trim();
    } else {
        hasCredentials = !!elements.proxyUrl.value.trim() && !!elements.endpointId.value.trim() && !!elements.runpodApiKey.value.trim();
    }
    const hasFile = selectedFile || processedFile;
    elements.transcribeButton.disabled = !hasFile || !hasCredentials;
    elements.processButton.disabled = !selectedFile;
}

function showStatus(message, type = 'processing') {
    elements.status.className = `status ${type}`;
    elements.status.textContent = message;
    elements.status.style.display = 'block';
}

function hideStatus() {
    elements.status.style.display = 'none';
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

// --- AUDIO PROCESSING & WAVEFORM ---
function initAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function drawWaveform(file) {
    const canvas = elements.waveformCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#667eea';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('טוען צורת גל...', canvas.width / 2, canvas.height / 2);
    file.arrayBuffer().then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => drawAudioWaveform(ctx, canvas, audioBuffer))
        .catch(error => console.warn('Could not draw waveform:', error));
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
        let min = 1.0, max = -1.0;
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
    const offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    let currentNode = source;
    if (elements.noiseReductionToggle.classList.contains('active')) {
        const noiseReduction = offlineContext.createBiquadFilter();
        noiseReduction.type = 'highpass';
        noiseReduction.frequency.value = Math.min(200 + (elements.noiseReductionLevel.value * 3), 800);
        currentNode.connect(noiseReduction);
        currentNode = noiseReduction;
    }
    if (elements.normalizeToggle.classList.contains('active')) {
        const compressor = offlineContext.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
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
    const wavBlob = bufferToWaveFile(processedBuffer);
    return new File([wavBlob], "processed.wav", { type: "audio/wav" });
}

function bufferToWaveFile(audioBuffer) {
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


// --- TRANSCRIPTION LOGIC ---
async function performOpenAiTranscription() {
    const fileToTranscribe = processedFile || selectedFile;
    const formData = new FormData();
    formData.append('file', fileToTranscribe);
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    if (elements.languageSelect.value !== 'auto') {
        formData.append('language', elements.languageSelect.value);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${elements.apiKey.value.trim()}` },
        body: formData
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || `HTTP ${response.status}`);
    return result;
}

async function performIvritAiTranscription() {
    showStatus('שולח משימה לשרת...');
    const fileToTranscribe = processedFile || selectedFile;
    const audio_base64 = await fileToBase64(fileToTranscribe);
    
    const startJobBody = JSON.stringify({
        input: {
            transcribe_args: {
                blob: audio_base64,
                language: "he"
            }
        }
    });

    const startResponse = await fetch(elements.proxyUrl.value.trim(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-runpod-api-key': elements.runpodApiKey.value.trim(),
            'x-runpod-endpoint-id': elements.endpointId.value.trim()
        },
        body: startJobBody
    });

    const startResult = await startResponse.json();
    if (!startResponse.ok || startResult.error) throw new Error(startResult.error?.message || startResult.error || `HTTP ${startResponse.status}`);
    if (!startResult.id) throw new Error("לא התקבל מזהה משימה מהשרת");

    const jobId = startResult.id;
    showStatus(`המשימה (${jobId.substring(0,8)}) נשלחה. ממתין לתוצאות...`);

    let pollCount = 0;
    const maxPolls = 60; // Poll for 5 minutes max (60 * 5s)
    while (pollCount < maxPolls) {
        await sleep(5000);
        const statusResponse = await fetch(elements.proxyUrl.value.trim(), {
            method: 'POST',
            headers: {
                'x-runpod-api-key': elements.runpodApiKey.value.trim(),
                'x-runpod-endpoint-id': elements.endpointId.value.trim(),
                'x-job-id': jobId
            }
        });

        const statusResult = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusResult.error?.message || `HTTP ${statusResponse.status}`);
        if (statusResult.error) throw new Error(statusResult.error);
        
        if (statusResult.status === "COMPLETED") {
            return statusResult.output;
        } else if (statusResult.status === "FAILED") {
            throw new Error("התמלול נכשל בשרת");
        }
        pollCount++;
        showStatus(`בודק סטטוס... (${pollCount}/${maxPolls})`);
    }
    throw new Error("התמלול ארך זמן רב מדי");
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
    if (!improvedContent) {
        throw new Error('לא ניתן לשפר את הטקסט');
    }
    return improvedContent;
}

// --- DISPLAY & DOWNLOAD ---
function displayResults(resultData) {
    transcriptResult = resultData;
    
    let segments = transcriptResult?.segments;

    if (!segments) {
        const fallbackText = transcriptResult?.text || (typeof transcriptResult === 'string' ? transcriptResult : "לא נמצא טקסט תמלול בתוצאה.");
        elements.transcriptText.textContent = fallbackText;
    } else {
        const showTimestamps = elements.timestampToggle.classList.contains('active');
        const showParagraphs = elements.paragraphToggle.classList.contains('active');
        const showSpeakers = elements.speakerToggle.classList.contains('active');
        const separator = showParagraphs ? '\n\n' : ' ';
        
        let finalText = segments
            .filter(segment => segment && typeof segment.text === 'string') // Robustness check
            .map(segment => {
                let line = segment.text.trim();
                if (showTimestamps) {
                    line = `[${formatVttTime(segment.start).substring(0, 8)}] ${line}`;
                }
                return line;
            }).join(separator);

        if (showSpeakers && !showParagraphs) {
            finalText = 'משתתף 1: ' + finalText;
        } else if (showSpeakers && showParagraphs) {
            finalText = finalText.replace(/\[/g, 'משתתף 1: [');
        }
        elements.transcriptText.textContent = finalText;
    }
    
    elements.resultArea.style.display = 'block';
    elements.improveButton.style.display = 'inline-block';
    elements.improvedText.style.display = 'none';
    elements.resultArea.scrollIntoView({ behavior: 'smooth' });
}

function generateVTTContent() {
    if (!transcriptResult || !transcriptResult.segments) return '';
    let vttContent = "WEBVTT\n\n";
    transcriptResult.segments
        .filter(segment => segment && typeof segment.text === 'string')
        .forEach(segment => {
            vttContent += `${formatVttTime(segment.start)} --> ${formatVttTime(segment.end)}\n${segment.text.trim()}\n\n`;
        });
    return vttContent;
}

function downloadHandler(isVTT) {
    const textToDownload = isVTT ? generateVTTContent() : (improvedResult || elements.transcriptText.textContent);
    const blob = new Blob([textToDownload], {
        type: `${isVTT ? 'text/vtt' : 'text/plain'};charset=utf-8`
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${Date.now()}${isVTT ? '.vtt' : '.txt'}`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    elements.serviceSelector.addEventListener('change', (e) => {
        const is_openai = e.target.value === 'openai';
        elements.openaiSettings.classList.toggle('hidden', !is_openai);
        elements.ivritaiSettings.classList.toggle('hidden', is_openai);
        storage.save('serviceSelector', e.target.value);
        checkButtonsState();
    });

    ['apiKey', 'proxyUrl', 'endpointId', 'runpodApiKey'].forEach(id => {
        elements[id].addEventListener('input', checkButtonsState);
        elements[id].addEventListener('blur', (e) => storage.save(id, e.target.value));
    });

    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            selectedFile = e.target.files[0];
            processedFile = null;
            elements.fileName.textContent = selectedFile.name;
            elements.fileSize.textContent = `(${formatFileSize(selectedFile.size)})`;
            elements.fileInfo.style.display = 'block';
            elements.audioPreview.style.display = 'block';
            elements.audioPlayer.src = URL.createObjectURL(selectedFile);
            initAudioContext();
            drawWaveform(selectedFile);
            checkButtonsState();
        }
    });

    elements.processButton.addEventListener('click', async () => {
        if (!selectedFile) return;
        elements.processButton.disabled = true;
        elements.processButton.textContent = 'מעבד...';
        try {
            initAudioContext();
            processedFile = await processAudio(selectedFile);
            elements.audioPlayer.src = URL.createObjectURL(processedFile);
            elements.fileName.textContent = selectedFile.name + ' (מעובד)';
            drawWaveform(processedFile);
            elements.processButton.textContent = 'עובד ✓';
        } catch (error) {
            alert('שגיאה בעיבוד האודיו: ' + error.message);
            elements.processButton.textContent = 'שגיאה';
        } finally {
            elements.processButton.disabled = false;
        }
    });

    elements.transcribeButton.addEventListener('click', async () => {
        elements.transcribeButton.disabled = true;
        elements.loadingSpinner.style.display = 'block';
        elements.resultArea.style.display = 'none';
        elements.progressBar.style.display = 'block';

        try {
            showStatus('נשלח לתמלול...');
            const service = elements.serviceSelector.value;
            const resultData = service === 'openai' ? await performOpenAiTranscription() : await performIvritAiTranscription();
            displayResults(resultData);
            showStatus('התמלול הושלם בהצלחה! ✅', 'success');
        } catch (error) {
            console.error('Transcription error:', error);
            showStatus(`שגיאה: ${error.message}`, 'error');
        } finally {
            elements.transcribeButton.disabled = false;
            elements.loadingSpinner.style.display = 'none';
            finalizeProgress();
        }
    });
    
    elements.improveButton.addEventListener('click', async () => {
        const apiKey = elements.apiKey.value.trim();
        if (!apiKey) {
            alert('נדרש מפתח OpenAI API לתיקון טקסט');
            return;
        }
        elements.improveButton.disabled = true;
        elements.improveButton.textContent = 'מתקן...';
        try {
            const improved = await improveText(elements.transcriptText.textContent, apiKey);
            improvedResult = improved;
            elements.improvedText.innerHTML = `<div style="font-weight: bold; margin-bottom: 10px; color: #28a745;">✨ טקסט מתוקן:</div>${improved}`;
            elements.improvedText.style.display = 'block';
        } catch (error) {
            alert(`שגיאה בתיקון הטקסט: ${error.message}`);
        } finally {
            elements.improveButton.disabled = false;
            elements.improveButton.textContent = '🔧 תיקון אוטומטי';
        }
    });

    document.querySelectorAll('.toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            if (transcriptResult) displayResults(transcriptResult);
        });
    });

    elements.downloadTxtButton.addEventListener('click', () => downloadHandler(false));
    elements.downloadVttButton.addEventListener('click', () => downloadHandler(true));
    elements.copyButton.addEventListener('click', () => {
        const textToCopy = improvedResult || elements.transcriptText.textContent;
        navigator.clipboard.writeText(textToCopy);
    });
    elements.resetButton.addEventListener('click', resetApp);
}

// --- APP INITIALIZATION ---
function initApp() {
    ['apiKey', 'proxyUrl', 'endpointId', 'runpodApiKey', 'serviceSelector'].forEach(id => {
        const savedValue = storage.load(id);
        if (savedValue && elements[id]) elements[id].value = savedValue;
    });
    elements.serviceSelector.dispatchEvent(new Event('change'));
    setupEventListeners();
    checkButtonsState();
    console.log('App loaded successfully! 🚀');
}

document.addEventListener('DOMContentLoaded', initApp);
</script>
</body>
</html>
