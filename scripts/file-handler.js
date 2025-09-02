// טיפול בקבצי אודיו ווידאו

// משתנים גלובליים
let selectedFile = null;
let processedFile = null;

// טיפול בבחירת קובץ
function handleFileSelect(file) {
    if (!file) return;
    
    selectedFile = file;
    processedFile = null;
    
    try {
        // עדכון מידע הקובץ
        const fileNameElement = document.getElementById('fileName');
        const fileSizeElement = document.getElementById('fileSize');
        const fileInfoElement = document.getElementById('fileInfo');
        const audioPreviewElement = document.getElementById('audioPreview');
        const resultAreaElement = document.getElementById('resultArea');
        const audioPlayer = document.getElementById('audioPlayer');
        const processButton = document.getElementById('processButton');
        
        if (fileNameElement) fileNameElement.textContent = file.name;
        if (fileSizeElement) fileSizeElement.textContent = formatFileSize(file.size);
        if (fileInfoElement) fileInfoElement.style.display = 'block';
        if (audioPreviewElement) audioPreviewElement.style.display = 'block';
        if (resultAreaElement) resultAreaElement.style.display = 'none';
        
        if (processButton) {
            setButtonState(processButton, 'עבד אודיו', 'default');
        }
        
        // יצירת URL לנגן האודיו
        if (audioPlayer) {
            const url = URL.createObjectURL(file);
            audioPlayer.src = url;
        }
        
        // ציור צורת גל
        drawWaveform(file);
        checkButtonsState();
        
        // בדיקת גודל קובץ
        if (file.size > 25 * 1024 * 1024) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(1);
            alert(`⚠️ הקובץ גדול (${sizeMB}MB) מהמגבלה של OpenAI (25MB).\n\nהמערכת תדחוס אותו אוטומטית בעיבוד האודיו.`);
        }
        
    } catch (error) {
        console.error('Error in handleFileSelect:', error);
        alert('שגיאה בטעינת הקובץ: ' + error.message);
    }
}

// הגדרת listeners לטיפול בקבצים
function setupFileHandling() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    // לחיצה על אזור ההעלאה
    if (uploadArea) {
        uploadArea.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
        
        // Drag & Drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }
    
    // בחירת קובץ
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
                // ניקוי הערך למניעת בעיות בבחירה מחודשת
                setTimeout(() => e.target.value = '', 100);
            }
        });
    }
}

// בדיקת תקינות קובץ אודיו
function validateAudioFile(file) {
    const validTypes = [
        'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/wave',
        'audio/m4a', 'audio/mp4', 'audio/flac', 'audio/webm',
        'video/mp4', 'video/webm'
    ];
    
    const validExtensions = ['mp3', 'wav', 'm4a', 'mp4', 'flac', 'webm'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    return validTypes.includes(file.type) || validExtensions.includes(fileExtension);
}

// ניקוי קבצים
function clearFiles() {
    selectedFile = null;
    processedFile = null;
    
    const fileInfoElement = document.getElementById('fileInfo');
    const audioPreviewElement = document.getElementById('audioPreview');
    const audioPlayer = document.getElementById('audioPlayer');
    const fileInput = document.getElementById('fileInput');
    
    if (fileInfoElement) fileInfoElement.style.display = 'none';
    if (audioPreviewElement) audioPreviewElement.style.display = 'none';
    if (audioPlayer) audioPlayer.src = '';
    if (fileInput) fileInput.value = '';
    
    clearWaveform();
    checkButtonsState();
}
