// שיפור טקסט באמצעות GPT

let improvedResult = '';

// שיפור טקסט
async function improveText(text, apiKey) {
    const improveModelSelect = document.getElementById('improveModelSelect');
    const selectedModel = improveModelSelect ? improveModelSelect.value : 'gpt-4o';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: selectedModel,
            messages: [{
                role: 'system',
                content: 'אתה עורך טקסט מקצועי בעברית. המשימה שלך היא לתקן שגיאות הקדוק, כתיב, פיסוק ולהשלים מילים חסרות בטקסט שקיבלת מתמלול אודיו. שמור על המשמעות המקורית והתוכן, רק תקן שגיאות ותשפר את הקריאות. תקן גם מילים שנשמעו לא נכון או לא מובנות.'
            }, {
                role: 'user',
                content: `אנא תקן ותשפר את הטקסט הבא מתמלול אודיו:\n\n${text}`
            }],
            max_tokens: 4000,
            temperature: 0.2
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    const improvedContent = result.choices[0]?.message?.content?.trim();
    
    if (!improvedContent
        // שיפור טקסט באמצעות GPT

let improvedResult = '';

// שיפור טקסט
async function improveText(text, apiKey) {
    const improveModelSelect = document.getElementById('improveModelSelect');
    const selectedModel = improveModelSelect ? improveModelSelect.value : 'gpt-4o';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: selectedModel,
            messages: [{
                role: 'system',
                content: 'אתה עורך טקסט מקצועי בעברית. המשימה שלך היא לתקן שגיאות הקדוק, כתיב, פיסוק ולהשלים מילים חסרות בטקסט שקיבלת מתמלול אודיו. שמור על המשמעות המקורית והתוכן, רק תקן שגיאות ותשפר את הקריאות. תקן גם מילים שנשמעו לא נכון או לא מובנות.'
            }, {
                role: 'user',
                content: `אנא תקן ותשפר את הטקסט הבא מתמלול אודיו:\n\n${text}`
            }],
            max_tokens: 4000,
            temperature: 0.2
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    const improvedContent = result.choices[0]?.message?.content?.trim();
    
    if (!improvedContent || improvedContent === text) {
        throw new Error('לא ניתן לשפר את הטקסט או שהוא כבר מושלם');
    }
    
    return improvedContent;
}

// הצגת טקסט משופר
function displayImprovedText(improvedContent) {
    const improvedTextElement = document.getElementById('improvedText');
    if (improvedTextElement) {
        improvedTextElement.innerHTML = '<div style="font-weight: bold; margin-bottom: 10px; color: #28a745;">✨ טקסט מתוקן:</div>' + improvedContent;
        improvedTextElement.style.display = 'block';
    }
    improvedResult = improvedContent;
}

// הגדרת מאזין לכפתור שיפור
function setupTextImprovement() {
    const improveButton = document.getElementById('improveButton');
    const apiKeyInput = document.getElementById('apiKey');
    const transcriptTextElement = document.getElementById('transcriptText');
    
    if (!improveButton || !apiKeyInput || !transcriptTextElement) return;
    
    improveButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            alert('נדרש מפתח API לתיקון טקסט');
            return;
        }

        setButtonState(improveButton, '🔄 מתקן...', 'loading');

        try {
            const improvedTranscript = await improveText(transcriptTextElement.textContent, apiKey);
            displayImprovedText(improvedTranscript);
            setButtonState(improveButton, '✅ הושלם', 'success');
        } catch (error) {
            console.error('Text improvement error:', error);
            alert('שגיאה בתיקון הטקסט: ' + error.message);
            setButtonState(improveButton, '❌ שגיאה', 'error');
        }

        setTimeout(() => {
            improveButton.disabled = false;
            if (improveButton.textContent !== '✅ הושלם') {
                setButtonState(improveButton, '🔧 תיקון אוטומטי', 'default');
            }
        }, 3000);
    });
}
