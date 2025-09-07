// ייצוא והורדת תוצאות

// הורדת קובץ כללי
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// יצירת שם קובץ עם timestamp
function generateFilename(extension) {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const originalName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "transcript";
    return `${originalName}_${timestamp}.${extension}`;
}

// הורדה כ-TXT
function downloadAsTXT() {
    const transcriptTextElement = document.getElementById('transcriptText');
    if (!transcriptTextElement) return;
    
    const textToDownload = improvedResult || transcriptTextElement.textContent;
    const filename = generateFilename('txt');
    
    downloadFile(textToDownload, filename, 'text/plain');
}

// הורדה כ-VTT
function downloadAsVTT() {
    const vttContent = generateVTTContent();
    if (!vttContent) {
        alert('אין נתונים זמינים ליצירת קובץ VTT');
        return;
    }
    
    const filename = generateFilename('vtt');
    downloadFile(vttContent, filename, 'text/vtt');
}

// העתקה ללוח
function copyToClipboard() {
    const transcriptTextElement = document.getElementById('transcriptText');
    const copyButton = document.getElementById('copyButton');
    
    if (!transcriptTextElement || !copyButton) return;
    
    const textToCopy = improvedResult || transcriptTextElement.textContent;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = copyButton.textContent;
        copyButton.textContent = 'הועתק!';
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        // fallback לדפדפנים ישנים
        try {
            const textArea = document.createElement('textarea');
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const originalText = copyButton.textContent;
            copyButton.textContent = 'הועתק!';
            setTimeout(() => {
                copyButton.textContent = originalText;
            }, 2000);
        } catch (fallbackErr) {
            alert('לא ניתן להעתיק. אנא בחר והעתק ידנית.');
        }
    });
}

// הגדרת כפתורי הורדה והעתקה
function setupExportButtons() {
    const downloadTxtButton = document.getElementById('downloadTxtButton');
    const downloadVttButton = document.getElementById('downloadVttButton');
    const copyButton = document.getElementById('copyButton');
    
    if (downloadTxtButton) {
        downloadTxtButton.addEventListener('click', downloadAsTXT);
    }
    
    if (downloadVttButton) {
        downloadVttButton.addEventListener('click', downloadAsVTT);
    }
    
    if (copyButton) {
        copyButton.addEventListener('click', copyToClipboard);
    }
}

// הוסף את הקוד הזה לקובץ export-download.js

// משתנה גלובלי לשמירת URL הענן האחרון
let lastCloudSaveUrl = null;

// פונקציה לשמירת תמלול בענן
async function saveToCloud() {
    const transcriptTextElement = document.getElementById('transcriptText');
    const saveToCloudButton = document.getElementById('saveToCloudButton');
    
    if (!transcriptTextElement) {
        alert('אין תמלול לשמירה');
        return;
    }
    
    // קבלת הטקסט לשמירה (משופר אם קיים, אחרת המקורי)
    const textToSave = improvedResult || transcriptTextElement.textContent;
    
    if (!textToSave || textToSave.trim() === '') {
        alert('אין תוכן לשמירה');
        return;
    }
    
    // קבלת שם הקובץ המקורי
    let originalFileName = 'transcript.txt';
    if (selectedFile && selectedFile.name) {
        // החלפת סיומת הקובץ ל-txt
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        originalFileName = `${nameWithoutExt}.txt`;
    }
    
    // קבלת הגדרות החיבור
    const transcriptionService = document.getElementById('transcriptionService');
    const selectedService = transcriptionService ? transcriptionService.value : 'openai';
    
    let workerUrl = null;
    
    if (selectedService === 'ivrit-ai') {
        const workerUrlInput = document.getElementById('workerUrl');
        workerUrl = workerUrlInput ? workerUrlInput.value.trim() : null;
    }
    
    if (!workerUrl) {
        alert('נדרשת כתובת Cloudflare Worker לשמירה בענן.\nעבור ל-ivrit.ai או הגדר Worker URL.');
        return;
    }
    
    // עדכון הכפתור
    if (saveToCloudButton) {
        saveToCloudButton.disabled = true;
        saveToCloudButton.textContent = '☁️ שומר...';
    }
    
    try {
        // יצירת Blob מהטקסט
        const textBlob = new Blob([textToSave], { type: 'text/plain; charset=utf-8' });
        
        // העלאה ל-R2 דרך הWorker
        const uploadUrl = workerUrl.endsWith('/') 
            ? `${workerUrl}upload?name=${encodeURIComponent(originalFileName)}`
            : `${workerUrl}/upload?name=${encodeURIComponent(originalFileName)}`;
        
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
            lastCloudSaveUrl = result.url;
            
            // הצגת הודעת הצלחה עם קישור
            showCloudSaveSuccess(result.url, originalFileName);
            
            // עדכון הכפתור
            if (saveToCloudButton) {
                saveToCloudButton.textContent = '✅ נשמר בענן';
                saveToCloudButton.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
            }
            
            // החזרת הכפתור למצב רגיל אחרי 3 שניות
            setTimeout(() => {
                if (saveToCloudButton) {
                    saveToCloudButton.disabled = false;
                    saveToCloudButton.textContent = '☁️ שמור בענן';
                    saveToCloudButton.style.background = '';
                }
            }, 3000);
            
        } else {
            throw new Error('לא התקבל URL לקובץ השמור');
        }
        
    } catch (error) {
        console.error('Error saving to cloud:', error);
        alert('שגיאה בשמירה בענן:\n' + error.message);
        
        // החזרת הכפתור למצב רגיל
        if (saveToCloudButton) {
            saveToCloudButton.disabled = false;
            saveToCloudButton.textContent = '☁️ שמור בענן';
            saveToCloudButton.style.background = '';
        }
    }
}

// הצגת הודעת הצלחה עם קישור
function showCloudSaveSuccess(url, fileName) {
    // יצירת אלמנט להודעה
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        padding: 20px 30px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(40, 167, 69, 0.4);
        text-align: center;
        animation: slideDown 0.3s ease;
        max-width: 80%;
        font-family: 'Segoe UI', 'Arial', sans-serif;
    `;
    
    successDiv.innerHTML = `
        <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 10px;">
            ☁️ התמלול נשמר בענן בהצלחה!
        </div>
        <div style="margin-bottom: 15px;">
            <strong>שם הקובץ:</strong> ${fileName}
        </div>
        <div style="margin-bottom: 15px;">
            <a href="${url}" target="_blank" style="
                color: white;
                text-decoration: underline;
                font-weight: bold;
                font-size: 1.1em;
            ">🔗 לחץ כאן לצפייה/הורדה</a>
        </div>
        <button onclick="navigator.clipboard.writeText('${url}').then(() => this.textContent = 'הועתק!').catch(() => alert('${url}'))" 
            style="
                background: white;
                color: #28a745;
                border: none;
                padding: 8px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                margin-right: 10px;
            ">העתק קישור</button>
        <button onclick="this.parentElement.remove()" 
            style="
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid white;
                padding: 8px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
            ">סגור</button>
    `;
    
    document.body.appendChild(successDiv);
    
    // הסרה אוטומטית אחרי 15 שניות
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => successDiv.remove(), 300);
        }
    }, 15000);
}

// עדכון setupExportButtons - הוסף בסוף הפונקציה
function setupExportButtons() {
    const downloadTxtButton = document.getElementById('downloadTxtButton');
    const downloadVttButton = document.getElementById('downloadVttButton');
    const copyButton = document.getElementById('copyButton');
    const saveToCloudButton = document.getElementById('saveToCloudButton'); // חדש!
    
    if (downloadTxtButton) {
        downloadTxtButton.addEventListener('click', downloadAsTXT);
    }
    
    if (downloadVttButton) {
        downloadVttButton.addEventListener('click', downloadAsVTT);
    }
    
    if (copyButton) {
        copyButton.addEventListener('click', copyToClipboard);
    }
    
    // מאזין לכפתור שמירה בענן
    if (saveToCloudButton) {
        saveToCloudButton.addEventListener('click', saveToCloud);
    }
}

// הוסף אנימציית fadeOut ל-CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
