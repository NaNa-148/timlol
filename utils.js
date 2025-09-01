// --- LOCAL STORAGE ---
export const storage = {
    save(key, value) {
        try {
            if (value) localStorage.setItem(key, value.trim());
        } catch (e) {
            console.warn(`Could not save ${key}`, e);
        }
    },
    load(key) {
        try {
            return localStorage.getItem(key) || '';
        } catch (e) {
            console.warn(`Could not load ${key}`, e);
            return '';
        }
    }
};

// --- HELPERS ---
export const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

export const formatVttTime = (seconds) => new Date(seconds * 1000).toISOString().substr(11, 12);

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
