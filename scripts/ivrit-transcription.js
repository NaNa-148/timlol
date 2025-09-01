// תמלול באמצעות ivrit.ai

// תמלול עם ivrit.ai
async function performIvritTranscription(file, runpodApiKey, endpointId, workerUrl) {
    // בדיקת פרמטרים נדרשים
    if (!runpodApiKey || !endpointId || !workerUrl) {
        throw new Error('חסרים פרטי חיבור לivrit.ai - בדוק API Key, Endpoint ID וכתובת Worker');
    }
    
    showStatus('מעבד קובץ אודיו עבור ivrit.ai...');
    
    // בדיקת גודל קובץ (ivrit.ai עשוי להיות עם מגבלות שונות)
    if (file.size > 100 * 1024 * 1024) { // 100MB למשל
        throw new Error('קובץ גדול מדי עבור ivrit.ai. הגודל המקסימלי הוא 100MB');
    }
    
    // הכנת הקובץ לשליחה
    let fileToSend = file;
    if (file instanceof Blob && !file.name) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const originalName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "processed";
        fileToSend = new File([file], `${originalName}_processed_${timestamp}.wav`, { type: 'audio/wav' });
    }

    // הכנת FormData עם הקובץ
    const formData = new FormData();
    formData.append('audio', fileToSend);
    
    showStatus('שולח לתמלול ivrit.ai...');
    simulateProgress(5, 90, 60000);
    
    try {
        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: {
                'x-runpod-api-key': runpodApiKey,
                'x-runpod-endpoint-id': endpointId,
                // לא שולחים Content-Type כי FormData מגדיר את זה אוטומטית
            },
            body: formData  // שולחים את ה-FormData ישירות
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`שגיאה בשרת ivrit.ai: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        // התאמה למבנה התשובה של ivrit.ai (צריך להתאים לפי התשובה האמיתית)
        if (!result.text && !result.transcription) {
            throw new Error('לא התקבלה תוצאת תמלול מivrit.ai');
        }

        // יצירת אובייקט דומה לתוצאת OpenAI כדי לעבוד עם הקוד הקיים
        const transcriptText = result.text || result.transcription;
        transcriptResult = {
            text: transcriptText,
            segments: result.segments || [{
                start: 0,
                end: 0,
                text: transcriptText
            }]
        };

        displayResults();
        
    } catch (error) {
        console.error('Ivrit.ai transcription error:', error);
        
        // הודעות שגיאה ספציפיות
        let errorMessage = error.message;
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'בעיית חיבור לשרת ivrit.ai. בדוק חיבור לאינטרנט';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'הפעלה ארכה יותר מדי. נסה קובץ קטן יותר';
        }
        
        throw new Error(errorMessage);
    }
}

// בדיקת זמינות שרת ivrit.ai
async function checkIvritAiStatus(workerUrl) {
    if (!workerUrl) return false;
    
    try {
        // ניסיון פינג פשוט לworker
        const testUrl = workerUrl.endsWith('/') ? workerUrl + 'health' : workerUrl + '/health';
        const response = await fetch(testUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // timeout של 5 שניות
        });
        return response.ok;
    } catch (error) {
        console.warn('ivrit.ai server not available:', error);
        return false;
    }
}
