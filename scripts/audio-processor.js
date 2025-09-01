// עיבוד אודיו מתקדם
let audioContext = null;

// אתחול AudioContext
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// עיבוד אודיו עם מסנני רעש ונרמול
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
    
    // הפעלת מסנן רעש
    const noiseReductionToggle = document.getElementById('noiseReductionToggle');
    if (noiseReductionToggle && noiseReductionToggle.classList.contains('active')) {
        const noiseReductionLevel = document.getElementById('noiseReductionLevel');
        const noiseReduction = offlineContext.createBiquadFilter();
        noiseReduction.type = 'highpass';
        noiseReduction.frequency.value = Math.min(200 + (noiseReductionLevel.value * 3), 800);
        noiseReduction.Q.value = 1;
        currentNode.connect(noiseReduction);
        currentNode = noiseReduction;
    }
    
    // הפעלת נרמול (compressor)
    const normalizeToggle = document.getElementById('normalizeToggle');
    if (normalizeToggle && normalizeToggle.classList.contains('active')) {
        const compressor = offlineContext.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.
    // עיבוד אודיו מתקדם
let audioContext = null;

// אתחול AudioContext
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// עיבוד אודיו עם מסנני רעש ונרמול
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
    
    // הפעלת מסנן רעש
    const noiseReductionToggle = document.getElementById('noiseReductionToggle');
    if (noiseReductionToggle && noiseReductionToggle.classList.contains('active')) {
        const noiseReductionLevel = document.getElementById('noiseReductionLevel');
        const noiseReduction = offlineContext.createBiquadFilter();
        noiseReduction.type = 'highpass';
        noiseReduction.frequency.value = Math.min(200 + (noiseReductionLevel.value * 3), 800);
        noiseReduction.Q.value = 1;
        currentNode.connect(noiseReduction);
        currentNode = noiseReduction;
    }
    
    // הפעלת נרמול (compressor)
    const normalizeToggle = document.getElementById('normalizeToggle');
    if (normalizeToggle && normalizeToggle.classList.contains('active')) {
        const compressor = offlineContext.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        currentNode.connect(compressor);
        currentNode = compressor;
    }
    
    // התאמת עוצמת קול
    const volumeLevel = document.getElementById('volumeLevel');
    const volumeValue = volumeLevel ? volumeLevel.value / 100 : 1;
    if (volumeValue !== 1) {
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = volumeValue;
        currentNode.connect(gainNode);
        currentNode = gainNode;
    }
    
    currentNode.connect(offlineContext.destination);
    source.start();
    const processedBuffer = await offlineContext.startRendering();
    
    return bufferToWaveFile(processedBuffer);
}

// המרת AudioBuffer לקובץ WAV
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
    const writeUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };
    const writeUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };

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
