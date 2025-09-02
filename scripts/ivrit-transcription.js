// /scripts/ivrit-transcription.js
// תמלול ivrit.ai עם תמיכה מלאה בקבצים גדולים דרך R2
// ✅ קבצים קטנים (<9MB) - base64 רגיל
// ✅ קבצים גדולים (>9MB) - העלאה ל-R2 ושימוש ב-URL

async function performIvritTranscription(file, runpodApiKey, endpointId, workerUrl) {
  if (!runpodApiKey || !endpointId || !workerUrl) {
    throw new Error('חסרים פרטי חיבור (RunPod API Key / Endpoint ID / Worker URL)');
  }
  if (!file) throw new Error('לא נבחר קובץ אודיו');

  const safeName = (file.name || 'audio').replace(/[^\w.\-]+/g, '_');
  
  // בחירה אוטומטית: גדול מ-9MB → העלאה ל-R2
  const isLargeFile = file.size > 9 * 1024 * 1024;
  
  let transcribeArgs;
  
  if (isLargeFile) {
    // ========== קובץ גדול - העלאה ל-R2 ==========
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    showStatus(`מעלה קובץ גדול (${sizeMB}MB) לאחסון...`, 'processing');
    
    try {
      // שליחת הקובץ הבינארי ישירות ל-Worker
      const uploadRes = await fetch(`${workerUrl}/upload?name=${encodeURIComponent(safeName)}`, {
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
  simulateProgress(5, 75, 60_000);

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

    showStatus('מעבד… (ivrit.ai)', 'processing');
    simulateProgress(75, 98, 180_000);

    const deadline = Date.now() + 180_000; // 3 דקות
    while (Date.now() < deadline) {
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
        throw new Error(`המשימה נכשלה בצד הספק (status=${status})${reason ? ` – ${reason}` : ''}`);
      }

      if (status && /completed|succeeded|success|done/i.test(String(status))) {
        transcript = extractTranscript(pollData);
        if (transcript) break;
        console.debug('Completed but no transcript field:', pollData);
        throw new Error('סיום דווח אך אין תמלול בתשובה');
      }
    }

    if (!transcript) throw new Error('חריגה מזמן ההמתנה לתמלול (timeout)');
  }

  // ========== הצגת תוצאות ==========
  transcriptResult = {
    text: transcript.text,
    segments: Array.isArray(transcript.segments) && transcript.segments.length
      ? transcript.segments
      : [{ start: 0, end: 0, text: transcript.text }]
  };

  finalizeProgress();
  displayResults();
  showStatus('התמלול הושלם בהצלחה ✔️', 'success');
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
  const text = core?.text ?? core?.transcription ?? core?.transcript ?? core?.output ?? core?.result;
  if (typeof text === 'string' && text.trim()) return { text: text.trim(), segments: core?.segments };
  const nested = core?.text?.content || core?.transcription?.content;
  if (typeof nested === 'string' && nested.trim()) return { text: nested.trim(), segments: core?.segments };
  return null;
}
