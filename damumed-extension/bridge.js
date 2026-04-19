// bridge.js — content script в isolated world.
// Даёт MAIN-world скриптам безопасный доступ к chrome.runtime.sendMessage через window.postMessage.

(function () {
  'use strict';

  if (window.top !== window.self) return;

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;

    const data = event.data;
    if (!data || data.direction !== 'DAMUMED_TO_EXTENSION' || !data.requestId) return;

    try {
      const response = await chrome.runtime.sendMessage(data.message);
      window.postMessage({
        direction: 'DAMUMED_FROM_EXTENSION',
        requestId: data.requestId,
        ok: true,
        response
      }, '*');
    } catch (error) {
      window.postMessage({
        direction: 'DAMUMED_FROM_EXTENSION',
        requestId: data.requestId,
        ok: false,
        error: error?.message || String(error)
      }, '*');
    }
  });
})();
