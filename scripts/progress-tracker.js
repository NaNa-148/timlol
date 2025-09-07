// scripts/progress-tracker.js
// מערכת מעקב התקדמות פשוטה - רק זמן רץ ואחוזים

class TranscriptionProgressTracker {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.startTime = null;
        this.fileSize = 0;
        this.updateInterval = null;
        this.isCompleted = false;
        this.currentProgress = 0;
    }
    
    // התחלת מעקב
    start(fileSize) {
        this.reset();
        this.startTime = Date.now();
        this.fileSize = fileSize;
        this.isCompleted = false;
        
        // עדכון כל שנייה
        this.updateInterval = setInterval(() => {
            this.updateUI();
        }, 1000);
        
        console.log(`Started tracking: ${this.formatFileSize(fileSize)}`);
    }
    
    // עצירת מעקב
    stop(success = true) {
        this.isCompleted = true;
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        const totalTime = Date.now() - this.startTime;
        this.showFinalStatus(success, totalTime);
    }
    
    // עדכון התקדמות (מקבל אחוז מ-0 עד 100)
    updateProgress(percent) {
        this.currentProgress = Math.min(99.9, Math.max(0, percent));
        this.updateProgressBar();
    }
    
    // עדכון בר התקדמות
    updateProgressBar() {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${this.currentProgress}%`;
        }
    }
    
    // עדכון ממשק משתמש
    updateUI() {
        if (this.isCompleted) return;
        
        const elapsed = Date.now() - this.startTime;
        const elapsedStr = this.formatTime(elapsed);
        
        // הצגת סטטוס פשוט: זמן שעבר ואחוזים
        const statusText = `מעבד... | ${this.currentProgress.toFixed(1)}% | זמן שעבר: ${elapsedStr}`;
        this.updateStatusText(statusText, 'processing');
    }
    
    // הצגת סטטוס סופי
    showFinalStatus(success, totalTime) {
        const timeStr = this.formatTime(totalTime);
        
        if (success) {
            const message = `✅ התמלול הושלם בהצלחה! | זמן כולל: ${timeStr}`;
            this.updateStatusText(message, 'success');
            
            // עדכון בר התקדמות ל-100%
            const progressFill = document.getElementById('progressFill');
            if (progressFill) {
                progressFill.style.width = '100%';
                
                // איפוס אחרי 3 שניות
                setTimeout(() => {
                    progressFill.style.width = '0%';
                }, 3000);
            }
        } else {
            const message = `❌ התמלול בוטל | זמן: ${timeStr}`;
            this.updateStatusText(message, 'error');
        }
    }
    
    // עדכון טקסט סטטוס
    updateStatusText(text, type = 'processing') {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = text;
            statusElement.className = `status ${type}`;
            statusElement.style.display = 'block';
        }
    }
    
    // פונקציות עזר
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// יצירת אינסטנס גלובלי
window.progressTracker = new TranscriptionProgressTracker();

// פונקציה פשוטה לביטול תמלול
window.cancelTranscription = function() {
    if (confirm('האם לבטל את התמלול?')) {
        if (window.progressTracker) {
            window.progressTracker.stop(false);
        }
        
        // איפוס ממשק
        const transcribeButton = document.getElementById('transcribeButton');
        if (transcribeButton) transcribeButton.disabled = false;
        
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.display = 'none';
    }
};
