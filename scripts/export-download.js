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
