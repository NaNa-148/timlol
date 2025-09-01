// scripts/ivrit-transcription.js
// שליחה כ-JSON נקי ל-Worker + polling + ולידציה ברורה

async function performIvritTranscription(file, runpodApiKey, endpointId, workerUrl) {
  if (!runpodApiKey || !endpointId || !workerUrl) {
    throw new Error('חסרים פרטי חיבור (RunPod API Key / Endpoint ID / Worker URL)');
  }
  if (!file) throw new Error('לא נבחר קובץ אודיו');
  if (file.size > 100 * 1024 * 1024) throw new Error('קובץ גדול מדי (מקס׳ 100MB)');

  showStatus('ממיר אודיו ל-Base64…', 'processing');

  // שם בטוח + המרה ל-data URL
  const safeName = (file.name || 'audio').replace(/[^\w.\-]+/g, '_');
  const dataUrl = await fileToDataUrl(file);         // "data:audio/xxx;base64,AAAA..."
  const base64 = stripDataUrlPrefix(dataUrl);        // "AAAA..." בלבד

  if (!base64 || base64.length < 100) {
    throw new Error('האודיו לא זוהה/ריק (base64 קצר מדי)');
  }

  // payload שהמודל מצפה לקבל בתוך input.transcribe_args
  const transcribeArgs = {
    audio_base64: base64,              // שים לב: בלי prefix של data:
    filename: safeName,
    mime_type: file.type || 'audio/wav',
    language: 'he',
    punctuate: true,
    diarize: false,
    // דוגמאות לאופציונלי:
    // sample_rate: 44100,
    // channels: 1,
  };

  showStatus('שולח את המשימה ל-ivrit.ai…', 'processing');
  simulateProgress(5, 75, 60_000);

  // פתיחת משימה דרך ה-Worker
  const startRes = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runpod-api-key': runpodApiKey,
      'x-runpod-endpoint-id': endpointId,
      // אפשרות לדיבוג: 'x-debug': 'echo'  (ה-Worker יחזיר את מה שהוא שולח ל-RunPod)
    },
    body: JSON.stringify({ transcribe_args: transcribeArgs })
  });

  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => '');
    throw new Error(`שגיאה ב-Worker: ${startRes.status} – ${errText}`);
  }

  const startData = await safeJson(startRes);

  // אולי קיבלנו תוצאה מיידית:
  let transcript = extractTranscript(startData);
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

    // polling עד סיום
    const deadline = Date.now() + 180_000; // 3 דק׳
    while (Date.now() < deadline) {
      await delay(2000);

      const pollRes = await fetch(workerUrl, {
        method: 'POST',
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
        // נסה לחלץ הודעת שגיאה מפנימה כדי לקבל אינדיקציה מהמודל
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

// ===== עזרי עיבוד =====
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
function delay(ms){ return new Promise(res=>setTimeout(res,ms)); }
async function safeJson(res){
  try { return await res.json(); }
  catch { const t=await res.text().catch(()=> ''); console.debug('Non-JSON:',t); throw new Error('תשובת השרת אינה JSON תקין'); }
}
function extractTranscript(obj){
  if (!obj || typeof obj!=='object') return null;
  const core = obj.output || obj.result || obj.data || obj;
  if (typeof core === 'string') return { text: core };
  const text = core?.text ?? core?.transcription ?? core?.transcript ?? core?.output ?? core?.result;
  if (typeof text==='string' && text.trim()) return { text: text.trim(), segments: core?.segments };
  const nested = core?.text?.content || core?.transcription?.content;
  if (typeof nested==='string' && nested.trim()) return { text: nested.trim(), segments: core?.segments };
  return null;
}
