
// /scripts/ivrit-transcription.js
// תמלול ivrit.ai עם תמיכה מלאה בקבצים גדולים דרך R2
// ✅ קבצים קטנים (<9MB) - base64 רגיל
// ✅ קבצים גדולים (>9MB) - העלאה ל-R2 ושימוש ב-URL

// משתנה גלובלי לשמירת הטיימר
let globalProgressTimer = null;
let transcriptionStartTime = null;

// הגדרת הפונקציה הראשית
window.performIvritTranscription = async function(file, runpodApiKey, endpointId, workerUrl) {
  if (!runpodApiKey || !endpointId || !workerUrl) {
    throw new Error('חסרים פרטי חיבור (RunPod API Key / Endpoint ID / Worker URL)');
  }
  if (!file) throw new Error('לא נבחר קובץ אודיו');

  const safeName = (file.name || 'audio').replace(/[^\w.\-]+/g, '_');
  
  // שמירת גודל הקובץ לחישוב התקדמות
  const fileSizeMB = file.size / (1024 * 1024);
  
  // בחירה אוטומטית: גדול מ-9MB → העלאה ל-R2
  const isLargeFile = file.size > 9 * 1024 * 1024;
  
  let transcribeArgs;
  
  if (isLargeFile) {
    // ========== קובץ גדול - העלאה ל-R2 ==========
    const sizeMB = fileSizeMB.toFixed(1);
    showStatus(`מעלה קובץ גדול (${sizeMB}MB) לאחסון...`, 'processing');
    
    try {
      // שליחת הקובץ הבינארי ישירות ל-Worker
      // וודא שאין סלאש כפול
      const uploadUrl = workerUrl.endsWith('/') 
        ? `${workerUrl}upload?name=${encodeURIComponent(safeName)}`
        : `${workerUrl}/upload?name=${encodeURIComponent(safeName)}`;

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'audio/wav',
          'x-runpod-api-key': runpodApiKey,      
          'x-runpod-endpoint-id': endpointId    
        },
        body: file  // שליחת הקובץ עצמו, לא base64!
      });
      
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text().catch(() => '');
        throw new Error(`העלאה נכשלה: ${uploadRes.status} - ${errorText}`);
      }
      
      const uploadData = await uploadRes.json();
      
      if (!uploadData.url) {
        throw new Error('העלאה נכשלה - לא התקבל URL תקין');
      }
      
      console.log('קובץ הועלה בהצלחה:', uploadData.url);
      
      // שימוש ב-URL במקום base64
      transcribeArgs = {
        url: uploadData.url,  // זה השינוי העיקרי!
        filename: safeName,
        mime_type: file.type || 'audio/wav',
        language: 'he',
        punctuate: true,
        diarize: false
      };
      
      showStatus('קובץ הועלה בהצלחה, מתחיל תמלול...', 'processing');
      
    } catch (error) {
      console.error('שגיאה בהעלאה:', error);
      throw new Error(`שגיאה בהעלאת הקובץ: ${error.message}`);
    }
    
  } else {
    // ========== קובץ קטן - base64 כרגיל ==========
    showStatus('ממיר אודיו ל-Base64…', 'processing');
    
    const dataUrl = await fileToDataUrl(file);
    const base64 = stripDataUrlPrefix(dataUrl);
    
    if (!base64 || base64.length < 100) {
      throw new Error('האודיו לא זוהה/ריק (base64 קצר מדי)');
    }
    
    transcribeArgs = {
      blob: base64,  // קבצים קטנים - base64 כרגיל
      filename: safeName,
      mime_type: file.type || 'audio/wav',
      language: 'he',
      punctuate: true,
      diarize: false
    };
  }

  // ========== שליחה ל-ivrit.ai (דרך Worker) ==========
  showStatus('שולח את המשימה ל-ivrit.ai…', 'processing');
  // התקדמות מהירה יותר להעלאה
  simulateProgress(5, 30, 10_000);

  const startRes = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runpod-api-key': runpodApiKey,
      'x-runpod-endpoint-id': endpointId
    },
    body: JSON.stringify({ transcribe_args: transcribeArgs })
  });

  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => '');
    throw new Error(`שגיאה ב-Worker: ${startRes.status} – ${errText}`);
  }

  const startData = await safeJson(startRes);
  let transcript = extractTranscript(startData);

  // ========== Polling (אם צריך) ==========
  if (!transcript) {
    const jobId =
      startData?.id || startData?.jobId ||
      startData?.data?.id || startData?.data?.jobId;

    if (!jobId) {
      console.debug('Start response (no transcript, no jobId):', startData);
      throw new Error('השרת לא החזיר תוצאה וגם לא מזהה משימה (jobId)');
    }

    // התחלת טיימר עם ספירה לאחור חכמה
    transcriptionStartTime = Date.now();
    let currentProgress = 30;
    let processedMB = 0;
    let lastProgressUpdate = Date.now();
    let estimatedTotalTime = 1200_000; // התחלה עם 20 דקות כברירת מחדל
    
    // ניקוי טיימר קודם אם קיים
    if (globalProgressTimer) {
      clearInterval(globalProgressTimer);
      globalProgressTimer = null;
    }

    // עדכון הבר עם טיימר חכם
    globalProgressTimer = setInterval(() => {
      const elapsed = Date.now() - transcriptionStartTime;
      
      // חישוב קצב התקדמות דינמי
      if (elapsed > 10000 && currentProgress > 30) { // אחרי 10 שניות לפחות
        // חישוב כמה MB עובדו עד כה (הערכה לפי אחוז התקדמות)
        processedMB = (currentProgress - 30) / 68 * fileSizeMB;
        
        if (processedMB > 0) {
          // חישוב קצב עיבוד (MB לשנייה)
          const processingRate = processedMB / (elapsed / 1000);
          
          // חישוב זמן משוער לסיום על סמך הקצב הנוכחי
          const remainingMB = fileSizeMB - processedMB;
          const estimatedRemainingTime = (remainingMB / processingRate) * 1000;
          
          // עדכון הזמן המשוער הכולל
          estimatedTotalTime = elapsed + estimatedRemainingTime;
        }
      }
      
      // חישוב התקדמות לפי זמן שעבר ביחס לזמן המשוער
      if (estimatedTotalTime > 0) {
        currentProgress = Math.min(98, 30 + (elapsed / estimatedTotalTime) * 68);
      }
      
      // עדכון הבר
      const progressFill = document.getElementById('progressFill');
      if (progressFill) {
        progressFill.style.width = `${currentProgress.toFixed(1)}%`;
      }
      
      // חישוב זמנים לתצוגה
      const elapsedMin = Math.floor(elapsed / 60000);
      const elapsedSec = Math.floor((elapsed % 60000) / 1000);
      
      const remaining = Math.max(0, estimatedTotalTime - elapsed);
      const remainingMin = Math.floor(remaining / 60000);
      const remainingSec = Math.floor((remaining % 60000) / 1000);
      
      // חישוב קצב עיבוד לתצוגה
      let rateInfo = '';
      if (processedMB > 0 && elapsed > 10000) {
        const rate = (processedMB / (elapsed / 1000)).toFixed(2);
        rateInfo = ` | קצב: ${rate} MB/s`;
      }
      
      showStatus(
        `מעבד... | זמן שעבר: ${elapsedMin}:${elapsedSec.toString().padStart(2, '0')} | נותר (משוער): ${remainingMin}:${remainingSec.toString().padStart(2, '0')}${rateInfo}`, 
        'processing'
      );
      
      // עדכון אחוז התקדמות בהתאם לזמן שעבר
      lastProgressUpdate = Date.now();
      
    }, 1000);

    // Polling ללא הגבלת זמן קשיחה - ממשיך לפי הזמן המשוער
    while (true) {
      await delay(2000);

      // Polling עם GET
      const pollRes = await fetch(workerUrl, {
        method: 'GET',
        headers: {
          'x-runpod-api-key': runpodApiKey,
          'x-runpod-endpoint-id': endpointId,
          'x-job-id': String(jobId),
        }
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text().catch(() => '');
        // עצירת הטיימר במקרה של שגיאה
        if (globalProgressTimer) {
          clearInterval(globalProgressTimer);
          globalProgressTimer = null;
        }
        throw new Error(`Polling נכשל: ${pollRes.status} – ${errText}`);
      }

      const pollData = await safeJson(pollRes);
      transcript = extractTranscript(pollData);

      const status =
        pollData?.status || pollData?.state ||
        pollData?.data?.status || pollData?.data?.state;

      if (transcript) break;

      if (status && /failed|error/i.test(String(status))) {
        const reason = pollData?.error || pollData?.data?.error ||
                       pollData?.output?.error || pollData?.result?.error;
        console.debug('Polling failed payload:', pollData);
        // עצירת הטיימר במקרה של כישלון
        if (globalProgressTimer) {
          clearInterval(globalProgressTimer);
          globalProgressTimer = null;
        }
        throw new Error(`המשימה נכשלה בצד הספק (status=${status})${reason ? ` – ${reason}` : ''}`);
      }

      if (status && /completed|succeeded|success|done/i.test(String(status))) {
        transcript = extractTranscript(pollData);
        if (transcript) break;
        console.debug('Completed but no transcript field:', pollData);
        // עצירת הטיימר אם הושלם אבל אין תמלול
        if (globalProgressTimer) {
          clearInterval(globalProgressTimer);
          globalProgressTimer = null;
        }
        throw new Error('סיום דווח אך אין תמלול בתשובה');
      }
      
      // בדיקה אם עבר זמן ארוך מדי (למשל 60 דקות)
      const elapsed = Date.now() - transcriptionStartTime;
      if (elapsed > 3600_000) { // שעה
        if (globalProgressTimer) {
          clearInterval(globalProgressTimer);
          globalProgressTimer = null;
        }
        throw new Error('התמלול לוקח יותר מדי זמן (מעל שעה)');
      }
    }
  }

  // ========== הצגת תוצאות ==========
  // עצירת הטיימר והצגת זמן סופי
  const finalTime = Date.now() - (transcriptionStartTime || Date.now());
  const finalMinutes = Math.floor(finalTime / 60000);
  const finalSeconds = Math.floor((finalTime % 60000) / 1000);
  
  if (globalProgressTimer) {
    clearInterval(globalProgressTimer);
    globalProgressTimer = null;
  }
  
  transcriptResult = {
    text: transcript.text,
    segments: Array.isArray(transcript.segments) && transcript.segments.length
      ? transcript.segments
      : [{ start: 0, end: 0, text: transcript.text }]
  };

  finalizeProgress();
  displayResults();
  
  // הצגת הודעת סיום עם הזמן הסופי
  const sizeMB = fileSizeMB.toFixed(1);
  const rate = finalTime > 0 ? (fileSizeMB / (finalTime / 1000)).toFixed(2) : 0;
  showStatus(
    `התמלול הושלם בהצלחה ✔️ | זמן כולל: ${finalMinutes}:${finalSeconds.toString().padStart(2, '0')} | גודל: ${sizeMB}MB | קצב ממוצע: ${rate} MB/s`, 
    'success'
  );
}

// ===== פונקציות עזר =====

function stripDataUrlPrefix(dataUrl) {
  if (typeof dataUrl !== 'string') return '';
  const idx = dataUrl.indexOf('base64,');
  return idx >= 0 ? dataUrl.slice(idx + 7) : dataUrl;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('שגיאה בהמרת האודיו ל-Base64'));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

function delay(ms) { 
  return new Promise(res => setTimeout(res, ms)); 
}

async function safeJson(res) {
  try { 
    return await res.json(); 
  } catch { 
    const t = await res.text().catch(() => ''); 
    console.debug('Non-JSON:', t); 
    throw new Error('תשובת השרת אינה JSON תקין'); 
  }
}

function extractTranscript(obj) {
  if (!obj || typeof obj !== 'object') return null;
  
  // טיפול במבנה של ivrit.ai: output[0].result[array of segments]
  if (Array.isArray(obj.output) && obj.output[0]?.result && Array.isArray(obj.output[0].result)) {
    const segments = obj.output[0].result;
    const fullText = segments.map(seg => seg.text?.trim()).filter(Boolean).join(' ');
    if (fullText) {
      return {
        text: fullText,
        segments: segments.map(seg => ({
          start: seg.start || 0,
          end: seg.end || 0,
          text: seg.text?.trim() || ''
        }))
      };
    }
  }
  
  // טיפול רגיל למבנים אחרים
  const core = obj.output || obj.result || obj.data || obj;
  if (typeof core === 'string') return { text: core };
  const text = core?.text ?? core?.transcription ?? core?.transcript ?? core?.output || core?.result;
  if (typeof text === 'string' && text.trim()) return { text: text.trim(), segments: core?.segments };
  const nested = core?.text?.content || core?.transcription?.content;
  if (typeof nested === 'string' && nested.trim()) return { text: nested.trim(), segments: core?.segments };
  return null;
}

// ===== הגדרה גלובלית של הפונקציות =====
// זה מוודא שהפונקציות זמינות מכל מקום בקוד
if (typeof window !== 'undefined') {
  window.performIvritTranscription = performIvritTranscription;
  window.stripDataUrlPrefix = stripDataUrlPrefix;
  window.fileToDataUrl = fileToDataUrl;
  window.safeJson = safeJson;
  window.extractTranscript = extractTranscript;
}
