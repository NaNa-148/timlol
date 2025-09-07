// /scripts/ivrit-transcription.js
// תמלול ivrit.ai עם תמיכה מלאה בקבצים גדולים דרך R2
// ✅ קבצים קטנים (<9MB) - base64 רגיל
// ✅ קבצים גדולים (>9MB) - העלאה ל-R2 ושימוש ב-URL
// ✅ תיקון: החלפת רווחים ותווים בעייתיים בשמות קבצים

async function performIvritTranscription(file, runpodApiKey, endpointId, workerUrl) {
  if (!runpodApiKey || !endpointId || !workerUrl) {
    throw new Error('חסרים פרטי חיבור (RunPod API Key / Endpoint ID / Worker URL)');
  }
  if (!file) throw new Error('לא נבחר קובץ אודיו');

  // פונקציה לניקוי שם קובץ
  function cleanFileName(name) {
    // החלפת רווחים ב-underscore והסרת תווים בעייתיים
    return name
      .replace(/\s+/g, '_')  // החלפת רווחים
      .replace(/[^\w\u0590-\u05FF.-]/g, '') // השארת אנגלית, עברית, נקודה ומקף
      .replace(/\.+/g, '.'); // מניעת נקודות כפולות
  }
  
  // שמירת השם המקורי והנקי
  const originalFileName = file.name || 'audio.wav';
  const cleanedFileName = cleanFileName(originalFileName);
  
  // בחירה אוטומטית: גדול מ-9MB → העלאה ל-R2
  const isLargeFile = file.size > 9 * 1024 * 1024;
  
  let transcribeArgs;
  
  if (isLargeFile) {
    // ========== קובץ גדול - העלאה ל-R2 ==========
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    showStatus(`מעלה קובץ גדול (${sizeMB}MB) לאחסון...`, 'processing');
    
    try {
      // שליחת הקובץ עם השם הנקי
      const uploadUrl = workerUrl.endsWith('/') 
        ? `${workerUrl}upload?name=${encodeURIComponent(cleanedFileName)}`
        : `${workerUrl}/upload?name=${encodeURIComponent(cleanedFileName)}`;

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'audio/wav',
          'x-runpod-api-key': runpodApiKey,      
          'x-runpod-endpoint-id': endpointId    
        },
        body: file
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
      console.log('שם מקורי:', originalFileName);
      console.log('שם נקי:', cleanedFileName);
      
      // שימוש ב-URL במקום base64
      transcribeArgs = {
        url: uploadData.url,
        filename: cleanedFileName, // שם נקי לשרת
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
      blob: base64,
      filename: cleanedFileName, // שם נקי גם לקבצים קטנים
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

    console.log('Starting polling with jobId:', jobId);

    // התחלת מעקב התקדמות
    if (window.progressTracker) {
      window.progressTracker.start(file.size);
    }

    showStatus('התמלול התחיל, מעקב אחר התקדמות...', 'processing');
    
    let pollCount = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;
    const MAX_POLL_COUNT = 300; // מקסימום 10 דקות (300 * 2 שניות)

    // Polling loop
    while (pollCount < MAX_POLL_COUNT) {
      await delay(2000);
      pollCount++;
      
      console.log(`Polling attempt ${pollCount}...`);

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
        console.log('Poll response:', pollData);
        
        // עדכון התקדמות פשוט - מבוסס על מספר הפעמים
        const estimatedProgress = Math.min(95, pollCount * 2); // עולה ב-2% כל פעם עד 95%
        if (window.progressTracker) {
          window.progressTracker.updateProgress(estimatedProgress);
        }
        
        // בדיקת תמלול
        transcript = extractTranscript(pollData);
        if (transcript) {
          console.log('Transcript received successfully!');
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
            console.log('Job completed, extracting transcript...');
            transcript = extractTranscript(pollData);
            if (transcript) {
              console.log('Job completed with transcript');
              break;
            }
            console.warn('Job completed but no transcript found:', pollData);
            
            // ננסה עוד כמה פעמים
            if (pollCount > 5) {
              // אם אחרי 5 ניסיונות אין תמלול, נבדוק אם יש טקסט כלשהו
              if (pollData?.output || pollData?.result) {
                console.log('Trying to extract any text from output...');
                const anyText = JSON.stringify(pollData);
                if (anyText.includes('text')) {
                  // ננסה לחלץ טקסט בכל דרך אפשרית
                  transcript = { 
                    text: 'התמלול הושלם אך הטקסט לא זוהה במבנה הצפוי. בדוק בלוגים.',
                    segments: []
                  };
                  console.error('Unexpected response structure:', pollData);
                  break;
                }
              }
              
              if (window.progressTracker) window.progressTracker.stop(false);
              throw new Error('סיום דווח אך אין תמלול בתשובה');
            }
          }
          
          // סטטוסים של תהליך רץ
          if (/running|in_progress|processing|in_queue/i.test(String(status))) {
            console.log('Job is still running...');
          }
        }
        
        // בדיקה אם המשתמש ביטל
        if (window.progressTracker && window.progressTracker.isCompleted) {
          console.log('User cancelled transcription');
          throw new Error('התמלול בוטל על ידי המשתמש');
        }
        
      } catch (error) {
        console.error('Error in polling:', error);
        
        // אם זו לא שגיאת רשת, נזרוק אותה
        if (!error.message.includes('fetch') && !error.message.includes('Failed to fetch')) {
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

    // אם הגענו למקסימום polling
    if (pollCount >= MAX_POLL_COUNT) {
      if (window.progressTracker) window.progressTracker.stop(false);
      throw new Error('התמלול לוקח זמן רב מדי (מעל 10 דקות). נסה שוב.');
    }

    if (!transcript) {
      if (window.progressTracker) window.progressTracker.stop(false);
      throw new Error('לא התקבל תמלול מהשרת');
    }
  }

  // ========== הצגת תוצאות ==========
  transcriptResult = {
    text: transcript.text,
    segments: Array.isArray(transcript.segments) && transcript.segments.length
      ? transcript.segments
      : [{ start: 0, end: 0, text: transcript.text }]
  };

  if (typeof progressTimer !== 'undefined') {
    clearInterval(progressTimer);
  }

  if (window.progressTracker) {
    window.progressTracker.stop(true);
  }

  finalizeProgress();
  displayResults();
  showStatus('התמלול הושלם בהצלחה ✔️', 'success');
}

// ===== פונקציות עזר =====

// פונקציה לחילוץ אחוז התקדמות מתשובת השרת
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

// הסרת prefix של data URL
function stripDataUrlPrefix(dataUrl) {
  if (typeof dataUrl !== 'string') return '';
  const idx = dataUrl.indexOf('base64,');
  return idx >= 0 ? dataUrl.slice(idx + 7) : dataUrl;
}

// המרת קובץ ל-Data URL
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('שגיאה בהמרת האודיו ל-Base64'));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

// השהייה
function delay(ms) { 
  return new Promise(res => setTimeout(res, ms)); 
}

// פרסור JSON בטוח
async function safeJson(res) {
  try { 
    return await res.json(); 
  } catch { 
    const t = await res.text().catch(() => ''); 
    console.debug('Non-JSON:', t); 
    throw new Error('תשובת השרת אינה JSON תקין'); 
  }
}

// חילוץ תמלול מתשובת השרת
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
  const text = core?.text ?? core?.transcription ?? core?.transcript ?? core?.output ?? core?.result;
  if (typeof text === 'string' && text.trim()) return { text: text.trim(), segments: core?.segments };
  const nested = core?.text?.content || core?.transcription?.content;
  if (typeof nested === 'string' && nested.trim()) return { text: nested.trim(), segments: core?.segments };
  return null;
}
