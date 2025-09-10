// scripts/progress-tracker.js
// מערכת מעקב התקדמות פשוטה לתמלול

class TranscriptionProgressTracker {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.startTime = null;
        this.fileSize = 0;
        this.measurements = [];
        this.updateInterval = null;
        this.isCompleted = false;
        this.lastProgressValue = 0;
        this.currentProgress = 0; // התקדמות נוכחית
        
        // הגדרות
        this.UPDATE_FREQUENCY = 1000; // עדכון כל שנייה
    }
    
    // התחלת מעקב
    start(fileSize) {
        this.reset();
        this.startTime = Date.now();
        this.fileSize = fileSize;
        this.isCompleted = false;
        this.currentProgress = 0;
        
        // התחלת עדכון ממשק
        this.updateInterval = setInterval(() => {
            if (!this.isCompleted) {
                this.updateUI();
            }
        }, this.UPDATE_FREQUENCY);
        
        console.log(`Started tracking: ${this.formatFileSize(fileSize)}`);
    }
    
    // עצירת מעקב
    stop(success = true) {
        this.isCompleted = true;
        
        // עצירת העדכון האוטומטי
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        const totalTime = Date.now() - this.startTime;
        this.showFinalStatus(success, totalTime);
    }
    
    // הוספת מדידה
    addMeasurement(processedBytes) {
        if (!this.startTime || this.isCompleted) return;
        
        const now = Date.now();
        const elapsed = now - this.startTime;
        
        // חישוב אחוז התקדמות מהבייטים
        const progress = Math.min(95, (processedBytes / this.fileSize) * 100);
        
        // עדכון רק אם יש התקדמות
        if (progress > this.currentProgress) {
            this.currentProgress = progress;
            this.lastProgressValue = processedBytes;
        }
        
        this.measurements.push({
            time: now,
            elapsed: elapsed,
            processed: processedBytes
        });
        
        // שמירת רק המדידות האחרונות
        if (this.measurements.length > 20) {
            this.measurements.shift();
        }
        
        // עדכון מיידי של הבר
        this.updateProgressBar();
    }
    
    // עדכון בר התקדמות בלבד
    updateProgressBar() {
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            // אם יש התקדמות ממשית, השתמש בה
            // אחרת, הערכה על פי זמן (עבור קובץ 70MB ~ 2 דקות)
            let displayProgress = this.currentProgress;
            
            if (displayProgress < 5 && this.startTime) {
                // הערכה בסיסית לפי זמן אם אין התקדמות
                const elapsed = Date.now() - this.startTime;
                const estimatedTotal = 120000; // 2 דקות בממוצע
                displayProgress = Math.min(90, (elapsed / estimatedTotal) * 100);
            }
            
            progressFill.style.width = `${displayProgress}%`;
            progressFill.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
        }
    }
    
    // עדכון ממשק משתמש
    updateUI() {
        if (this.isCompleted) return;
        
        const elapsed = Date.now() - this.startTime;
        
        // עדכון בר התקדמות
        this.updateProgressBar();
        
        // עדכון טקסט סטטוס - ללא אחוזים
        const elapsedStr = this.formatTime(elapsed);
        const statusText = `בתהליך... | זמן שעבר: ${elapsedStr}`;
        this.updateStatusText(statusText, 'processing');
    }
    
    // הצגת סטטוס סופי
    showFinalStatus(success, totalTime) {
        const timeStr = this.formatTime(totalTime);
        
        // עדכון בר התקדמות ל-100%
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = '100%';
        }
        
        if (success) {
            const message = `בוצע! ⏱️ זמן כולל: ${timeStr}`;
            this.updateStatusText(message, 'success');
            if (window.showStatus) window.showStatus(message, 'success');
        } else {
            const message = `נכשל אחרי ${timeStr}`;
            this.updateStatusText(message, 'error');
            if (window.showStatus) window.showStatus(message, 'error');
        }
        
        // איפוס בר התקדמות אחרי 3 שניות
        setTimeout(() => {
            if (progressFill) {
                progressFill.style.width = '0%';
            }
        }, 3000);
    }
    
    // עדכון טקסט סטטוס
    updateStatusText(text, type = 'processing') {
        if (window.showStatus) {
            window.showStatus(text, type);
        } else {
            const statusElement = document.getElementById('status');
            if (statusElement) {
                statusElement.textContent = text;
                statusElement.className = `status ${type}`;
                statusElement.style.display = 'block';
            }
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
