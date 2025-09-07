// חישוב והצגת סטטיסטיקות תמלול

function calculateTranscriptStats(text) {
    if (!text || !text.trim()) {
        return {
            lines: 0,
            words: 0,
            characters: 0,
            charactersNoSpaces: 0,
            estimatedPages: 0,
            estimatedReadingTime: 0
        };
    }
    
    // חישוב שורות
    const lines = text.split('\n').filter(line => line.trim()).length;
    
    // חישוב מילים
    const words = text.trim().split(/\s+/).filter(word => word).length;
    
    // חישוב תווים
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, '').length;
    
    // הערכת מספר דפים (בערך 250 מילים לעמוד)
    const estimatedPages = Math.ceil(words / 250);
    
    // הערכת זמן קריאה (בערך 200 מילים לדקה בעברית)
    const estimatedReadingTime = Math.ceil(words / 200);
    
    return {
        lines,
        words,
        characters,
        charactersNoSpaces,
        estimatedPages,
        estimatedReadingTime
    };
}

function displayTranscriptStats() {
    const transcriptTextElement = document.getElementById('transcriptText');
    const statsContainer = document.getElementById('transcriptStats');
    
    if (!transcriptTextElement || !statsContainer) return;
    
    // קח את הטקסט המשופר אם קיים, אחרת את המקורי
    const text = improvedResult || transcriptTextElement.textContent;
    const stats = calculateTranscriptStats(text);
    
    // חישוב משך זמן תמלול
    let transcriptionTime = '';
    if (transcriptionStartTime) {
        const elapsed = Date.now() - transcriptionStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        transcriptionTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // בניית HTML של הסטטיסטיקות
    let statsHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-icon">📝</span>
                <span class="stat-value">${stats.words.toLocaleString()}</span>
                <span class="stat-label">מילים</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon">📄</span>
                <span class="stat-value">${stats.lines.toLocaleString()}</span>
                <span class="stat-label">שורות</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon">📚</span>
                <span class="stat-value">~${stats.estimatedPages}</span>
                <span class="stat-label">דפים</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon">⏱️</span>
                <span class="stat-value">${stats.estimatedReadingTime}</span>
                <span class="stat-label">דקות קריאה</span>
            </div>
    `;
    
    if (transcriptionTime) {
        statsHTML += `
            <div class="stat-item">
                <span class="stat-icon">⏰</span>
                <span class="stat-value">${transcriptionTime}</span>
                <span class="stat-label">זמן תמלול</span>
            </div>
        `;
    }
    
    // אם יש קובץ, הוסף מידע עליו
    if (selectedFile) {
        const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(1);
        statsHTML += `
            <div class="stat-item">
                <span class="stat-icon">💾</span>
                <span class="stat-value">${fileSizeMB} MB</span>
                <span class="stat-label">גודל קובץ</span>
            </div>
        `;
    }
    
    statsHTML += '</div>';
    
    // הוספת מידע נוסף בשורה נפרדת
    statsHTML += `
        <div class="stats-extra">
            <span>סה״כ ${stats.characters.toLocaleString()} תווים</span>
            <span>•</span>
            <span>${stats.charactersNoSpaces.toLocaleString()} תווים ללא רווחים</span>
        </div>
    `;
    
    statsContainer.innerHTML = statsHTML;
    statsContainer.style.display = 'block';
}

// עדכון סטטיסטיקות בזמן אמת בעת עריכה
function setupStatsListeners() {
    const transcriptTextElement = document.getElementById('transcriptText');
    
    if (transcriptTextElement) {
        // עדכון בעת שינוי תוכן
        transcriptTextElement.addEventListener('input', () => {
            displayTranscriptStats();
        });
        
        // עדכון בעת הדבקה
        transcriptTextElement.addEventListener('paste', () => {
            setTimeout(displayTranscriptStats, 100);
        });
    }
}

// הוספה לפונקציית displayResults הקיימת
const originalDisplayResults = window.displayResults;
window.displayResults = function() {
    if (originalDisplayResults) {
        originalDisplayResults.apply(this, arguments);
    }
    
    // הצגת שדה ההקשר
    const contextContainer = document.getElementById('contextFieldContainer');
    if (contextContainer) {
        contextContainer.style.display = 'block';
    }
    
    // הצגת סטטיסטיקות
    setTimeout(displayTranscriptStats, 100);
};

// הוספה לפונקציית displayImprovedText הקיימת
const originalDisplayImprovedText = window.displayImprovedText;
window.displayImprovedText = function(improvedContent) {
    if (originalDisplayImprovedText) {
        originalDisplayImprovedText.apply(this, arguments);
    }
    
    // עדכון סטטיסטיקות לטקסט המשופר
    setTimeout(displayTranscriptStats, 100);
};

// הגדרה גלובלית
if (typeof window !== 'undefined') {
    window.calculateTranscriptStats = calculateTranscriptStats;
    window.displayTranscriptStats = displayTranscriptStats;
    window.setupStatsListeners = setupStatsListeners;
}
