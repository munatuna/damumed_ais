// background.js — service worker (Manifest V3).
// Claude API (Anthropic) — единственный провайдер.

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const PROXY_ENDPOINT = 'http://localhost:8001/api/llm';

async function getSettings() {
  const d = await chrome.storage.local.get(['claudeApiKey', 'claudeModel']);
  return {
    apiKey: d.claudeApiKey || '',
    model:  d.claudeModel  || DEFAULT_MODEL,
  };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Claude Messages API ────────────────────────────────────────────────────
async function callClaude({ systemPrompt, userMessage, pdfBase64, pdfMimeType }, settings, retries = 2) {
  if (!settings.apiKey) throw new Error('API_KEY_MISSING');

  const body = {
    apiKey:       settings.apiKey,
    model:        settings.model,
    systemPrompt,
    userMessage,
    pdfBase64:    pdfBase64 || null,
    pdfMimeType:  pdfMimeType || null,
  };

  let response;
  try {
    response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('NETWORK_ERROR: Сервер не запущен? Запустите localhost:8001');
  }

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 529 && retries > 0) {
      await sleep((3 - retries) * 2000);
      return callClaude({ systemPrompt, userMessage, pdfBase64, pdfMimeType }, settings, retries - 1);
    }
    throw new Error(`API_ERROR_${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw = data?.text || '';
  if (!raw) throw new Error('EMPTY_RESPONSE');
  return parseJson(raw);
}

// ── Shared JSON parser ──────────────────────────────────────────────────────
function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Try extracting first JSON object/array from text
      const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        try { return JSON.parse(match[1]); } catch {}
      }
      throw new Error('INVALID_JSON: ' + raw.slice(0, 200));
    }
  }
}

// ── Message handler ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === 'LLM_QUERY' || msg.type === 'GEMINI_QUERY') {
        const settings = await getSettings();
        const result = await callClaude(msg.payload, settings);
        sendResponse({ ok: true, data: result });

      } else if (msg.type === 'SET_API_KEY') {
        await chrome.storage.local.set({ claudeApiKey: msg.apiKey || '' });
        sendResponse({ ok: true });

      } else if (msg.type === 'SET_MODEL') {
        await chrome.storage.local.set({ claudeModel: msg.model });
        sendResponse({ ok: true });

      } else if (msg.type === 'GET_SETTINGS') {
        const s = await getSettings();
        sendResponse({
          ok:          true,
          provider:    'claude',
          hasKey:      Boolean(s.apiKey),
          model:       s.model,
        });

      } else if (msg.type === 'GET_SETTINGS_FOR_PROXY') {
        const s = await getSettings();
        sendResponse({ ok: true, apiKey: s.apiKey, model: s.model });

      } else if (msg.type === 'GET_API_KEY_STATUS') {
        const s = await getSettings();
        sendResponse({
          ok:            true,
          provider:      'claude',
          providerLabel: 'Claude',
          hasKey:        Boolean(s.apiKey),
          keyUrl:        'https://console.anthropic.com/settings/keys'
        });

      } else if (msg.type === 'PING') {
        const s = await getSettings();
        if (!s.apiKey) { sendResponse({ ok: false, error: 'API_KEY_MISSING' }); return; }
        try {
          const res = await callClaude({
            systemPrompt: 'Reply strictly with JSON: {"ok": true}',
            userMessage: 'ping'
          }, s);
          sendResponse({ ok: true, pong: res });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }

      } else {
        sendResponse({ ok: false, error: 'UNKNOWN_MESSAGE_TYPE' });
      }
    } catch (err) {
      console.error('[background] Error:', err);
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  return true;
});

console.log('[Damumed Assistant] background.js loaded (Claude API)');
