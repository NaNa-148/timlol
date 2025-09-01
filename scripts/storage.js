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
// שמירת נתוני ivrit.ai
    saveIvritAiCredentials(runpodApiKey, endpointId, workerUrl) {
        try {
            const credentials = { runpodApiKey, endpointId, workerUrl };
            localStorage.setItem('hebrew_transcription_ivrit_credentials', JSON.stringify(credentials));
        } catch (error) {
            console.warn('Could not save ivrit.ai credentials:', error);
        }
    },

    // טעינת נתוני ivrit.ai
    loadIvritAiCredentials() {
        try {
            const saved = localStorage.getItem('hebrew_transcription_ivrit_credentials');
            if (saved) {
                const credentials = JSON.parse(saved);
                const runpodApiKeyInput = document.getElementById('runpodApiKey');
                const endpointIdInput = document.getElementById('endpointId');
                const workerUrlInput = document.getElementById('workerUrl');
                
                if (runpodApiKeyInput) runpodApiKeyInput.value = credentials.runpodApiKey || '';
                if (endpointIdInput) endpointIdInput.value = credentials.endpointId || '';
                if (workerUrlInput) workerUrlInput.value = credentials.workerUrl || '';
                
                return true;
            }
        } catch (error) {
            console.warn('Could not load ivrit.ai credentials:', error);
        }
        return false;
    }
