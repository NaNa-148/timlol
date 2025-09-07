// scripts/progress-tracker.js
// מערכת מעקב התקדמות חכמה לתמלול - ללא הגבלת זמן קשיחה

class TranscriptionProgressTracker {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.startTime = null;
        this.fileSize = 0;
        this.measurements = [];
        this.timer = null;
        this.updateInterval = null;
        this.isCompleted = false;
        this.lastProgressTime = null;
        this.lastProgressValue = 0;
        
        // התראות שהוצגו
        this.warnings = {
            min15: false,
            min30: false,
            min45: false,
            hour: false,
            stuck: false
        };
        
        // הגדרות
        this.STUCK_TIMEOUT = 3 * 60 * 1000; // 3 דקות ללא התקדמות = תקוע
        this.UPDATE_FREQUENCY = 1000; // עדכון כל שנייה
        this.MOVING_AVG_SAMPLES = 5; // כמות דגימות לממוצע נע
    }
    
    // התחלת מעקב
    start(fileSize) {
        this.reset();
        this.startTime = Date.now();
        this.lastProgressTime = Date.now();
        this.fileSize = fileSize;
        this.isCompleted = false;
        
        // התחלת עדכון ממשק
        this.updateInterval = setInterval(() => {
            this.updateUI();
            this.checkIfStuck();
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
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        const totalTime = Date.now() - this.startTime;
        this.showFinalStatus(success, totalTime);
    }
    
    // הוספת מדידה
    addMeasurement(processedBytes) {
        if (!this.startTime || this.isCompleted) return;
        
        const now = Date.now();
        const elapsed = now - this.startTime;
        
        // בדיקה אם יש התקדמות
        if (processedBytes > this.lastProgressValue) {
            this.lastProgressTime = now;
            this.lastProgressValue = processedBytes;
            
            // איפוס התראת תקיעה אם היתה
            if (this.warnings.stuck) {
                this.warnings.stuck = false;
                this.hideStuckWarning();
            }
        }
        
        this.measurements.push({
            time: now,
            elapsed: elapsed,
            processed: processedBytes,
            speed: processedBytes / (elapsed / 1000) // bytes per second
        });
        
        // שמירת רק המדידות האחרונות
        if (this.measurements.length > this.MOVING_AVG_SAMPLES * 2) {
            this.measurements.shift();
        }
        
        // בדיקת התראות לפי זמן
        this.checkTimeWarnings(elapsed);
    }
    
    // בדיקה אם התהליך תקוע
    checkIfStuck() {
        if (!this.lastProgressTime || this.isCompleted) return;
        
        const timeSinceLastProgress = Date.now() - this.lastProgressTime;
        
        if (timeSinceLastProgress > this.STUCK_TIMEOUT && !this.warnings.stuck) {
            this.warnings.stuck = true;
            this.showStuckWarning();
        }
    }
    
    // התראה על תקיעה
    showStuckWarning() {
        const elapsed = Date.now() - this.startTime;
        const elapsedStr = this.formatTime(elapsed);
        
        this.showWarning(
            '⚠️ נראה שהתהליך תקוע',
            `אין התקדמות כבר 3 דקות. זמן כולל: ${elapsedStr}<br>
            האם לחכות עוד או לבטל?`,
            'stuck',
            true // כולל כפתורי פעולה
        );
    }
    
    // הסתרת התראת תקיעה
    hideStuckWarning() {
        const alertDiv = document.querySelector('.alert-stuck');
        if (alertDiv) {
            alertDiv.remove();
        }
    }
    
    // בדיקת התראות זמן
    checkTimeWarnings(elapsed) {
        const minutes = elapsed / 60000;
        
        // התראות במרווחי זמן - רק מידע, לא עוצרים
        if (!this.warnings.min15 && minutes >= 15) {
            this.warnings.min15 = true;
            this.showWarning('⏱️ 15 דקות', 
                'התמלול לוקח זמן רב. המערכת ממשיכה לעבוד...', 
                'info');
        }
        
        if (!this.warnings.min30 && minutes >= 30) {
            this.warnings.min30 = true;
            this.showWarning('⏱️ 30 דקות', 
                'התמלול ממשיך. קבצים גדולים יכולים לקחת זמן רב.', 
                'warning');
        }
        
        if (!this.warnings.min45 && minutes >= 45) {
            this.warnings.min45 = true;
            this.showWarning('⏱️ 45 דקות', 
                'זמן ארוך במיוחד. שקול לבדוק אם התהליך עדיין פעיל.', 
                'warning');
        }
        
        if (!this.warnings.hour && minutes >= 60) {
            this.warnings.hour = true;
            this.showWarning('⏱️ שעה שלמה!', 
                'התמלול לוקח זמן חריג. אפשר לבטל אם נראה תקוע.', 
                'critical');
        }
    }
    
    // חישוב מהירות ממוצעת
    calculateAverageSpeed() {
        if (this.measurements.length < 2) return 0;
        
        const recentMeasurements = this.measurements.slice(-this.MOVING_AVG_SAMPLES);
        const totalSpeed = recentMeasurements.reduce((sum, m) => sum + m.speed, 0);
        return totalSpeed / recentMeasurements.length;
    }
    
    // חישוב זמן משוער לסיום
    calculateETA() {
        if (this.measurements.length === 0) return null;
        
        const lastMeasurement = this.measurements[this.measurements.length - 1];
        const processedBytes = lastMeasurement.processed;
        const remainingBytes = this.fileSize - processedBytes;
        
        if (remainingBytes <= 0) return 0;
        
        const avgSpeed = this.calculateAverageSpeed();
        if (avgSpeed <= 0) return null;
        
        // זמן נותר במילישניות
        return (remainingBytes / avgSpeed) * 1000;
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
        const eta = this.calculateETA();
        
        // עדכון בר התקדמות
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            
            // שינוי צבע לפי זמן שעבר
            const minutes = elapsed / 60000;
            if (minutes > 45) {
                progressFill.style.background = 'linear-gradient(90deg, #dc3545, #c82333)';
            } else if (minutes > 30) {
                progressFill.style.background = 'linear-gradient(90deg, #fd7e14, #dc3545)';
            } else if (minutes > 15) {
                progressFill.style.background = 'linear-gradient(90deg, #ffc107, #fd7e14)';
            } else {
                progressFill.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
            }
        }
        
        // עדכון טקסט סטטוס
        let statusText = this.formatStatus(elapsed, eta, progress);
        this.updateStatusText(statusText, 'processing');
    }
    
    // פורמט טקסט סטטוס
    formatStatus(elapsed, eta, progress) {
        const elapsedStr = this.formatTime(elapsed);
        let status = `מעבד... | ${progress.toFixed(1)}% | זמן שעבר: ${elapsedStr}`;
        
        if (eta === null) {
            status += ' | מחשב זמן משוער...';
        } else if (eta === 0) {
            status += ' | כמעט מסתיים...';
        } else {
            const remainingStr = this.formatTime(eta);
            status += ` | נותר (משוער): ${remainingStr}`;
            
            // הוספת מהירות עיבוד
            const speed = this.calculateAverageSpeed();
            if (speed > 0) {
                const speedStr = this.formatFileSize(speed);
                status += ` | מהירות: ${speedStr}/s`;
            }
        }
        
        // הוספת אזהרה אם תקוע
        const timeSinceLastProgress = Date.now() - this.lastProgressTime;
        if (timeSinceLastProgress > this.STUCK_TIMEOUT / 2) {
            const stuckTime = this.formatTime(timeSinceLastProgress);
            status += ` | ⚠️ אין התקדמות כבר ${stuckTime}`;
        }
        
        return status;
    }
    
    // הצגת סטטוס סופי
    showFinalStatus(success, totalTime) {
        const timeStr = this.formatTime(totalTime);
        const avgSpeed = this.calculateAverageSpeed();
        const speedStr = this.formatFileSize(avgSpeed);
        
        if (success) {
            const message = `התמלול הושלם בהצלחה! ⏱️ זמן כולל: ${timeStr} | מהירות ממוצעת: ${speedStr}/s`;
            this.updateStatusText(message, 'success');
            if (window.showStatus) window.showStatus(message, 'success');
        } else {
            const message = `התמלול נכשל או בוטל אחרי ${timeStr}`;
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
    
    // הצגת התראה
    showWarning(title, message, level = 'warning', showActions = false) {
        // הסרת התראה קודמת מאותו סוג
        const existingAlert = document.querySelector(`.alert-${level}`);
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // הצגה בממשק
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${level}`;
        
        const bgColor = {
            info: '#17a2b8',
            warning: '#ffc107',
            critical: '#dc3545',
            stuck: '#6f42c1'
        }[level] || '#6c757d';
        
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            background: ${bgColor};
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 80%;
            text-align: center;
            animation: slideDown 0.3s ease;
            font-family: 'Segoe UI', 'Arial', sans-serif;
        `;
        
        let actionsHtml = '';
        if (showActions) {
            actionsHtml = `
                <div style="margin-top: 15px;">
                    <button onclick="window.progressTracker.continueWaiting()" style="margin: 0 5px; padding: 8px 20px; border: none; border-radius: 5px; background: white; color: ${bgColor}; cursor: pointer; font-weight: bold;">
                        המשך לחכות
                    </button>
                    <button onclick="window.cancelTranscription()" style="margin: 0 5px; padding: 8px 20px; border: none; border-radius: 5px; background: #dc3545; color: white; cursor: pointer; font-weight: bold;">
                        בטל תמלול
                    </button>
                </div>
            `;
        }
        
        alertDiv.innerHTML = `
            <strong style="font-size: 1.1em;">${title}</strong><br>
            <span style="font-size: 0.95em;">${message}</span>
            ${actionsHtml}
        `;
        
        document.body.appendChild(alertDiv);
        
        // הסרה אוטומטית אחרי זמן (אלא אם זו התראת תקיעה)
        if (level !== 'stuck') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 10000);
        }
        
        console.log(`[${level.toUpperCase()}] ${title}: ${message}`);
    }
    
    // המשך המתנה (איפוס טיימר תקיעה)
    continueWaiting() {
        this.lastProgressTime = Date.now();
        this.warnings.stuck = false;
        this.hideStuckWarning();
        console.log('User chose to continue waiting');
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

// פונקציה לביטול תמלול
window.cancelTranscription = function() {
    if (confirm('האם אתה בטוח שברצונך לבטל את התמלול?')) {
        if (window.progressTracker) {
            window.progressTracker.stop(false);
        }
        
        // TODO: הוסף כאן קוד לביטול הבקשה לשרת אם צריך
        
        // איפוס ממשק
        const transcribeButton = document.getElementById('transcribeButton');
        if (transcribeButton) transcribeButton.disabled = false;
        
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.display = 'none';
    }
};
