// ivrit.ai transcription (fixed JSON, async polling via Worker)
// דרישות חיצוניות: showStatus, simulateProgress, finalizeProgress, displayResults,
// selectedFile (מ-file-handler.js), ו-transcriptResult (גלובלי) קיימים כבר בפרויקט.

async function performIvritTranscription(file, runpodApiKey, endpointId, workerUrl) {
  // === ולידציה בסיסית ===
  if (!runpodApiKey || !endpointId || !workerUrl) {
    throw new Error('חסרים פרטי חיבור ל-ivrit.ai (RunPod API Key / Endpoint ID / Worker URL)');
  }
  if (!file) {
    throw new Error('לא נבחר קובץ אודיו');
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('קובץ גדול מדי עבור ivrit.ai (מקס׳ 100MB)');
  }

  showStatus('מכין אודיו לתמלול...', 'processing');
  // נוודא שיש שם לקובץ (גם אם הגיע מ-Blob ביניים)
  const origName = (file.name && typeof file.name === 'string')
    ? file.name
    : (typeof selectedFile?.name === 'string' ? selectedFile.name : 'audio');
  const safeName = origName.replace(/[^\w.\-]+/g, '_');

  // המרה ל-Base64 (כולל data URL) כדי לשלוח כ-JSON נקי
  const audioBase64 = await fileToDataUrl(file); // "data:audio/xxx;base64,AAAA..."
  const payload = {
    // אחד מאלה מספיק; בחרנו base64 כדי לא לדרוש אחסון חיצוני
    audio_base64: audioBase64,
    filename: safeName,
    mime_type: file.type || 'audio/wav',

    // פרמטרים אופציונליים – השאר כראות עינך; הימנע ממחרוזות "מספריות" עם מקפים
    language: "he",
    diarize: false,
    punctuate: true,

    // אם תרצה להגדיר Sample Rate מספרי (ללא "khz-"): 
    // sample_rate: 44100,
    // channels: 1,
  };

  showStatus('שולח בקשה לתמלול ivrit.ai...', 'processing');
  simulateProgress(5, 75, 60_000); // סימולציית התקדמות עד לתחילת הפולינג

  // === התחלת Job דרך ה-Worker ===
  const startRes = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runpod-api-key': runpodApiKey,
      'x-runpod-endpoint-id': endpointId
    },
    body: JSON.stringify(payload)
  });

  // אם ה-Worker עצמו נפל – נזרוק שגיאה עם טקסט מלא
  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => '');
    throw new Error(`שגיאה ב-Worker: ${startRes.status} – ${errText}`);
  }

  const startData = await safeJson(startRes);

  // יתכנו שני תרחישים:
  // 1) תשובה סינכרונית (מיידית) שכבר כוללת תמלול.
  // 2) תשובת Job (כולל מזהה) ונצטרך לבצע polling.
  let transcript = extractTranscript(startData);

  if (!transcript) {
    // מחפשים מזהה עבודה להמשך polling
    const jobId = startData?.id || startData?.jobId || startData?.data?.id || startData?.data?.jobId;
    if (!jobId) {
      // הדפס דיבוג ונכשיל ברור
      console.debug('Start response (no transcript, no jobId):', startData);
      throw new Error('השרת לא החזיר תוצאה ולא מזהה משימה (jobId)');
    }

    showStatus('מעבד... (ivrit.ai)', 'processing');
    simulateProgress(75, 98, 180_000); // נתקדם עד ~98% בזמן העיבוד

    // === Polling דרך ה-Worker ===
    const maxWaitMs = 180_000;
    const intervalMs = 2_000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await delay(intervalMs);

      const pollRes = await fetch(workerUrl, {
        method: 'POST', // נשמור על POST כדי לעבור דרך CORS אחיד, אבל מסמנים jobId בכותרת
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

      // תרחישי סטטוס נפוצים:
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
        // ייתכן שהתמלול נמצא בשדה אחר (output/result וכו׳)
        transcript = extractTranscript(pollData);
        if (transcript) break;

        console.debug('Completed state but no transcript:', pollData);
        throw new Error('סיום משימה דווח אך ללא תמלול זמין בתשובה');
      }
    }

    if (!transcript) {
      throw new Error('חריגה מזמן ההמתנה לתמלול (timeout)');
    }
  }

  // === בניית תוצאה בפורמט אחיד לאפליקציה ===
  transcriptResult = {
    text: transcript.text,
    segments: transcript.segments && Array.isArray(transcript.segments) && transcript.segments.length
      ? transcript.segments
      : [{ start: 0, end: 0, text: transcript.text }]
  };

  finalizeProgress();
  displayResults();
  showStatus('התמלול הושלם בהצלחה ✔️', 'success');
}

// בדיקת זמינות Worker (אופציונלי)
async function checkIvritAiStatus(workerUrl) {
  if (!workerUrl) return false;
  try {
    const url = workerUrl.replace(/\/+$/, '') + '/health';
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ===== עזרי עיבוד מקומיים =====

// המרת File/Blob ל-data URL (base64)
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
  } catch (e) {
    const t = await res.text().catch(() => '');
    console.debug('Non-JSON response body:', t);
    throw new Error('תשובת השרת אינה JSON תקין');
  }
}

// חילוץ תמלול מכל צורה סבירה שהספק יחזיר
function extractTranscript(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // לעיתים תגיע עטיפה פנימית
  const core = obj.output || obj.result || obj.data || obj;

  // ייתכן שמגיע כמחרוזת ישירה
  if (typeof core === 'string') return { text: core };

  // השדות השכיחים
  const text =
    core?.text ??
    core?.transcription ??
    core?.transcript ??
    core?.output ??
    core?.result;

  if (typeof text === 'string' && text.trim()) {
    return {
      text: text.trim(),
      segments: core?.segments
    };
  }

  // לעיתים מגיע מבנה כמו { text: { content: "..." } }
  const nestedText = core?.text?.content || core?.transcription?.content;
  if (typeof nestedText === 'string' && nestedText.trim()) {
    return {
      text: nestedText.trim(),
      segments: core?.segments
    };
  }

  return null;
}
