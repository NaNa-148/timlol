// תמלול אודיו עם OpenAI Whisper API

let transcriptResult = null;

// ביצוע תמלול
async function performTranscription(file, apiKey) {
    showStatus('מעבד קובץ אודיו...');
    
    if (file.size > 25 * 1024 * 1024) {
        throw new Error('קובץ גדול מדי. הגודל המקסימלי הוא 25MB');
    }
    
    let fileToSend = file;
    
    // אם זה קובץ מעובד, נוסיף לו שם מתאים
    if (file instanceof Blob && !file.name) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const originalName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "processed";
        fileToSend = new File([file], `${originalName}_processed_${timestamp}.wav`, { type: 'audio/wav' });
    }

    // הכנת הנתונים לשליחה
    const formData = new FormData();
    formData.append('file', fileToSend);
    formData.append('model', 'whisper-1');
    
    const languageSelect = document.getElementById('languageSelect');
    const selectedLanguage = languageSelect ? languageSelect.value : 'auto';
    
    if (selectedLanguage !== 'auto') {
        formData.append('language', selectedLanguage);
    }
    
    formData.append('response_format', 'verbose_json'); // לקבלת segments

    showStatus('נשלח לתמלול...');
    simulateProgress(5, 90, 45000); 
    
    // שליחה ל-API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
    });

    const result = await response.json();

    // טיפול בשגיאות
    if (!response.ok) {
        let errorMessage = result.error?.message || `HTTP ${response.status}`;
        
        if (errorMessage.includes('rate limit')) {
            errorMessage = 'חרגת ממגבלת הקריאות. המתן מספר דקות ונסה שוב';
        } else if (errorMessage.includes('quota') || errorMessage.includes('credit')) {
            errorMessage = 'חרגת ממכסת הקרדיט או אין אישראי בחשבון OpenAI';
        } else if (errorMessage.includes('invalid api key') || errorMessage.includes('authentication')) {
            errorMessage = 'מפתח API לא תקין. בדוק את המפתח בפלטפורמת OpenAI';
        } else if (errorMessage.includes('audio file is invalid') || errorMessage.includes('unsupported')) {
            errorMessage = 'קובץ האודיו לא נתמך או פגום. נסה להמיר ל-MP3 או WAV';
        }
        
        throw new Error(errorMessage);
    }
    
    // בדיקת תוצאה
    if (!result.text || result.text.trim() === '') {
        throw new Error('לא זוהה טקסט בקובץ האודיו. ייתכן שהקול לא ברור או שהקובץ ריק');
    }

    transcriptResult = result;
    displayResults();
}

// הצגת תוצאות התמלול
function displayResults() {
    if (!transcriptResult || !transcriptResult.segments) return;

    const timestampToggle = document.getElementById('timestampToggle');
    const paragraphToggle = document.getElementById('paragraphToggle');
    const speakerToggle = document.getElementById('speakerToggle');
    const transcriptTextElement = document.getElementById('transcriptText');
    const resultAreaElement = document.getElementById('resultArea');
    const improveButton = document.getElementById('improveButton');
    const improvedText = document.getElementById('improvedText');

    const showTimestamps = timestampToggle && timestampToggle.classList.contains('active');
    const showParagraphs = paragraphToggle && paragraphToggle.classList.contains('active');
    const showSpeakers = speakerToggle && speakerToggle.classList.contains('active');
    
    const separator = showParagraphs ? '\n\n' : ' ';
    
    let finalResult = transcriptResult.segments.map(segment => {
        let line = segment.text.trim();
        if (showTimestamps) {
            const time = formatVttTime(segment.start).substring(0, 8); // HH:MM:SS
            line = `[${time}] ${line}`;
        }
        return line;
    }).join(separator);

    if (showSpeakers && !showParagraphs) {
        finalResult = 'משתתף 1: ' + finalResult;
    } else if (showSpeakers && showParagraphs) {
        finalResult = finalResult.replace(/\[/g, 'משתתף 1: [');
    }

    if (transcriptTextElement) {
        transcriptTextElement.textContent = finalResult;
    }
    
    if (resultAreaElement) {
        resultAreaElement.style.display = 'block';
    }
    
    if (improveButton) {
        improveButton.style.display = 'inline-block';
    }
    
    if (improvedText) {
        improvedText.style.display = 'none';
    }
    
    showStatus('התמלול הושלם בהצלחה! ✅', 'success');
    
    if (resultAreaElement) {
        resultAreaElement.scrollIntoView({ behavior: 'smooth' });
    }
    
    setTimeout(hideStatus, 5000);
}

// יצירת תוכן VTT
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
