// scripts/ivrit-transcription.js
// תמלול באמצעות ivrit.ai דרך RunPod + Cloudflare Worker
// שליחה כ-JSON (לא FormData) + תמיכה בפולינג עד סיום המשימה

async function performIvritTranscription(file, runpodApiKey, endpointId, workerUrl) {
  if (!runpodApiKey || !endpointId || !workerUrl) {
    throw new Error('חסרים פרטי חיבור ל-ivrit.ai (RunPod API Key / Endpoint ID / Worker URL)');
  }
  if (!file) throw new Error('לא נבחר קובץ אודיו');
  if (file.size > 100 * 1024 * 1024) throw new Error('קובץ גדול מדי (מקס׳ 100MB)');

  showStatus('מכין אודיו לתמלול...', 'processing');

  // שם בטוח לקובץ
  const origName = file?.name || 'audio';
  const safeName = String(origName).replace(/[^\w.\-]+/g, '_');
  // המרת האודיו ל-data URL (base64)
  const audioBase64 = await fileToDataUrl(file); // "data:audio/xxx;base64,AAAA..."

  // ----- זה ה-JSON שהמודל מצפה לקבל בתוך input.transcribe_args -----
  const transcribeArgs = {
    // שלח או audio_base64 (data URL) או audio_url (אם מאוחסן בענן)
    audio_base64: audioBase64,
    filename: safeName,
    mime_type: file.type || 'audio/wav',
    // פרמטרים אופציונליים
    language: 'he',
    punctuate: true,
    diarize: false,
    // דוגמאות נכונות אם תרצה:
    // sample_rate: 44100,
    // channels: 1,
  };

  showStatus('שולח בקשה לתמלול...', 'processing');
  simulateProgress(5, 75, 60_000);

  // פתיחת משימה (Job) דרך ה-Worker
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

  // אם קיבלנו תוצאה מיידית (נדיר) – נחלץ אותה
  let transcript = extractTranscript(startData);
  if (!transcript) {
    // אחרת, מצפה ל-id של ה-Job
    const jobId = startData?.id || startData?.jobId || startData?.data?.id || startData?.data?.jobId;
    if (!jobId) {
      console.debug('Start response (no transcript, no jobId):', startData);
      throw new Error('השרת לא החזיר תוצאה ולא מזהה משימה (jobId)');
    }

    showStatus('מעבד... (ivrit.ai)', 'processing');
    simulateProgress(75, 98, 180_000);

    // פולינג עד סיום
    const timeoutMs = 180_000;
    const intervalMs = 2000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await delay(intervalMs);

      const pollRes = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'x-runpod-api-key': runpodApiKey,
          'x-runpod-endpoint-id': endpointId,
          'x-job-id': String(jobId)
        }
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text().catch(() => '');
        throw new Error(`Polling נכשל: ${pollRes.status} – ${errText}`);
      }

      const pollData = await safeJson(pollRes);
      transcript = extractTranscript(pollData);

      const status =
        pollData?.status ||
        pollData?.state ||
        pollData?.data?.status ||
        pollData?.data?.state;

      if (transcript) break;

      if (status && /failed|error/i.test(String(status))) {
        console.debug('Polling error payload:', pollData);
        throw new Error('המשימה נכשלה בצד הספק (status=failed)');
      }

      if (status && /completed|succeeded|success|done/i.test(String(status))) {
        transcript = extractTranscript(pollData);
        if (transcript) break;
        console.debug('Completed but no transcript field:', pollData);
        throw new Error('סיום משימה דווח אך ללא תמלול זמין בתשובה');
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
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('שגיאה בהמרת האודיו ל-Base64'));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }
async function safeJson(res) {
  try { return await res.json(); }
  catch { const t = await res.text().catch(() => ''); console.debug('Non-JSON:', t); throw new Error('תשובת השרת אינה JSON תקין'); }
}
function extractTranscript(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const core = obj.output || obj.result || obj.data || obj;
  if (typeof core === 'string') return { text: core };
  const text = core?.text ?? core?.transcription ?? core?.transcript ?? core?.output ?? core?.result;
  if (typeof text === 'string' && text.trim()) return { text: text.trim(), segments: core?.segments };
  const nested = core?.text?.content || core?.transcription?.content;
  if (typeof nested === 'string' && nested.trim()) return { text: nested.trim(), segments: core?.segments };
  return null;
}
