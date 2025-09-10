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
        
        // הגדרות
        this.UPDATE_FREQUENCY = 1000; // עדכון כל שנייה
    }
    
    // התחלת מעקב
    start(fileSize) {
        this.reset();
        this.startTime = Date.now();
        this.fileSize = fileSize;
        this.isCompleted = false;
        
        // התחלת עדכון ממשק
        this.updateInterval = setInterval(() => {
            this.updateUI();
        }, this.UPDATE_FREQUENCY);
        
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
    
    // הוספת מדידה
    addMeasurement(processedBytes) {
        if (!this.startTime || this.isCompleted) return;
        
        const now = Date.now();
        const elapsed = now - this.startTime;
        
        // עדכון ההתקדמות
        if (processedBytes > this.lastProgressValue) {
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
    }
    
    // חישוב אחוז התקדמות
    calculateProgress() {
        if (this.measurements.length === 0) return 0;
        
        const lastMeasurement = this.measurements[this.measurements.length - 1];
        return Math.min(99.9, (lastMeasurement.processed / this.fileSize) * 100);
    }
    
    // עדכון ממשק משתמש
    updateUI() {
        if (this.isCompleted) return;
        
        const elapsed = Date.now() - this.startTime;
        const progress = this.calculateProgress();
        
        // עדכון בר התקדמות
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            progressFill.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
        }
        
        // עדכון טקסט סטטוס
        const elapsedStr = this.formatTime(elapsed);
        const statusText = `מעבד... | ${progress.toFixed(1)}% | זמן שעבר: ${elapsedStr}`;
        this.updateStatusText(statusText, 'processing');
    }
    
    // הצגת סטטוס סופי
    showFinalStatus(success, totalTime) {
        const timeStr = this.formatTime(totalTime);
        
        if (success) {
            const message = `התמלול הושלם בהצלחה! ⏱️ זמן כולל: ${timeStr}`;
            this.updateStatusText(message, 'success');
            if (window.showStatus) window.showStatus(message, 'success');
        } else {
            const message = `התמלול נכשל אחרי ${timeStr}`;
            this.updateStatusText(message, 'error');
            if (window.showStatus) window.showStatus(message, 'error');
        }
        
        // איפוס בר התקדמות
        setTimeout(() => {
            const progressFill = document.getElementById('progressFill');
            if (progressFill) {
                progressFill.style.width = '100%';
                setTimeout(() => {
                    progressFill.style.width = '0%';
                }, 500);
            }
        }, 2000);
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
