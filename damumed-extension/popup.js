// popup.js — настройки расширения (Claude API only)

const saveBtn   = document.getElementById('save-btn');
const testBtn   = document.getElementById('test-btn');
const statusEl  = document.getElementById('status');
const keyInput  = document.getElementById('claude-key');
const modelSel  = document.getElementById('claude-model');
const serverUrl = document.getElementById('server-url');
const keyStatus = document.getElementById('key-status');

function showStatus(text, kind = 'success') {
  statusEl.textContent = text;
  statusEl.className = 'status ' + kind;
  if (kind === 'success') setTimeout(() => { statusEl.className = 'status'; }, 2500);
}

// Load current settings
(async function load() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (!resp?.ok) return;
    if (resp.serverUrl) serverUrl.value = resp.serverUrl;
    if (resp.hasKey) {
      keyInput.placeholder = '•••• ключ сохранён ••••';
      keyStatus.textContent = '✓ сохранён';
      keyStatus.className = 'key-status ok';
    } else {
      keyStatus.textContent = 'не задан';
      keyStatus.className = 'key-status miss';
    }
    if (resp.model) modelSel.value = resp.model;
  } catch (e) { console.error(e); }
})();

saveBtn.addEventListener('click', async () => {
  const key = keyInput.value.trim();
  if (key) {
    const r = await chrome.runtime.sendMessage({ type: 'SET_API_KEY', apiKey: key });
    if (!r?.ok) { showStatus('Ошибка сохранения ключа', 'error'); return; }
    keyInput.value = '';
    keyInput.placeholder = '•••• ключ сохранён ••••';
    keyStatus.textContent = '✓ сохранён';
    keyStatus.className = 'key-status ok';
  }
  await chrome.runtime.sendMessage({ type: 'SET_MODEL', model: modelSel.value });
  const url = serverUrl.value.trim();
  if (url) await chrome.runtime.sendMessage({ type: 'SET_SERVER_URL', serverUrl: url });
  showStatus('✓ Настройки сохранены', 'success');
});

testBtn.addEventListener('click', async () => {
  showStatus('⏳ Проверяю связь с Claude...', 'success');
  statusEl.style.display = 'block';
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'PING' });
    if (resp?.ok) {
      showStatus('✓ Claude отвечает — всё работает', 'success');
    } else if (resp?.error === 'API_KEY_MISSING') {
      showStatus('✗ Введите API-ключ и сохраните', 'error');
    } else {
      showStatus('✗ ' + (resp?.error || 'неизвестная ошибка').slice(0, 100), 'error');
    }
  } catch (e) {
    showStatus('✗ ' + e.message, 'error');
  }
});
