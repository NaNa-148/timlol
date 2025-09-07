// ציור וויזואליזציה של גלי אודיו

// ציור צורת גל עיקרי
function drawWaveform(file) {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    
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

// ציור צורת גל פשוטה (fallback)
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

// ציור צורת גל מדויק על בסיס AudioBuffer
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

// ניקוי Canvas
function clearWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}
