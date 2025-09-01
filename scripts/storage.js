// ניהול זיכרון מקומי (localStorage)
const storage = {
    // שמירת מפתח API
    saveApiKey(key) {
        if (key?.trim()) {
            try {
                localStorage.setItem('hebrew_transcription_api_key', key.trim());
            } catch (error) {
                console.warn('Could not save API key:', error);
            }
        }
    },

    // טעינת מפתח API
    loadApiKey() {
        try {
            const saved = localStorage.getItem('hebrew_transcription_api_key');
            if (saved?.trim()) {
                const apiKeyInput = document.getElementById('apiKey');
                if (apiKeyInput) {
                    apiKeyInput.value = saved.trim();
                }
                return true;
            }
        } catch (error) {
            console.warn('Could not load API key:', error);
        }
        return false;
    },

    // מחיקת מפתח API
    clearApiKey() {
        try {
            localStorage.removeItem('hebrew_transcription_api_key');
        } catch (error) {
            console.warn('Could not clear API key:', error);
        }
    },

    // שמירת הגדרות משתמש (אופציונלי להרחבה עתידית)
    saveSettings(settings) {
        try {
            localStorage.setItem('hebrew_transcription_settings', JSON.stringify(settings));
        } catch (error) {
            console.warn('Could not save settings:', error);
        }
    },

    // טעינת הגדרות משתמש
    loadSettings() {
        try {
            const saved = localStorage.getItem('hebrew_transcription_settings');
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.warn('Could not load settings:', error);
            return {};
        }
    }
};
