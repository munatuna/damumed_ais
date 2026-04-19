// content.js — плавающий AI-ассистент Damumed (чат + голос + PDF)

(function () {
  'use strict';

  if (window.top !== window.self) return;
  if (window.location.protocol.startsWith('chrome-extension')) return;
  if (document.getElementById('damumed-assistant-root')) return;

  function init() {
    if (!window.__DamumedSpeech || !window.__DamumedActions || !window.__DamumedPrompts) {
      return setTimeout(init, 50);
    }

    const { VoiceRecognizer, VoiceSpeaker } = window.__DamumedSpeech;
    const { buildPageContext, dispatchAction }  = window.__DamumedActions;
    const {
      buildIntentPrompt,
      buildMedicalRecordPrompt,
      buildDiaryPrompt,
      EXPAND_OBJECTIVE_PROMPT,
      INTENT_RESPONSE_SCHEMA,
      MEDICAL_RECORD_RESPONSE_SCHEMA,
      DIARY_RESPONSE_SCHEMA,
      OBJECTIVE_EXPANSION_SCHEMA
    } = window.__DamumedPrompts;

    const recognizer = new VoiceRecognizer();
    const speaker    = new VoiceSpeaker();

    // ── DOM ──────────────────────────────────────────────────────────────────
    const root = document.createElement('div');
    root.id = 'damumed-assistant-root';
    root.innerHTML = `
      <div class="da-panel" id="da-panel">

        <div class="da-header">
          <div class="da-header-avatar">✨</div>
          <div class="da-header-info">
            <div class="title">Damumed AI</div>
            <div class="subtitle" id="da-provider-label">Голосовой и текстовый ассистент</div>
          </div>
          <button class="da-close" id="da-close" title="Свернуть">×</button>
        </div>

        <div class="da-statusbar" id="da-statusbar">
          <span class="da-status-dot"></span>
          <span id="da-status-text">Готов к работе</span>
        </div>

        <div class="da-messages" id="da-messages"></div>

        <div class="da-footer">
          <!-- PDF upload -->
          <input type="file" id="da-pdf-input" accept=".pdf" style="display:none;">
          <button class="da-icon-btn" id="da-pdf-btn" title="Загрузить PDF пациента">📎</button>

          <!-- Text input -->
          <div class="da-input-wrap">
            <input class="da-text-input" id="da-text-input"
              type="text" placeholder="Написать или нажмите 🎤…" autocomplete="off">
            <button class="da-send-btn" id="da-send-btn" title="Отправить">➤</button>
          </div>

          <!-- Mic -->
          <button class="da-icon-btn" id="da-mic-btn" title="Голос (Ctrl+Space)">🎤</button>
        </div>
      </div>

      <button class="da-fab" id="da-fab" title="Голосовой ассистент">🎤</button>
    `;
    document.body.appendChild(root);

    // Refs
    const panel      = document.getElementById('da-panel');
    const fab        = document.getElementById('da-fab');
    const closeBtn   = document.getElementById('da-close');
    const statusbar  = document.getElementById('da-statusbar');
    const statusText = document.getElementById('da-status-text');
    const messages   = document.getElementById('da-messages');
    const textInput  = document.getElementById('da-text-input');
    const sendBtn    = document.getElementById('da-send-btn');
    const micBtn     = document.getElementById('da-mic-btn');
    const pdfBtn     = document.getElementById('da-pdf-btn');
    const pdfInput   = document.getElementById('da-pdf-input');

    // ── State ────────────────────────────────────────────────────────────────
    let isListening  = false;
    let isProcessing = false;
    let currentFinalTranscript = '';
    let currentProviderLabel   = 'AI';
    let bridgeCounter = 0;
    let cachedCreds = null; // { apiKey, model } — fetched once, reused

    // ── Helpers ──────────────────────────────────────────────────────────────
    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
      );
    }

    function now() {
      return new Date().toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' });
    }

    function setStatus(text, kind = '') {
      statusText.textContent = text;
      statusbar.className = 'da-statusbar ' + kind;
    }

    function addMsg(text, role = 'agent', extra = '') {
      const wrap = document.createElement('div');
      wrap.className = 'da-msg ' + role + (extra ? ' ' + extra : '');
      wrap.innerHTML = `
        <div class="da-bubble">${escapeHtml(text)}</div>
        <div class="da-msg-time">${now()}</div>
      `;
      messages.appendChild(wrap);
      messages.scrollTop = messages.scrollHeight;
      return wrap;
    }

    function addSystemMsg(text) {
      const wrap = document.createElement('div');
      wrap.className = 'da-msg system';
      wrap.innerHTML = `<div class="da-bubble">${escapeHtml(text)}</div>`;
      messages.appendChild(wrap);
      messages.scrollTop = messages.scrollHeight;
    }

    function setFabState(state) {
      fab.className = 'da-fab' + (state ? ' ' + state : '');
      fab.textContent = state === 'processing' ? '⏳'
                      : state === 'listening'  ? '🔴'
                      : state === 'error'      ? '⚠️' : '🎤';
      micBtn.className = 'da-icon-btn' + (state === 'listening' ? ' active' : '');
      micBtn.textContent = state === 'listening' ? '🔴' : '🎤';
    }

    function openPanel()  { panel.classList.add('open'); }
    function closePanel() { panel.classList.remove('open'); }

    // ── Extension bridge ─────────────────────────────────────────────────────
    function sendExtensionMessage(message) {
      if (window.chrome?.runtime?.sendMessage) {
        return window.chrome.runtime.sendMessage(message);
      }
      return new Promise((resolve, reject) => {
        const requestId = `damumed-${Date.now()}-${++bridgeCounter}`;
        function handler(event) {
          if (event.source !== window) return;
          const d = event.data;
          if (!d || d.direction !== 'DAMUMED_FROM_EXTENSION' || d.requestId !== requestId) return;
          window.removeEventListener('message', handler);
          clearTimeout(tid);
          d.ok ? resolve(d.response) : reject(new Error(d.error || 'BRIDGE_ERROR'));
        }
        const tid = setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('EXTENSION_BRIDGE_TIMEOUT'));
        }, 15000);
        window.addEventListener('message', handler);
        window.postMessage({ direction: 'DAMUMED_TO_EXTENSION', requestId, message }, '*');
      });
    }

    async function getCreds() {
      if (cachedCreds?.apiKey) return cachedCreds;
      const resp = await sendExtensionMessage({ type: 'GET_SETTINGS_FOR_PROXY' });
      if (!resp?.apiKey) throw new Error('API_KEY_MISSING');
      cachedCreds = {
        apiKey:    resp.apiKey,
        model:     resp.model,
        serverUrl: (resp.serverUrl || 'http://localhost:8001').replace(/\/$/, ''),
      };
      return cachedCreds;
    }

    // Direct fetch to proxy — bypasses bridge entirely, no timeout issues
    async function queryLlm(payload) {
      const creds = await getCreds();
      const resp = await fetch(creds.serverUrl + '/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: payload.systemPrompt,
          userMessage:  payload.userMessage,
          apiKey:       creds.apiKey,
          model:        creds.model,
        })
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`API_ERROR_${resp.status}: ${err.slice(0, 150)}`);
      }
      const data = await resp.json();
      const raw = data?.text || '';
      if (!raw) throw new Error('EMPTY_RESPONSE');
      try { return JSON.parse(raw); }
      catch { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : raw; }
    }

    // ── Main pipeline ────────────────────────────────────────────────────────
    function shouldExpandObjective(text) {
      if (!text || text.length > 220) return false;
      return /объектив|состояние|дыхани|чсс|сатурац|рост|вес|живот|кож/i.test(text);
    }

    async function buildStructuredAction(intentAction, utterance, pageContext) {
      if (intentAction.action === 'fill_medical_record') {
        const filled = await queryLlm({
          systemPrompt: buildMedicalRecordPrompt(pageContext),
          userMessage: utterance,
          responseSchema: MEDICAL_RECORD_RESPONSE_SCHEMA
        });
        if (shouldExpandObjective(filled?.fields?.objective)) {
          try {
            const exp = await queryLlm({
              systemPrompt: EXPAND_OBJECTIVE_PROMPT,
              userMessage: filled.fields.objective,
              responseSchema: OBJECTIVE_EXPANSION_SCHEMA
            });
            if (exp?.objective_expanded) filled.fields.objective = exp.objective_expanded;
          } catch (e) { /* skip */ }
        }
        return { ...intentAction, ...filled, next_suggestion: filled.next_suggestion ?? intentAction.next_suggestion ?? null };
      }
      if (intentAction.action === 'fill_diary') {
        const filled = await queryLlm({
          systemPrompt: buildDiaryPrompt(pageContext),
          userMessage: utterance,
          responseSchema: DIARY_RESPONSE_SCHEMA
        });
        return { ...intentAction, ...filled, next_suggestion: filled.next_suggestion ?? intentAction.next_suggestion ?? null };
      }
      return intentAction;
    }

    async function processUtterance(utterance) {
      if (isProcessing) { addMsg('Подождите — ещё обрабатываю...', 'agent', 'error'); return; }
      isProcessing = true;
      sendBtn.disabled = true;
      setFabState('processing');
      setStatus('🤖 Думаю...', '');

      const pageContext = buildPageContext();
      try {
        const intentAction = await queryLlm({
          systemPrompt: buildIntentPrompt(pageContext),
          userMessage: utterance,
          responseSchema: INTENT_RESPONSE_SCHEMA
        });
        const action = await buildStructuredAction(intentAction, utterance, pageContext);

        // Actions that modify data require doctor confirmation
        const CONFIRM_ACTIONS = new Set(['fill_diary', 'fill_medical_record', 'add_diagnosis', 'add_assignment', 'create_schedule']);

        if (CONFIRM_ACTIONS.has(action.action)) {
          isProcessing = false;
          sendBtn.disabled = false;
          setFabState('');
          setStatus('Ожидаю подтверждения...', '');
          const confirmed = await askConfirmation(action);
          if (!confirmed) {
            addSystemMsg('Отменено врачом');
            setStatus('Готов к работе', '');
            return;
          }
          isProcessing = true;
          sendBtn.disabled = true;
          setFabState('processing');
          setStatus('🤖 Выполняю...', '');
        }

        const result = dispatchAction(action);

        if (result.ok) {
          addMsg(result.message || 'Готово ✓', 'agent', 'success');
          setStatus('✓ ' + (result.message || 'Готово'), 'success');
          if (action.next_suggestion) {
            speaker.speak(action.next_suggestion);
            setTimeout(() => addMsg('💬 ' + action.next_suggestion, 'agent'), 600);
          }
        } else {
          addMsg(result.message || 'Не удалось выполнить', 'agent', 'error');
          setStatus(result.message || 'Ошибка', 'error');
        }
      } catch (e) {
        console.error('[Assistant]', e);
        const msg = e.message?.includes('TIMEOUT')       ? 'Нет связи с расширением — обновите страницу (F5)' :
                    e.message?.includes('API_KEY_MISSING')? `Настройте API-ключ ${currentProviderLabel}` :
                    e.message?.includes('429')            ? `Превышен лимит ${currentProviderLabel}` :
                    `Ошибка: ${e.message}`;
        addMsg(msg, 'agent', 'error');
        setStatus('❌ Ошибка', 'error');
      } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        setFabState(isListening ? 'listening' : '');
      }
    }

    // ── PDF analysis ─────────────────────────────────────────────────────────
    const PDF_EXTRACT_PROMPT = `
Ты — медицинский AI-ассистент казахстанского реабилитационного центра.
Тебе дан PDF медицинского документа (история болезни, выписной эпикриз, направление).
Документ может быть на русском, казахском или смешанном языке.

ЗАДАЧА: прочитай ВЕСЬ документ, найди и верни JSON со всеми полями ниже.
Верни ТОЛЬКО JSON, без markdown, без пояснений.

━━━ ПРАВИЛА ПОИСКА ━━━

fullName — ищи: "Ф.И.О.", "АТЫ-ЖӨНІ", "Пациент:", строки КАПСЛОКОМ вида "ИВАНОВ ИВАН ИВАНОВИЧ".
  Верни в формате "ФАМИЛИЯ ИМЯ ОТЧЕСТВО" заглавными буквами.

iin — ищи: "ИИН", "ЖСН", 12-значное число подряд. Верни ровно 12 цифр без пробелов.

birthDate — ищи: "Дата рождения", "Туған күні", "Д.р.", "р.". Формат ответа: ДД.ММ.ГГГГ.
  ВАЖНО: если дата рождения не найдена явно, но есть ИИН — первые 6 цифр ИИН это YYMMDD.
  Пример: ИИН 150713602636 → дата рождения 13.07.2015 (15=2015, 07=июль, 13=число).
  Для определения века: если YY >= 00 и <= 25 → 20xx, если YY > 25 → 19xx.

age — возраст числом. Если не найден, вычисли из birthDate относительно текущего года.

gender — ищи "пол", "жынысы", "муж"/"жен", "М"/"Ж" рядом с ФИО или датой рождения.

nationality — ищи "национальность", "ұлты".

address — ищи "адрес", "мекенжайы", "проживает", "прописан". Бери полный адрес.

school — ищи "школа", "мектеп", "учебное заведение", "класс". Бери название + класс.

admissionDate — ищи "дата поступления", "госпитализирован", "поступил", "түскен күні".
  Формат ответа: ДД.ММ.ГГГГ

admissionTime — ищи время рядом с датой поступления: "ЧЧ:ММ", "в XX:XX", "время поступления".
  Формат ответа: ЧЧ:ММ (например "06:29")

dischargeDate — ищи "дата выписки", "выписан", "шыққан күні". Формат: ДД.ММ.ГГГГ

ward — ищи "палата", "отделение", "бөлімше". Верни полное название.

referralOrg — ищи "направившая организация", "жолдаған мекеме", "направлен из". Полное название.

admissionType — обычно "Плановая госпитализация" или "Экстренная госпитализация".

attendingDoctor — ищи "лечащий врач", "емдеуші дәрігер", "врач", подпись врача.

diagnosisMain — ищи "основной диагноз", "негізгі диагноз", МКБ-10 код в скобках типа (J41.0).
  Верни как "(КОД) Название диагноза".

diagnosisClarify — ищи "уточняющий", "сопутствующий", "қосымша диагноз", второй МКБ код.

diagnosisCategory — определи по диагнозу:
  respiratory = болезни дыхания (J00-J99, бронхит, астма, пневмония)
  neurological = нервная система (G00-G99, ДЦП, гипертензия, неврология)
  speech = нарушения речи, логопедия
  orthopedic = опорно-двигательный аппарат (M00-M99)
  cardiac = сердце (I00-I99)

vitals — ищи в разделах "осмотр", "антропометрия", "объективно":
  weight = вес в кг (число)
  height = рост в см (число)
  temperature = температура тела (36.x обычно)
  pulse = пульс уд/мин (число)
  pressureTop = АД систолическое (верхнее, число)
  pressureBottom = АД диастолическое (нижнее, число)
  saturation = SpO2 % (число)
  breath = ЧДД дыханий/мин (число)

scales — шкалы оценки, ищи числовые значения:
  fim = шкала FIM (функциональная независимость)
  braden = шкала Брейдена (риск пролежней)
  morse = шкала Морзе (риск падений)
  humptiDumpti = шкала Хампти-Дампти (для детей)
  painScore = шкала боли (0-10)

complaints — раздел "Жалобы", "Шағымдары" — полный текст жалоб.

treatmentSummary — раздел "Назначения", "Лечение", "Тағайындалған ем" — полный текст.

outcomeRecommendations — "Рекомендации при выписке", "Ұсынымдар" — полный текст.

outcome — итог лечения: "Улучшение", "Без перемен", "Ухудшение", или null.

━━━ ФОРМАТ ОТВЕТА ━━━
{
  "demographics": {
    "fullName": "string | null",
    "iin": "string | null",
    "birthDate": "ДД.ММ.ГГГГ | null",
    "age": number | null,
    "gender": "Мужской | Женский | null",
    "nationality": "string | null",
    "address": "string | null",
    "school": "string | null"
  },
  "admission": {
    "admissionDate": "ДД.ММ.ГГГГ | null",
    "admissionTime": "ЧЧ:ММ | null",
    "dischargeDate": "ДД.ММ.ГГГГ | null",
    "ward": "string | null",
    "referralOrg": "string | null",
    "admissionType": "string | null",
    "attendingDoctor": "string | null"
  },
  "diagnoses": {
    "main": "string | null",
    "clarify": "string | null",
    "category": "respiratory | neurological | speech | orthopedic | cardiac | null"
  },
  "vitals": {
    "weight": number | null,
    "height": number | null,
    "temperature": number | null,
    "pulse": number | null,
    "pressureTop": number | null,
    "pressureBottom": number | null,
    "saturation": number | null,
    "breath": number | null
  },
  "scales": {
    "fim": number | null,
    "braden": number | null,
    "morse": number | null,
    "humptiDumpti": number | null,
    "painScore": number | null
  },
  "anamnesis": {
    "complaints": "string | null",
    "treatmentSummary": "string | null",
    "outcomeRecommendations": "string | null",
    "outcome": "Улучшение | Без перемен | Ухудшение | null"
  },
  "confidence": "high | medium | low"
}
`;

    async function analyzePdf(file) {
      addSystemMsg(`📄 Анализирую: ${file.name}`);
      setStatus('📄 Читаю PDF...', '');

      try {
        // Read file as base64
        const base64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result.split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });

        setStatus('🤖 AI извлекает данные...', '');

        // Get API key via bridge (small message, no PDF data)
        const creds = await sendExtensionMessage({ type: 'GET_SETTINGS_FOR_PROXY' });
        if (!creds?.apiKey) {
          addMsg('API-ключ не настроен. Откройте расширение и введите ключ.', 'agent', 'error');
          setStatus('Нет ключа', 'error');
          return;
        }

        // Send PDF directly to local proxy — bypass bridge to avoid postMessage size limits
        const proxyResp = await fetch('http://localhost:8001/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: PDF_EXTRACT_PROMPT,
            userMessage: `Прочитай ВЕСЬ документ "${file.name}" внимательно, страница за страницей. Извлеки ВСЕ поля которые описаны в инструкции. Особое внимание: дата рождения, ИИН, время поступления, диагноз с МКБ-кодом, все витальные показатели. Верни только JSON.`,
            pdfBase64: base64,
            pdfMimeType: 'application/pdf',
            apiKey: creds.apiKey,
            model: creds.model,
          })
        });

        if (!proxyResp.ok) {
          const err = await proxyResp.text();
          throw new Error('Proxy error: ' + err.slice(0, 200));
        }

        const proxyData = await proxyResp.json();
        const raw = proxyData?.text || '';
        if (!raw) throw new Error('EMPTY_RESPONSE от сервера');

        // Parse JSON from response
        let data;
        try { data = JSON.parse(raw); }
        catch {
          const m = raw.match(/\{[\s\S]*\}/);
          data = m ? JSON.parse(m[0]) : null;
        }

        if (!data?.demographics) {
          addMsg('Не удалось извлечь данные из PDF. Попробуйте другой файл.', 'agent', 'error');
          setStatus('Готов к работе', '');
          return;
        }

        showPdfPreview(data, file.name);
        setStatus('✓ Данные извлечены', 'success');

      } catch (e) {
        console.error('[PDF]', e);
        addMsg('Ошибка анализа PDF: ' + e.message, 'agent', 'error');
        setStatus('Ошибка', 'error');
      }
    }

    function showPdfPreview(data, filename) {
      const d  = data.demographics   || {};
      const ad = data.admission      || {};
      const dx = data.diagnoses      || {};
      const vt = data.vitals         || {};
      const an = data.anamnesis      || {};

      const fields = [
        ['ФИО',          d.fullName],
        ['ИИН',          d.iin],
        ['Дата рожд.',   d.birthDate],
        ['Возраст',      d.age ? d.age + ' лет' : null],
        ['Пол',          d.gender],
        ['Национальн.',  d.nationality],
        ['Поступил',     ad.admissionDate ? ad.admissionDate + (ad.admissionTime ? ' ' + ad.admissionTime : '') : null],
        ['Выписан',      ad.dischargeDate],
        ['Палата',       ad.ward],
        ['Врач',         ad.attendingDoctor],
        ['Диагноз',      dx.main],
        ['Уточнение',    dx.clarify],
        ['Категория',    dx.category],
        ['Вес/Рост',     (vt.weight && vt.height) ? `${vt.weight} кг / ${vt.height} см` : null],
        ['АД',           (vt.pressureTop && vt.pressureBottom) ? `${vt.pressureTop}/${vt.pressureBottom} мм рт.ст.` : null],
        ['Пульс',        vt.pulse ? vt.pulse + ' уд/мин' : null],
        ['Температура',  vt.temperature ? vt.temperature + '°C' : null],
        ['FIM',          data.scales?.fim ? 'FIM: ' + data.scales.fim : null],
      ].filter(([, v]) => v);

      const confColor = { high:'#2f8f63', medium:'#d18a2f', low:'#c4544d' }[data.confidence] || '#888';

      const card = document.createElement('div');
      card.className = 'da-msg agent';

      const inner = document.createElement('div');
      inner.className = 'da-pdf-card';
      inner.innerHTML = `
        <div class="pdf-name">
          📄 ${escapeHtml(filename)}
          <span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${confColor}22;color:${confColor};font-weight:700;">
            ${data.confidence === 'high' ? 'Высокая уверенность' : data.confidence === 'medium' ? 'Средняя' : 'Низкая'} точность
          </span>
        </div>
        ${fields.map(([l, v]) => `
          <div class="pdf-field">
            <span class="pdf-label">${escapeHtml(l)}:</span>
            <span class="pdf-val">${escapeHtml(String(v))}</span>
          </div>
        `).join('')}
        <div class="pdf-actions">
          <button class="pdf-btn" id="pdf-cancel-btn">Отмена</button>
          <button class="pdf-btn primary" id="pdf-confirm-btn">Добавить пациента</button>
        </div>
      `;

      card.appendChild(inner);
      messages.appendChild(card);
      messages.scrollTop = messages.scrollHeight;

      inner.querySelector('#pdf-cancel-btn').addEventListener('click', () => {
        card.remove();
        addSystemMsg('Отменено');
      });

      inner.querySelector('#pdf-confirm-btn').addEventListener('click', () => {
        addPatientFromPdf(data);
        card.remove();
      });
    }

    function addPatientFromPdf(data) {
      const d  = data.demographics || {};
      const ad = data.admission    || {};
      const dx = data.diagnoses    || {};
      const vt = data.vitals       || {};
      const an = data.anamnesis    || {};

      const newId = String(Date.now()).slice(-6);
      const patient = {
        id:                      newId,
        iin:                     d.iin             || '',
        fullName:                d.fullName        || 'Новый пациент',
        birthDate:               d.birthDate       || '',
        age:                     d.age             || 0,
        gender:                  d.gender          || '',
        nationality:             d.nationality     || '',
        address:                 d.address         || '',
        school:                  d.school          || '',
        ward:                    ad.ward           || 'Не указана',
        admissionDate:           ad.admissionDate  || new Date().toLocaleDateString('ru'),
        admissionTime:           ad.admissionTime  || '',
        dischargeDate:           ad.dischargeDate  || '',
        admissionDiagnosisMain:  dx.main           || '',
        admissionDiagnosisClarify: dx.clarify      || '',
        attendingDoctor:         ad.attendingDoctor || 'МАХМУТХАН АҚЗИРА МАХМУТХАНҚЫЗЫ',
        doctorShort:             'Махмутхан А.М.',
        referralOrg:             ad.referralOrg    || '',
        admissionType:           ad.admissionType  || 'Плановая госпитализация',
        status:                  'current',
        diagnosisCategory:       dx.category       || 'respiratory',
        vitals: {
          weight:        vt.weight        || 0,
          height:        vt.height        || 0,
          temperature:   vt.temperature   || 36.6,
          pulse:         vt.pulse         || 80,
          pressureTop:   vt.pressureTop   || 110,
          pressureBottom: vt.pressureBottom || 70,
          saturation:    vt.saturation    || 98,
          breath:        vt.breath        || 18,
        },
        currentDay: 1,
        complaints:             an.complaints              || '',
        treatmentSummary:       an.treatmentSummary        || '',
        outcomeRecommendations: an.outcomeRecommendations  || '',
        outcome:                an.outcome                 || '',
      };

      // Save to localStorage so data.js picks it up on next load
      try {
        const list = JSON.parse(localStorage.getItem('dmed_dynamic_patients') || '[]');
        const idx  = list.findIndex(p => p.iin === patient.iin && patient.iin);
        if (idx >= 0) list[idx] = patient; else list.push(patient);
        localStorage.setItem('dmed_dynamic_patients', JSON.stringify(list));
      } catch (e) { console.error('[PDF] save error', e); }

      addMsg(`✓ Пациент ${patient.fullName} добавлен (Карта №${patient.id})`, 'agent', 'success');
      addMsg('Перейдите на главную страницу — пациент появится в списке.', 'agent');
      setStatus('✓ Пациент добавлен', 'success');
    }

    // ── Confirmation dialog ──────────────────────────────────────────────────
    function buildConfirmSummary(action) {
      switch (action.action) {
        case 'fill_diary': {
          const vt = action.vitals || {};
          const parts = [
            vt.temperature && `T° ${vt.temperature}`,
            vt.pulse       && `Пульс ${vt.pulse}`,
            vt.pressure_top && `АД ${vt.pressure_top}/${vt.pressure_bottom}`,
            vt.saturation  && `SpO2 ${vt.saturation}%`,
            vt.status      && `Состояние: ${vt.status}`,
          ].filter(Boolean);
          return `📋 Дневниковая запись:\n${parts.join(' · ')}${action.note ? '\n' + action.note.slice(0, 80) : ''}`;
        }
        case 'fill_medical_record': {
          const f = action.fields || {};
          const filled = Object.entries(f).filter(([,v]) => v).map(([k]) => k);
          return `📝 Медицинская запись:\nЗаполнить разделы: ${filled.join(', ')}`;
        }
        case 'add_diagnosis':
          return `🔬 Добавить диагноз:\n${action.icd_code || ''} ${action.icd_name || ''}\nТип: ${action.diag_type || '—'}`;
        case 'add_assignment':
          return `💊 Добавить назначение:\n${action.procedure_name || action.procedure_code}\nСеансов: ${action.sessions || 10}`;
        case 'create_schedule':
          return `📅 Сгенерировать расписание:\n${(action.procedures || []).length} процедур`;
        default:
          return 'Выполнить действие?';
      }
    }

    function askConfirmation(action) {
      return new Promise(resolve => {
        const summary = buildConfirmSummary(action);
        const wrap = document.createElement('div');
        wrap.className = 'da-msg agent';

        const bubble = document.createElement('div');
        bubble.className = 'da-bubble';
        bubble.style.cssText = 'background:#fff8e1;border:1px solid #f0c040;border-radius:14px;padding:10px 13px;';
        bubble.innerHTML = `
          <div style="font-size:12px;white-space:pre-wrap;margin-bottom:10px;">${escapeHtml(summary)}</div>
          <div style="display:flex;gap:8px;">
            <button id="confirm-yes" style="flex:1;padding:6px;background:#1a6b7c;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">✓ Подтвердить</button>
            <button id="confirm-no"  style="flex:1;padding:6px;background:#fff;color:#c4544d;border:1px solid #c4544d;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">✕ Отмена</button>
          </div>`;

        wrap.appendChild(bubble);
        messages.appendChild(wrap);
        messages.scrollTop = messages.scrollHeight;

        bubble.querySelector('#confirm-yes').addEventListener('click', () => {
          wrap.remove();
          resolve(true);
        });
        bubble.querySelector('#confirm-no').addEventListener('click', () => {
          wrap.remove();
          resolve(false);
        });
      });
    }

    // ── Voice ────────────────────────────────────────────────────────────────
    function toggleListen() {
      if (isListening) {
        isListening = false;
        recognizer.stop();
        setFabState('');
        setStatus('Готов к работе', '');
      } else {
        openPanel();
        const ok = recognizer.start();
        if (!ok) addMsg('Не удалось запустить микрофон', 'agent', 'error');
      }
    }

    recognizer.onStart = () => {
      isListening = true;
      currentFinalTranscript = '';
      setFabState('listening');
      setStatus('🎤 Слушаю...', 'listening');
    };

    recognizer.onInterim = (text) => {
      setStatus('🎤 ' + text, 'listening');
    };

    recognizer.onFinal = (text) => {
      currentFinalTranscript += text + ' ';
      clearTimeout(recognizer._processTimer);
      recognizer._processTimer = setTimeout(() => {
        const utt = currentFinalTranscript.trim();
        if (utt) {
          addMsg(utt, 'user');
          processUtterance(utt);
          currentFinalTranscript = '';
        }
      }, 800);
    };

    recognizer.onError = (errType) => {
      if (errType === 'not-allowed') {
        addMsg('Доступ к микрофону запрещён. Разрешите в настройках браузера.', 'agent', 'error');
        setFabState('error');
      }
    };

    recognizer.onEnd = () => {
      if (!isListening) { setFabState(''); setStatus('Готов к работе', ''); }
    };

    // ── API key check ────────────────────────────────────────────────────────
    (async function checkApiKey() {
      try {
        const resp = await sendExtensionMessage({ type: 'GET_API_KEY_STATUS' });
        currentProviderLabel = resp?.providerLabel || 'AI';
        document.getElementById('da-provider-label').textContent =
          resp?.hasKey ? `${currentProviderLabel} подключён` : `⚠ Нужен API-ключ ${currentProviderLabel}`;
        if (!resp?.hasKey) {
          addMsg(
            `API-ключ ${currentProviderLabel} не настроен. Откройте расширение и введите ключ.`,
            'agent', 'error'
          );
        }
      } catch (e) { /* extension not loaded */ }
    })();

    // ── Event listeners ──────────────────────────────────────────────────────
    fab.addEventListener('click', () => {
      if (!panel.classList.contains('open')) { openPanel(); return; }
      toggleListen();
    });

    closeBtn.addEventListener('click', closePanel);

    micBtn.addEventListener('click', toggleListen);

    // Text input — send on Enter or send button
    function handleSend() {
      const text = textInput.value.trim();
      if (!text) return;
      textInput.value = '';
      addMsg(text, 'user');
      processUtterance(text);
    }

    sendBtn.addEventListener('click', handleSend);
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });

    // PDF upload
    pdfBtn.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) analyzePdf(file);
      pdfInput.value = '';
    });

    // Hotkey
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        openPanel();
        toggleListen();
      }
    });

    // Expose LLM to page scripts (used by protocol generator etc.)
    window.__damumedLlm = async function (payload) {
      const creds = await sendExtensionMessage({ type: 'GET_SETTINGS_FOR_PROXY' });
      if (!creds?.apiKey) throw new Error('API_KEY_MISSING');
      const resp = await fetch(creds.serverUrl + '/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: payload.systemPrompt,
          userMessage:  payload.userMessage,
          apiKey:       creds.apiKey,
          model:        creds.model,
        })
      });
      if (!resp.ok) throw new Error('Proxy error ' + resp.status);
      const d = await resp.json();
      const raw = d?.text || '';
      try { return JSON.parse(raw); }
      catch { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : raw; }
    };

    // Welcome
    addMsg('Привет! Я AI-ассистент Damumed.\n\nМогу заполнять медицинские записи, дневники, назначения — голосом или текстом.\n\nЧтобы добавить нового пациента — нажмите 📎 и загрузите PDF.', 'agent');

    console.log('[Damumed Assistant] initialized');
  }

  init();
})();
