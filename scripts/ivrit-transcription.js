// /scripts/ivrit-transcription.js
// תמלול ivrit.ai עם תמיכה מלאה בקבצים גדולים דרך R2
// ✅ קבצים קטנים (<9MB) - base64 רגיל
// ✅ קבצים גדולים (>9MB) - העלאה ל-R2 ושימוש ב-URL
// ✅ שמירת שם מקורי של הקובץ
// ✅ העלאת התמלול ל-R2 באותו שם

async function performIvritTranscription(file, runpodApiKey, endpointId, workerUrl) {
  if (!runpodApiKey || !endpointId || !workerUrl) {
    throw new Error('חסרים פרטי חיבור (RunPod API Key / Endpoint ID / Worker URL)');
  }
  if (!file) throw new Error('לא נבחר קובץ אודיו');

  const safeName = (file.name || 'audio').replace(/[^\w.\-]+/g, '_');
  
  // בחירה אוטומטית: גדול מ-9MB → העלאה ל-R2
  const isLargeFile = file.size > 9 * 1024 * 1024;
  
  let transcribeArgs;
  let audioFileKey = null; // לשמירת המפתח של הקובץ באחסון
  
  if (isLargeFile) {
    // ========== קובץ גדול - העלאה ל-R2 ==========
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    showStatus(`מעלה קובץ גדול (${sizeMB}MB) לאחסון...`, 'processing');
    
    try {
      // שימוש בשם המקורי של הקובץ עם timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const originalName = safeName.replace(/\.[^/.]+$/, ""); // הסרת סיומת
      const extension = safeName.split('.').pop();
      const fullFileName = `${timestamp}_${originalName}.${extension}`;
      
      // שליחת הקובץ הבינארי ישירות ל-Worker
      const uploadUrl = workerUrl.endsWith('/') 
        ? `${workerUrl}upload?name=${encodeURIComponent(fullFileName)}`
        : `${workerUrl}/upload?name=${encodeURIComponent(fullFileName)}`;

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
      
      // שמירת המפתח לשימוש בהעלאת התמלול
      audioFileKey = uploadData.key || fullFileName;
      
      console.log('קובץ הועלה בהצלחה:', uploadData.url);
      console.log('מפתח הקובץ:', audioFileKey);
      
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
    
    // יצירת שם עם timestamp גם לקובץ קטן (לשימוש בהעלאת התמלול)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const originalName = safeName.replace(/\.[^/.]+$/, "");
    const extension = safeName.split('.').pop();
    audioFileKey = `${timestamp}_${originalName}.${extension}`;
    
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
      if (window.progressTracker) window.progressTracker.stop(false);
      throw new Error('השרת לא החזיר תוצאה וגם לא מזהה משימה (jobId)');
    }

    // התחלת מעקב התקדמות
    if (window.progressTracker) {
      window.progressTracker.start(file.size);
    }

    showStatus('התמלול התחיל, מעקב אחר התקדמות...', 'processing');
    
    let lastProgress = 0;
    let pollCount = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    // Polling loop - ללא הגבלת זמן!
    while (true) {
      await delay(2000);
      pollCount++;

      try {
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
          consecutiveErrors++;
          const errText = await pollRes.text().catch(() => '');
          console.warn(`Polling error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}: ${pollRes.status}`);
          
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            if (window.progressTracker) window.progressTracker.stop(false);
            throw new Error(`Polling נכשל ${MAX_CONSECUTIVE_ERRORS} פעמים ברצף: ${pollRes.status} – ${errText}`);
          }
          continue; // ננסה שוב
        }

        // איפוס מונה שגיאות אם הצלחנו
        consecutiveErrors = 0;

        const pollData = await safeJson(pollRes);
        
        // בדיקת התקדמות מהשרת
        const serverProgress = extractProgress(pollData);
        if (serverProgress !== null && serverProgress !== lastProgress) {
          lastProgress = serverProgress;
          
          // חישוב בייטים מעובדים
          const processedBytes = (file.size * serverProgress) / 100;
          
          // עדכון מעקב התקדמות
          if (window.progressTracker) {
            window.progressTracker.addMeasurement(processedBytes);
          }
        } else if (pollCount % 5 === 0) {
          // מדידה מדומה כל 10 שניות אם אין התקדמות מהשרת
          // אבל לא נעבור 95% כדי לא להטעות
          const estimatedProgress = Math.min(95, lastProgress + 1);
          const processedBytes = (file.size * estimatedProgress) / 100;
          
          if (window.progressTracker) {
            window.progressTracker.addMeasurement(processedBytes);
          }
        }
        
        // בדיקת תמלול
        transcript = extractTranscript(pollData);
        if (transcript) {
          console.log('Transcript received successfully');
          break;
        }

        // בדיקת סטטוס
        const status =
          pollData?.status || pollData?.state ||
          pollData?.data?.status || pollData?.data?.state;

        if (status) {
          console.log(`Job status: ${status}`);
          
          // בדיקת כשלון
          if (/failed|error|cancelled|terminated/i.test(String(status))) {
            const reason = pollData?.error || pollData?.data?.error ||
                          pollData?.output?.error || pollData?.result?.error;
            console.error('Job failed:', pollData);
            if (window.progressTracker) window.progressTracker.stop(false);
            throw new Error(`המשימה נכשלה בצד הספק (status=${status})${reason ? ` – ${reason}` : ''}`);
          }

          // בדיקת סיום
          if (/completed|succeeded|success|done|finished/i.test(String(status))) {
            transcript = extractTranscript(pollData);
            if (transcript) {
              console.log('Job completed with transcript');
              break;
            }
            console.warn('Job completed but no transcript found:', pollData);
            // ננסה עוד כמה פעמים למקרה שהתמלול בדרך
            if (pollCount > 5) {
              if (window.progressTracker) window.progressTracker.stop(false);
              throw new Error('סיום דווח אך אין תמלול בתשובה');
            }
          }
        }
        
        // בדיקה אם המשתמש ביטל
        if (window.progressTracker && window.progressTracker.isCompleted) {
          console.log('User cancelled transcription');
          throw new Error('התמלול בוטל על ידי המשתמש');
        }
        
      } catch (error) {
        // אם זו לא שגיאת רשת, נזרוק אותה
        if (!error.message.includes('fetch')) {
          throw error;
        }
        
        // שגיאת רשת - ננסה שוב
        consecutiveErrors++;
        console.warn(`Network error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}:`, error.message);
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          if (window.progressTracker) window.progressTracker.stop(false);
          throw new Error(`שגיאת רשת - נכשל ${MAX_CONSECUTIVE_ERRORS} פעמים ברצף`);
        }
      }
    }

    if (!transcript) {
      if (window.progressTracker) window.progressTracker.stop(false);
      throw new Error('לא התקבל תמלול מהשרת');
    }
  }

  // ========== הצגת תוצאות והעלאת תמלול ל-R2 ==========
  transcriptResult = {
    text: transcript.text,
    segments: Array.isArray(transcript.segments) && transcript.segments.length
      ? transcript.segments
      : [{ start: 0, end: 0, text: transcript.text }]
  };

  // העלאת התמלול ל-R2 (אופציונלי)
  if (audioFileKey && workerUrl) {
    try {
      // יצירת שם קובץ לתמלול - אותו שם כמו האודיו אבל עם סיומת .txt
      const transcriptFileName = audioFileKey.replace(/\.[^/.]+$/, "") + "_transcript.txt";
      
      // העלאת התמלול כקובץ טקסט
      const uploadTranscriptUrl = workerUrl.endsWith('/') 
        ? `${workerUrl}upload?name=${encodeURIComponent(transcriptFileName)}`
        : `${workerUrl}/upload?name=${encodeURIComponent(transcriptFileName)}`;
      
      const transcriptBlob = new Blob([transcript.text], { type: 'text/plain;charset=utf-8' });
      
      const uploadTranscriptRes = await fetch(uploadTranscriptUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'x-runpod-api-key': runpodApiKey,
          'x-runpod-endpoint-id': endpointId
        },
        body: transcriptBlob
      });
      
      if (uploadTranscriptRes.ok) {
        const transcriptData = await uploadTranscriptRes.json();
        console.log('תמלול הועלה בהצלחה:', transcriptData.url);
        
        // אפשר להציג למשתמש הודעה או לשמור את הקישור
        if (transcriptData.url) {
          // שמירת URL התמלול למקרה הצורך
          window.lastTranscriptUrl = transcriptData.url;
        }
      }
    } catch (error) {
      console.warn('לא ניתן להעלות תמלול ל-R2:', error);
      // לא עוצרים את התהליך אם העלאת התמלול נכשלה
    }
  }

  if (typeof progressTimer !== 'undefined') {
    clearInterval(progressTimer);
  }

  finalizeProgress();
  displayResults();
  showStatus('התמלול הושלם בהצלחה ✔️', 'success');
}

// פונקציה חדשה לחילוץ אחוז התקדמות מתשובת השרת
function extractProgress(obj) {
  if (!obj || typeof obj !== 'object') return null;
  
  // חיפוש בכל המיקומים האפשריים
  const possibleFields = [
    obj.progress,
    obj.percent,
    obj.percentage,
    obj.completion,
    obj.data?.progress,
    obj.data?.percent,
    obj.output?.progress,
    obj.status?.progress,
    obj.result?.progress
  ];
  
  for (const field of possibleFields) {
    if (typeof field === 'number' && field >= 0 && field <= 100) {
      return field;
    }
    // אם זה string שמייצג מספר
    if (typeof field === 'string') {
      const num = parseFloat(field);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        return num;
      }
    }
  }
  
  return null;
}

// ===== פונקציות עזר (ללא שינוי) =====

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
