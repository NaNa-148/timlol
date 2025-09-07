// הקובץ הראשי - אתחול האפליקציה

// איפוס הגדרות לברירת מחדל
function resetSettingsToDefault() {
    // שפה
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) languageSelect.value = 'he';
    
    // עיבוד אודיו
    const noiseReductionToggle = document.getElementById('noiseReductionToggle');
    const noiseReductionLevel = document.getElementById('noiseReductionLevel');
    const noiseReductionValue = document.getElementById('noiseReductionValue');
    const noiseSliderContainer = document.getElementById('noiseSliderContainer');
    
    if (noiseReductionToggle) noiseReductionToggle.classList.add('active');
    if (noiseReductionLevel) {
        noiseReductionLevel.value = 30;
        noiseReductionLevel.disabled = false;
    }
    if (noiseReductionValue) noiseReductionValue.textContent = '30%';
    if (noiseSliderContainer) noiseSliderContainer.classList.remove('disabled');

    const normalizeToggle = document.getElementById('normalizeToggle');
    const volumeLevel = document.getElementById('volumeLevel');
    const volumeValue = document.getElementById('volumeValue');
    const volumeSliderContainer = document.getElementById('volumeSliderContainer');
    
    if (normalizeToggle) normalizeToggle.classList.add('active');
    if (volumeLevel) {
        volumeLevel.value = 100;
        volumeLevel.disabled = false;
    }
    if (volumeValue) volumeValue.textContent = '100%';
    if (volumeSliderContainer) volumeSliderContainer.classList.remove('disabled');
    
    // תמלול
    const timestampToggle = document.getElementById('timestampToggle');
    const speakerToggle = document.getElementById('speakerToggle');
    const paragraphToggle = document.getElementById('paragraphToggle');
    
    if (timestampToggle) timestampToggle.classList.remove('active'); // ברירת מחדל - כבוי
    if (speakerToggle) speakerToggle.classList.remove('active');
    if (paragraphToggle) paragraphToggle.classList.remove('active'); // ברירת מחדל - כבוי
    
    // שיפור טקסט
    const improveModelSelect = document.getElementById('improveModelSelect');
    if (improveModelSelect) improveModelSelect.value = 'gpt-4o';
}

// איפוס מלא של האפליקציה
function resetApp() {
    if (confirm('האם אתה בטוח שברצונך לאפס את האפליקציה?\n\nכל הקבצים, התמלולים וההגדרות יחזרו למצב ברירת המחדל.')) {
        // איפוס משתנים גלובליים
        selectedFile = null;
        processedFile = null;
        transcriptResult = null;
        improvedResult = '';
        
        // הסתרת אזורים
        const elementsToHide = [
            'fileInfo', 'audioPreview', 'resultArea', 
            'progressBar', 'loadingSpinner', 'improvedText'
        ];
        
        elementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        const improveButton = document.getElementById('improveButton');
        if (improveButton) improveButton.style.display = 'none';
        
        hideStatus();
        
        // איפוס נגן אודיו
        const audioPlayer = document.getElementById('audioPlayer');
        if (audioPlayer) audioPlayer.src = '';
        
        // איפוס כפתורים
        const processButton = document.getElementById('processButton');
        const improveButtonReset = document.getElementById('improveButton');
        
        if (processButton) setButtonState(processButton, 'עבד אודיו');
        if (improveButtonReset) setButtonState(improveButtonReset, '🔧 תיקון אוטומטי');
        
        // ניקוי Canvas
        clearWaveform();
        
        // איפוס שדות
        const fileInput = document.getElementById('fileInput');
        const transcriptText = document.getElementById('transcriptText');
        const improvedTextElement = document.getElementById('improvedText');
        
        if (fileInput) fileInput.value = '';
        if (transcriptText) transcriptText.textContent = '';
        if (improvedTextElement) {
            improvedTextElement.innerHTML = '<div style="font-weight: bold; margin-bottom: 10px; color: #28a745;">✨ טקסט מתוקן:</div>';
        }
        
        // איפוס הגדרות לברירת מחדל
        resetSettingsToDefault();
        
        // בדיקת מצב כפתורים
        checkButtonsState();
        
        console.log('System reset completed');
    }
}

// אתחול האפליקציה
function initApp() {
    try {
        // טעינת מפתח API שמור
        storage.loadApiKey();

        // טעינת נתוני ivrit.ai
        storage.loadIvritAiCredentials();
        
        // איפוס הגדרות לברירת מחדל
        resetSettingsToDefault();
        
        // הגדרת כל המאזינים
        setupEventListeners();
        
        // בדיקת מצב כפתורים
        checkButtonsState();
        
        // הדפסת הודעה לקונסולה
        console.log('Hebrew Transcription App loaded successfully! 🚀');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        alert('שגיאה בטעינת האפליקציה: ' + error.message);
    }
}

// אתחול כשהדף נטען
document.addEventListener('DOMContentLoaded', initApp);
