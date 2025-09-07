// שמירת תמלול ב-Cloudflare R2
async function saveTranscriptToCloud() {
    const transcriptTextElement = document.getElementById('transcriptText');
    const improvedTextElement = document.getElementById('improvedText');
    
    if (!transcriptTextElement) {
        showStatus('אין תמלול לשמירה', 'error');
        return;
    }
    
    // קח את הטקסט המשופר אם קיים, אחרת את המקורי
    let textToSave = '';
    if (improvedResult && improvedResult.trim()) {
        textToSave = improvedResult;
    } else {
        textToSave = transcriptTextElement.textContent;
    }
    
    if (!textToSave.trim()) {
        showStatus('אין תוכן לשמירה', 'error');
        return;
    }
    
    // בדיקת הגדרות ivrit.ai (נשתמש באותו Worker)
    const workerUrl = document.getElementById('workerUrl')?.value.trim();
    
    if (!workerUrl) {
        showStatus('יש להגדיר כתובת Cloudflare Worker בהגדרות ivrit', 'error');
        return;
    }
    
    try {
        showStatus('שומר תמלול באחסון הענן...', 'processing');
        
        // יצירת שם קובץ מהקובץ המקורי
        const originalFileName = selectedFile ? 
            selectedFile.name.replace(/\.[^/.]+$/, "") : 
            "transcript";
        const fileName = `${originalFileName}_transcript.txt`;
        
        // יצירת Blob מהטקסט
        const textBlob = new Blob([textToSave], { type: 'text/plain; charset=utf-8' });
        
        // שליחה ל-Worker להעלאה ל-R2
        const uploadUrl = workerUrl.endsWith('/') 
            ? `${workerUrl}upload?name=${encodeURIComponent(fileName)}`
            : `${workerUrl}/upload?name=${encodeURIComponent(fileName)}`;
        
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/plain; charset=utf-8'
            },
            body: textBlob
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`שגיאה בשמירה: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.url) {
            // הצגת הודעת הצלחה עם הקישור
            const saveButton = document.getElementById('saveToCloudButton');
            if (saveButton) {
                const originalText = saveButton.textContent;
                saveButton.textContent = '✅ נשמר בהצלחה!';
                
                // יצירת קישור להורדה
                const link = document.createElement('a');
                link.href = result.url;
                link.target = '_blank';
                link.textContent = 'פתח קובץ שנשמר';
                link.style.marginRight = '10px';
                
                // הוספת הקישור זמנית
                saveButton.parentElement.insertBefore(link, saveButton);
                
                setTimeout(() => {
                    saveButton.textContent = originalText;
                    if (link.parentElement) {
                        link.remove();
                    }
                }, 10000); // הסרה אחרי 10 שניות
            }
            
            showStatus(`התמלול נשמר בהצלחה! קישור: ${result.url}`, 'success');
            
            // שמירת הקישור במשתנה גלובלי
            window.lastSavedTranscriptUrl = result.url;
            
        } else {
            throw new Error('לא התקבל קישור לקובץ השמור');
        }
        
    } catch (error) {
        console.error('Error saving to cloud:', error);
        showStatus(`שגיאה בשמירה: ${error.message}`, 'error');
    }
}

// הוספת מאזין לכפתור
function setupSaveToCloudButton() {
    const saveButton = document.getElementById('saveToCloudButton');
    if (saveButton) {
        saveButton.addEventListener('click', saveTranscriptToCloud);
    }
}

// הוספה לאתחול
if (typeof window !== 'undefined') {
    window.saveTranscriptToCloud = saveTranscriptToCloud;
    window.setupSaveToCloudButton = setupSaveToCloudButton;
}
