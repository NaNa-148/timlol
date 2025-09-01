# 📂 מבנה פרויקט תמלול עברית AI

## 🎯 מטרת המסמך
מסמך זה מפרט את המבנה המלא של אפליקציית תמלול עברית AI, כולל תיאור מפורט של כל קובץ, הפונקציות שבו, והקשרים בין הרכיבים השונים. האפליקציה תומכת כעת בשני שירותי תמלול: OpenAI Whisper ו-ivrit.ai.

## 📁 מבנה התיקיות
```
hebrew-transcription-ai/
├── index.html                    # הקובץ הראשי
├── PROJECT_STRUCTURE.md          # המסמך הזה
├── LICENSE                       # רישיון Apache 2.0
├── README.md                     # הוראות הפעלה
├── styles/
│   └── main.css                  # עיצוב ראשי
└── scripts/
    ├── storage.js                # ניהול זיכרון מקומי
    ├── audio-processor.js        # עיבוד אודיו מתקדם
    ├── waveform.js              # ויזואליזציה של גלי אודיו
    ├── ui-helpers.js            # פונקציות עזר לממשק
    ├── file-handler.js          # טיפול בקבצי אודיו
    ├── transcription.js         # תמלול OpenAI + בחירת שירות
    ├── ivrit-transcription.js   # תמלול ivrit.ai
    ├── text-improvement.js      # שיפור טקסט AI
    ├── export-download.js       # ייצוא והורדה
    ├── event-listeners.js       # מאזינים לאירועים
    └── main.js                  # אתחול ראשי
```

---

## 📄 פירוט קבצי הפרויקט

### 1. **index.html** - הקובץ הראשי
**📍 מיקום:** `/index.html`  
**🎯 תפקיד:** נקודת הכניסה לאפליקציה  
**📋 מכיל:**
- מבנה HTML של כל הדף
- אלמנטי ממשק המשתמש (טפסים, כפתורים, אזורי תוצאות)
- בחירת שירות תמלול (OpenAI / ivrit.ai)
- טעינת קבצי CSS ו-JavaScript
- אלמנטי נגישות ו-SEO בעברית

**🔧 אלמנטים עיקריים:**
- `#transcriptionService` - בחירת שירות תמלול
- `#openAiGroup` - אזור הגדרות OpenAI
- `#ivritAiGroup` - אזור הגדרות ivrit.ai
- `#apiKey` - מפתח OpenAI API
- `#runpodApiKey` - מפתח RunPod API
- `#endpointId` - Endpoint ID של ivrit.ai
- `#workerUrl` - כתובת Cloudflare Worker
- `#languageSelect` - בחירת שפה (רק לOpenAI)
- `#uploadArea` - אזור העלאת קבצים
- `#audioPlayer` - נגן אודיו
- `#waveformCanvas` - Canvas לצורת גל
- `#transcribeButton` - כפתור תמלול
- `#resultArea` - אזור תוצאות

---

### 2. **styles/main.css** - עיצוב ראשי
**📍 מיקום:** `/styles/main.css`  
**🎯 תפקיד:** עיצוב מלא של האפליקציה  
**📋 מכיל:**
- גרדיאנטים וצבעים
- אנימציות ומעברים
- עיצוב רספונסיבי
- סגנונות כפתורים ופקדים
- עיצוב אזורי הגדרות שירותי התמלול

**🎨 קטגוריות עיצוב:**
```css
/* עיצוב בסיסי */
body, .container, .header

/* אזור העלאת קבצים */
.upload-area, .file-info, .audio-preview

/* פקדים */
.toggle, .slider, .button

/* תוצאות */
.result-area, .transcript-text

/* אנימציות */
.loading-spinner, .progress-bar

/* רספונסיבי */
@media (max-width: 768px)
```

---

### 3. **scripts/storage.js** - ניהול זיכרון מקומי
**📍 מיקום:** `/scripts/storage.js`  
**🎯 תפקיד:** שמירה וטעינה של נתונים מ-localStorage  
**📋 אובייקט ראשי:** `storage`

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `saveApiKey(key)` | שמירת מפתח OpenAI API | string | void |
| `loadApiKey()` | טעינת מפתח OpenAI API | none | boolean |
| `clearApiKey()` | מחיקת מפתח OpenAI API | none | void |
| `saveIvritAiCredentials(runpodApiKey, endpointId, workerUrl)` | שמירת נתוני ivrit.ai | string, string, string | void |
| `loadIvritAiCredentials()` | טעינת נתוני ivrit.ai | none | boolean |
| `saveSettings(settings)` | שמירת הגדרות כלליות | object | void |
| `loadSettings()` | טעינת הגדרות כלליות | none | object |

**📊 נתונים נשמרים:**
- `hebrew_transcription_api_key` - מפתח OpenAI
- `hebrew_transcription_ivrit_credentials` - נתוני חיבור לivrit.ai
- `hebrew_transcription_settings` - הגדרות משתמש כלליות

---

### 4. **scripts/audio-processor.js** - עיבוד אודיו מתקדם
**📍 מיקום:** `/scripts/audio-processor.js`  
**🎯 תפקיד:** עיבוד ושיפור איכות אודיו  
**📋 משתנה גלובלי:** `audioContext`

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `initAudioContext()` | אתחול קונטקסט אודיו | none | void |
| `processAudio(file)` | עיבוד מלא של אודיו | File | Blob |
| `bufferToWaveFile(audioBuffer, targetBitRate)` | המרה ל-WAV | AudioBuffer, number | Blob |

**⚙️ יכולות עיבוד:**
- הפחתת רעש (High-pass filter)
- נרמול קול (Dynamic compression)
- התאמת עוצמה (Gain control)
- דחיסה והמרת פורמט

---

### 5. **scripts/waveform.js** - ויזואליזציה של גלי אודיו
**📍 מיקום:** `/scripts/waveform.js`  
**🎯 תפקיד:** ציור צורות גל על Canvas  

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `drawWaveform(file)` | ציור צורת גל עיקרי | File | void |
| `drawSimpleWaveform(ctx, canvas)` | ציור פשוט (fallback) | Context, Canvas | void |
| `drawAudioWaveform(ctx, canvas, audioBuffer)` | ציור מדויק | Context, Canvas, AudioBuffer | void |
| `clearWaveform()` | ניקוי Canvas | none | void |

**🎨 סוגי ציור:**
- ציור בזמן אמת מ-AudioBuffer
- ציור פשוט עם אפקט אקראי
- ניקוי והחלפת צורות גל

---

### 6. **scripts/ui-helpers.js** - פונקציות עזר לממשק
**📍 מיקום:** `/scripts/ui-helpers.js`  
**🎯 תפקיד:** פונקציות עזר לממשק המשתמש  
**📋 משתנה גלובלי:** `progressInterval`

**🔧 פונקציות עיקריות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `checkButtonsState()` | בדיקת מצב כפתורים (תומך בשני השירותים) | none | void |
| `formatFileSize(bytes)` | פורמט גודל קובץ | number | string |
| `showStatus(message, type)` | הצגת הודעת סטטוס | string, string | void |
| `hideStatus()` | הסתרת הודעות | none | void |
| `setButtonState(button, text, state)` | שינוי מצב כפתור | Element, string, string | void |
| `simulateProgress(start, end, duration)` | סימולציה של התקדמות | number, number, number | void |
| `finalizeProgress()` | סיום התקדמות | none | void |
| `formatVttTime(seconds)` | פורמט זמן VTT | number | string |
| `setupToggles()` | הגדרת מתגים | none | void |
| `setupSliders()` | הגדרת סליידרים | none | void |

**📊 סוגי סטטוס:**
- `processing` - בעיבוד
- `success` - הושלם
- `error` - שגיאה

---

### 7. **scripts/file-handler.js** - טיפול בקבצי אודיו
**📍 מיקום:** `/scripts/file-handler.js`  
**🎯 תפקיד:** העלאה וניהול קבצי אודיו/וידאו  
**📋 משתנים גלובליים:** `selectedFile`, `processedFile`

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `handleFileSelect(file)` | טיפול בבחירת קובץ | File | void |
| `setupFileHandling()` | הגדרת מאזינים לקבצים | none | void |
| `validateAudioFile(file)` | בדיקת תקינות קובץ | File | boolean |
| `clearFiles()` | ניקוי קבצים | none | void |

**🎵 פורמטים נתמכים:**
- **אודיו:** MP3, WAV, M4A, FLAC, WEBM
- **וידאו:** MP4, WEBM (חילוץ אודיו)
- **מגבלות:** עד 25MB (OpenAI), עד 100MB (ivrit.ai)

---

### 8. **scripts/transcription.js** - תמלול OpenAI + בחירת שירות
**📍 מיקום:** `/scripts/transcription.js`  
**🎯 תפקיד:** תמלול אודיו וניהול שירותי התמלול  
**📋 משתנה גלובלי:** `transcriptResult`

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `selectTranscriptionService(file, apiKey)` | בחירת שירות התמלול וניתוב | File, string | void |
| `performTranscription(file, apiKey)` | ביצוע תמלול OpenAI | File, string | void |
| `displayResults()` | הצגת תוצאות תמלול | none | void |
| `generateVTTContent()` | יצירת תוכן VTT | none | string |

**🌐 שירותי תמלול:**
- **OpenAI Whisper:** 20+ שפות + זיהוי אוטומטי
- **ivrit.ai:** מומחה לעברית

**⚙️ אפשרויות תמלול:**
- חותמות זמן (timestamps)
- זיהוי דוברים (speakers)
- הצגה בפסקאות (paragraphs)

---

### 9. **scripts/ivrit-transcription.js** - תמלול ivrit.ai
**📍 מיקום:** `/scripts/ivrit-transcription.js`  
**🎯 תפקיד:** תמלול אודיו באמצעות ivrit.ai  

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `performIvritTranscription(file, runpodApiKey, endpointId, workerUrl)` | תמלול עם ivrit.ai | File, string, string, string | void |
| `checkIvritAiStatus(workerUrl)` | בדיקת זמינות שרת | string | boolean |

**🚀 דרישות ivrit.ai:**
- RunPod API Key
- Endpoint ID
- כתובת Cloudflare Worker
- תמיכה בקבצים עד 100MB

**🔄 זרימת עבודה:**
1. שליחה לשרת Cloudflare Worker
2. Worker מעביר ל-RunPod עם פרטי האימות
3. RunPod מעבד עם מודל ivrit.ai
4. התשובה חוזרת דרך Worker

---

### 10. **scripts/text-improvement.js** - שיפור טקסט באמצעות AI
**📍 מיקום:** `/scripts/text-improvement.js`  
**🎯 תפקיד:** שיפור וחידוד הטקסט המתומלל  
**📋 משתנה גלובלי:** `improvedResult`

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `improveText(text, apiKey)` | שיפור טקסט עם GPT | string, string | string |
| `displayImprovedText(improvedContent)` | הצגת טקסט משופר | string | void |
| `setupTextImprovement()` | הגדרת מאזיני שיפור | none | void |

**🤖 מודלים נתמכים:**
- GPT-4o (ברירת מחדל)
- GPT-3.5 Turbo

**✨ יכולות שיפור:**
- תיקון דקדוק וכתיב
- השלמת מילים חסרות
- שיפור פיסוק
- תיקון מילים שנשמעו לא נכון

---

### 11. **scripts/export-download.js** - ייצוא והורדת קבצים
**📍 מיקום:** `/scripts/export-download.js`  
**🎯 תפקיד:** הורדת תוצאות בפורמטים שונים  

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `downloadFile(content, filename, mimeType)` | הורדת קובץ כללי | string, string, string | void |
| `generateFilename(extension)` | יצירת שם קובץ עם זמן | string | string |
| `downloadAsTXT()` | הורדה כ-TXT | none | void |
| `downloadAsVTT()` | הורדה כ-VTT | none | void |
| `copyToClipboard()` | העתקה ללוח | none | void |
| `setupExportButtons()` | הגדרת כפתורי ייצוא | none | void |

**📁 פורמטי ייצוא:**
- **TXT:** טקסט רגיל עם UTF-8
- **VTT:** כתוביות עם חותמות זמן
- **Clipboard:** העתקה ללוח העריכה

---

### 12. **scripts/event-listeners.js** - מאזינים לאירועי דף
**📍 מיקום:** `/scripts/event-listeners.js`  
**🎯 תפקיד:** הגדרת כל המאזינים לאירועים  

**🔧 פונקציות:**
| פונקציה | תיאור | מאזין ל |
|---------|--------|---------|
| `setupEventListeners()` | הגדרת כל המאזינים | כל האירועים |
| `setupApiKeyListeners()` | מאזינים למפתחות API ושירותים | input, blur, change |
| `setupAudioProcessingListeners()` | מאזינים לעיבוד אודיו | click |
| `setupTranscriptionListeners()` | מאזינים לתמלול | click |
| `setupUIControls()` | מאזינים לפקדי ממשק | toggles, sliders |
| `setupResetButton()` | מאזין לאיפוס | click |

**⚡ סוגי אירועים:**
- `input` - הזנת טקסט
- `click` - לחיצות כפתורים
- `change` - שינוי בחירות (כולל שירות תמלול)
- `dragover/drop` - גרירה ושחרור קבצים
- `blur` - יציאה משדה

---

### 13. **scripts/main.js** - הקובץ הראשי לאתחול
**📍 מיקום:** `/scripts/main.js`  
**🎯 תפקיד:** אתחול ואיפוס המערכת  

**🔧 פונקציות:**
| פונקציה | תיאור | פרמטרים | החזרה |
|---------|--------|----------|--------|
| `resetSettingsToDefault()` | איפוס הגדרות לברירת מחדל | none | void |
| `resetApp()` | איפוס מלא של המערכת | none | void |
| `initApp()` | אתחול האפליקציה | none | void |

**🎛️ ברירות מחדל:**
- שירות תמלול: OpenAI Whisper
- שפה: עברית
- מסנן רעש: פעיל (30%)
- נרמול קול: פעיל (100%)
- חותמות זמן: כבוי
- זיהוי דוברים: כבוי
- פסקאות: כבוי

---

## 🔗 דיאגרמת קשרים

```mermaid
graph TD
    A[index.html] --> B[styles/main.css]
    A --> C[scripts/main.js]
    
    C --> D[scripts/storage.js]
    C --> E[scripts/event-listeners.js]
    
    E --> F[scripts/file-handler.js]
    E --> G[scripts/audio-processor.js]
    E --> H[scripts/transcription.js]
    E --> I[scripts/ivrit-transcription.js]
    E --> J[scripts/text-improvement.js]
    E --> K[scripts/export-download.js]
    
    F --> L[scripts/ui-helpers.js]
    F --> M[scripts/waveform.js]
    
    G --> M
    H --> L
    H --> I
    I --> L
    J --> L
    K --> L
    
    L --> D
    M --> G
```

---

## 🚀 איך להוסיף פונקציונליות חדשה?

### 📁 הוספת שירות תמלול חדש:
1. **יצירת קובץ חדש** ב-`scripts/` (לדוגמה: `google-transcription.js`)
2. **הוספת אופציה** ל-`#transcriptionService` ב-`index.html`
3. **הוספת שדות הגדרות** לשירות החדש (אם נדרש)
4. **עדכון** `selectTranscriptionService()` ב-`transcription.js`
5. **הוספת פונקציות שמירה/טעינה** ב-`storage.js`
6. **עדכון** `checkButtonsState()` ב-`ui-helpers.js`
7. **הוספת מאזינים** ב-`event-listeners.js`

### 🔧 הוספת פונקציה לקובץ קיים:
1. **בחירת הקובץ המתאים** לפי התמחות
2. **הוספת הפונקציה** עם תיעוד JSDoc
3. **עדכון event listener** אם נדרש
4. **עדכון המסמך הזה**

### 🎨 הוספת אלמנט UI חדש:
1. **הוספת HTML** ל-`index.html`
2. **הוספת CSS** ל-`styles/main.css`
3. **הוספת JavaScript** לקובץ המתאים
4. **הוספת event listener** ל-`event-listeners.js`

---

## 📍 מדריך מהיר - איפה למצוא מה?

| רוצה להוסיף... | לך ל... |
|----------------|---------|
| שירות תמלול חדש | צור קובץ JavaScript חדש + עדכן `transcription.js` |
| כפתור חדש | `index.html` + `styles/main.css` + `event-listeners.js` |
| פיצ'ר עיבוד אודיו | `audio-processor.js` |
| אפשרות ייצוא חדשה | `export-download.js` |
| הודעת שגיאה | `ui-helpers.js` - `showStatus()` |
| שמירת הגדרה | `storage.js` |
| ויזואליזציה חדשה | `waveform.js` |
| תיקון באג תמלול OpenAI | `transcription.js` |
| תיקון באג תמלול ivrit.ai | `ivrit-transcription.js` |
| שיפור עיצוב | `styles/main.css` |
| אתחול פונקציה חדשה | `main.js` - `initApp()` |

---

## 🛠️ טיפים לפיתוח

### ✅ מומלץ:
- שימוש בשמות פונקציות תיאוריים
- הוספת תיעוד לפונקציות חדשות
- שמירה על קוד נקי ומסודר
- בדיקת תאימות לעברית ו-RTL
- בדיקת עבודה עם שני שירותי התמלול

### ❌ לא מומלץ:
- ערבוב קוד בין קבצים שונים
- שימוש במשתנים גלובליים מיותרים
- שכתוב פונקציות קיימות ללא צורך
- הוספת dependencies חיצוניים
- חשיפת מפתחות API בקוד הלקוח

---

## 🔒 אבטחה ופרטיות

### OpenAI:
- מפתח API נשמר מקומית בלבד
- תקשורת מוצפנת עם HTTPS
- ללא שמירת קבצים בשרת OpenAI

### ivrit.ai:
- נתוני חיבור נשמרים מקומית בלבד
- שרת Cloudflare Worker כשכבת ביטחון
- מפתח RunPod לא נחשף לדפדפן המשתמש
- עיבוד אודיו בשרת פרטי (RunPod)

---

## 📝 היסטוריית שינויים

| תאריך | גרסה | שינויים |
|-------|------|---------|
| 2025-01-XX | 1.0 | יצירת מבנה הפרויקט המחולק |
| | | הוספת תיעוד מפורט |
| | | יצירת מדריך הוספת פונקציונליות |
| 2025-01-XX | 1.1 | הוספת תמיכה בivrit.ai |
| | | בחירה דינמית בין שירותי תמלול |
| | | שמירת נתוני חיבור לשירותים שונים |

---

**📞 יצירת קשר:** לשאלות ותמיכה טכנית
