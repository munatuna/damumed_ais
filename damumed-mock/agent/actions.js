// agent/actions.js — роутер действий агента.
// Универсальный внешний агент: заполняет формы напрямую через DOM,
// не зависит от кастомных событий или глобалов конкретной страницы.

(function () {
  'use strict';

  // ── Semantic DOM helpers (resilient to class/id changes) ─────────────────
  function findButton(labels, scope) {
    const root = scope || document;
    const labelsLower = labels.map(l => l.toLowerCase().trim());
    const candidates = root.querySelectorAll('button, a[href], [role="button"], input[type="button"], input[type="submit"]');
    for (const el of candidates) {
      const text = (el.textContent || el.value || el.title || el.getAttribute('aria-label') || '').toLowerCase().trim();
      if (labelsLower.some(l => text.includes(l) || l.includes(text.slice(0, 12)))) return el;
    }
    return null;
  }

  function findInput(labels, scope) {
    const root = scope || document;
    const labelsLower = labels.map(l => l.toLowerCase());
    for (const el of root.querySelectorAll('input, textarea, select')) {
      const id = (el.id || '').toLowerCase();
      const name = (el.name || '').toLowerCase();
      const placeholder = (el.placeholder || '').toLowerCase();
      const label = root.querySelector(`label[for="${el.id}"]`);
      const labelText = (label?.textContent || '').toLowerCase();
      if (labelsLower.some(l => id.includes(l) || name.includes(l) || placeholder.includes(l) || labelText.includes(l))) return el;
    }
    return null;
  }

  function clickButton(labels, scope) {
    const btn = findButton(labels, scope);
    if (btn) { btn.click(); return true; }
    return false;
  }
  // ─────────────────────────────────────────────────────────────────────────

  function detectCurrentPage() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('id') || null;
    const type = params.get('type') || null;

    let page = 'unknown';
    if (path.endsWith('index.html') || path.endsWith('/')) page = 'patients';
    else if (path.endsWith('patient.html')) page = 'patient';
    else if (path.endsWith('medical-record.html')) page = 'medical_record';
    else if (path.endsWith('diary.html')) page = 'diary';
    else if (path.endsWith('assignments.html')) page = 'assignments';

    return { page, patientId: pid, recordType: type };
  }

  function normalizeName(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[әä]/g, 'а')
      .replace(/[ғ]/g, 'г')
      .replace(/[қ]/g, 'к')
      .replace(/[ң]/g, 'н')
      .replace(/[ө]/g, 'о')
      .replace(/[ұү]/g, 'у')
      .replace(/[һ]/g, 'х')
      .replace(/[і]/g, 'и')
      .replace(/[ё]/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scorePatientMatch(query, candidate) {
    const queryNorm = normalizeName(query);
    const candidateNorm = normalizeName(candidate);
    if (!queryNorm || !candidateNorm) return 0;
    if (queryNorm === candidateNorm) return 1000;
    if (candidateNorm.includes(queryNorm) || queryNorm.includes(candidateNorm)) return 800;

    const queryParts = queryNorm.split(' ').filter(Boolean);
    const candidateParts = candidateNorm.split(' ').filter(Boolean);
    let score = 0;

    queryParts.forEach(part => {
      if (candidateParts.includes(part)) {
        score += 120;
        return;
      }
      const partial = candidateParts.find(token =>
        token.startsWith(part) ||
        part.startsWith(token) ||
        levenshtein(part, token) <= 1
      );
      if (partial) score += 70;
    });

    if (queryParts.length === 1 && candidateParts.some(token => levenshtein(queryParts[0], token) <= 2)) {
      score += 90;
    }

    return score;
  }

  function levenshtein(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;

    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[rows - 1][cols - 1];
  }

  function resolvePatientMatch(patientName) {
    if (!patientName || !window.PATIENTS?.length) return null;

    const ranked = window.PATIENTS
      .map(patient => ({
        patient,
        score: scorePatientMatch(patientName, patient.fullName)
      }))
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.score >= 70 ? ranked[0].patient : null;
  }

  function buildPageContext() {
    const { page, patientId, recordType } = detectCurrentPage();
    const ctx = { page, patientId, recordType };

    const nameEl = document.getElementById('patient-name');
    if (nameEl) ctx.currentPatientName = nameEl.textContent.trim();
    if (window.PATIENTS && patientId) {
      const patient = window.PATIENTS.find(p => p.id === patientId);
      if (patient) {
        ctx.currentDay = patient.currentDay || null;
        ctx.diagnosisCategory = patient.diagnosisCategory || null;
      }
    }

    // Читаем список пациентов: сначала из глобала (мок), потом из DOM (реальная система)
    if (window.PATIENTS) {
      ctx.availablePatients = window.PATIENTS.map(p => ({ id: p.id, name: p.fullName }));
    } else {
      // Универсальный fallback: ищем ссылки на карты пациентов в DOM
      const patientLinks = [...document.querySelectorAll('a[href*="patient"]')];
      if (patientLinks.length) {
        ctx.availablePatients = patientLinks.map(a => {
          const idMatch = a.href.match(/[?&]id=([^&]+)/);
          return { id: idMatch ? idMatch[1] : null, name: a.textContent.trim() };
        }).filter(p => p.id);
      }
    }

    return ctx;
  }

  function handleNavigate(params) {
    const { page, patient_id, patient_name, record_type } = params;
    const { patientId: currentPid } = detectCurrentPage();

    let targetPid = patient_id || currentPid;

    // Fallback: поиск по имени если LLM не вернула ID
    if (!patient_id && patient_name && window.PATIENTS) {
      const match = resolvePatientMatch(patient_name);
      if (match) targetPid = match.id;
    }

    let url = null;
    switch (page) {
      case 'patients':      url = 'index.html'; break;
      case 'patient':       url = `patient.html?id=${targetPid || '352'}`; break;
      case 'medical_record':
        url = `medical-record.html?id=${targetPid || '352'}`;
        if (record_type) url += `&type=${record_type}`;
        break;
      case 'diary':         url = `diary.html?id=${targetPid || '352'}`; break;
      case 'assignments':   url = `assignments.html?id=${targetPid || '352'}`; break;
      default: return { ok: false, message: `Неизвестная страница: ${page}` };
    }

    window.location.href = url;
    return { ok: true, message: `Переход на ${page}`, url };
  }

  // Вспомогательная: заполнить поле и добавить анимацию
  function fillField(selector, value) {
    if (!value && value !== 0) return false;
    let el;
    if (typeof selector === 'string') {
      // Try data-key, then id, then CSS selector
      el = document.querySelector(`[data-key="${selector}"]`) ||
           document.querySelector(`[data-vital-key="${selector}"]`) ||
           document.getElementById(selector.replace(/^#/, '')) ||
           document.querySelector(selector);
    } else {
      el = selector;
    }
    if (!el) return false;
    if (window.__DamumedFiller) {
      window.__DamumedFiller.setFieldValue(el, String(value));
    } else {
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    el.classList.add('ai-filled-animation');
    setTimeout(() => el.classList.remove('ai-filled-animation'), 1500);
    return true;
  }

  // Vital key → possible label texts for semantic fallback
  const VITAL_LABELS = {
    temperature:      ['температура', 'temp', 't°', 'temperature'],
    pulse:            ['пульс', 'чсс', 'pulse', 'уд/мин'],
    pressure_top:     ['систолическое', 'ад верх', 'давление верх', 'systolic'],
    pressure_bottom:  ['диастолическое', 'ад ниж', 'давление ниж', 'diastolic'],
    breath:           ['чдд', 'дыхание', 'breath', 'resp'],
    saturation:       ['сатурация', 'spo2', 'saturation', 'кислород'],
    weight:           ['вес', 'масса', 'weight'],
    status:           ['состояние', 'статус', 'status'],
  };

  function handleFillDiary(params) {
    const { page } = detectCurrentPage();
    if (page !== 'diary') return { ok: false, message: 'Сначала откройте дневниковую запись' };

    const { vitals = {}, note, procedures_done = [] } = params;
    const filled = [];

    Object.entries(vitals).forEach(([key, value]) => {
      if (!value && value !== 0) return;
      // Try data-vital-key first, then semantic label search
      let el = document.querySelector(`[data-vital-key="${key}"]`);
      if (!el) el = findInput(VITAL_LABELS[key] || [key]);
      if (el && fillField(el, value)) filled.push(key);
    });

    // Note field — try data-key, then semantic
    if (note) {
      let noteEl = document.querySelector('textarea[data-key="note"]') ||
                   findInput(['итог', 'запись', 'дневник', 'описание', 'note']);
      if (noteEl && fillField(noteEl, note)) filled.push('note');
    }

    // Procedure checkboxes
    procedures_done.forEach(name => {
      document.querySelectorAll('[data-proc], input[type="checkbox"]').forEach(cb => {
        const label = (cb.getAttribute('data-proc') || cb.closest('label')?.textContent || '').toLowerCase();
        if (label.includes(name.toLowerCase())) cb.checked = true;
      });
    });

    return { ok: true, message: `Заполнено полей: ${filled.length}`, fields: filled };
  }

  // Маппинг полей LLM → data-key + semantic label fallbacks
  const FIELD_KEY_MAP = {
    complaints:          { key: 'complaints',       labels: ['жалобы', 'complaints'] },
    anamnesis_disease:   { key: 'anamnesis_disease', labels: ['анамнез заболевания', 'история болезни'] },
    anamnesis_life:      { key: 'anamnesis_life',    labels: ['анамнез жизни', 'жизнь'] },
    allergy_anamnesis:   { key: 'allergy',           labels: ['аллергия', 'аллергол'] },
    objective:           { key: 'objective',         labels: ['объективно', 'объективные данные', 'осмотр'] },
    diagnosis_rationale: { key: 'diagnosis',         labels: ['обоснование диагноза', 'диагноз'] },
    instrumental:        { key: 'research',          labels: ['исследования', 'инструментальные', 'анализы'] },
    treatment:           { key: 'final',             labels: ['лечение', 'назначения', 'план лечения'] },
    outcome:             { key: 'outcome',           labels: ['исход', 'результат', 'динамика'] },
    discharge_summary:   { key: 'discharge',         labels: ['эпикриз', 'выписка', 'выписной'] },
  };

  function handleFillMedicalRecord(params) {
    const { page } = detectCurrentPage();
    if (page !== 'medical_record') return { ok: false, message: 'Сначала откройте медицинскую запись' };

    const fields = params.fields || {};
    const filled = [];

    Object.entries(fields).forEach(([key, value]) => {
      if (!value) return;
      const mapping = FIELD_KEY_MAP[key];
      const dataKey = mapping?.key || key;

      // Try data-key first, then semantic label search
      let el = document.querySelector(`textarea[data-key="${dataKey}"]`) ||
               document.querySelector(`[data-key="${dataKey}"]`);
      if (!el && mapping?.labels) el = findInput(mapping.labels);
      if (el && fillField(el, value)) filled.push(key);
    });

    return { ok: true, message: `Заполнено разделов: ${filled.length}`, sections: filled };
  }

  function handleCreateSchedule(params) {
    const { page, patientId } = detectCurrentPage();
    if (page !== 'assignments') {
      return {
        ok: false,
        message: 'Сначала откройте вкладку «Назначения»',
        suggestNavigate: `assignments.html?id=${patientId || '352'}`
      };
    }

    const patient = window.PATIENTS ? window.PATIENTS.find(p => p.id === patientId) : null;
    const procedures = (params.procedures && params.procedures.length)
      ? params.procedures
      : (window.__DamumedScheduler?.suggestForCategory(patient?.diagnosisCategory) || []);
    if (!procedures.length) return { ok: false, message: 'Список процедур пустой' };

    const schedule = window.__DamumedScheduler
      ? window.__DamumedScheduler.generate(procedures, patient ? patient.currentDay : 1)
      : procedures.map(code => ({ code, days: Array(9).fill('scheduled') }));

    // Вызываем renderSchedule напрямую (MAIN world) или через событие как fallback
    if (typeof window.renderSchedule === 'function') {
      window.renderSchedule(schedule);
    } else {
      window.dispatchEvent(new CustomEvent('dmed-fill-schedule', { detail: { schedule } }));
    }

    const source = params.procedures?.length ? 'по команде врача' : 'по категории диагноза';
    return { ok: true, message: `Сформировано ${procedures.length} процедур × 9 дней (${source})`, procedures };
  }

  function handleMarkDone(params) {
    const { page, patientId } = detectCurrentPage();
    const { procedure_code, procedure_name } = params;

    let code = procedure_code;
    if (!code && procedure_name && window.PROCEDURES) {
      const target = procedure_name.toLowerCase();
      for (const [c, p] of Object.entries(window.PROCEDURES)) {
        if (p.name.toLowerCase().includes(target) || target.includes(p.name.toLowerCase())) {
          code = c;
          break;
        }
      }
    }

    if (!code) return { ok: false, message: 'Не удалось определить процедуру' };

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const procName = (window.PROCEDURES && window.PROCEDURES[code]) ? window.PROCEDURES[code].name : (procedure_name || code);

    if (page === 'assignments') {
      const patient = window.PATIENTS ? window.PATIENTS.find(p => p.id === patientId) : null;
      const today = patient ? patient.currentDay - 1 : 0;

      // Try multiple selector strategies (resilient to markup changes)
      const btn =
        document.querySelector(`tr[data-procedure-code="${code}"] td[data-day="${today}"] [data-action="complete"]`) ||
        document.querySelector(`tr[data-proc-code="${code}"] td[data-day="${today}"] button`) ||
        document.querySelector(`[data-code="${code}"][data-day="${today}"]`);

      if (btn) {
        btn.click();
      } else {
        window.dispatchEvent(new CustomEvent('dmed-mark-done', {
          detail: { code, day: today, timestamp: now.toISOString(), timeStr, dateStr }
        }));
      }

      return { ok: true, message: `✓ ${procName} — выполнен в ${timeStr}` };
    }

    // Other pages — try data-action, data-code, or semantic text
    const btn =
      document.querySelector(`button[data-action="mark-done"][data-code="${code}"]`) ||
      document.querySelector(`[data-code="${code}"]`) ||
      findButton(['отметить', 'выполнено', 'done', procName]);

    if (btn) {
      btn.click();
      return { ok: true, message: `✓ ${procName} — выполнен в ${timeStr}` };
    }

    return { ok: false, message: 'Не найдена процедура на странице для отметки' };
  }

  function handleAddDiagnosis(params) {
    const { page, patientId } = detectCurrentPage();

    if (page !== 'diagnoses') {
      const pid = patientId || '352';
      window.location.href = `diagnoses.html?id=${pid}&voice_add=1&icd=${encodeURIComponent(params.icd_code||'')}` +
        `&name=${encodeURIComponent(params.icd_name||'')}&dtype=${encodeURIComponent(params.diag_type||'')}`;
      return { ok: true, message: 'Открываю страницу диагнозов для добавления...' };
    }

    // Semantic: find "add" button by text/title/icon
    const btnAdd = findButton(['+', 'добавить', 'добавить диагноз', 'новый']) ||
                   document.getElementById('btn-add');
    if (!btnAdd) return { ok: false, message: 'Кнопка добавления диагноза не найдена на странице' };
    btnAdd.click();

    setTimeout(() => {
      // Fill ICD — find by placeholder, label or id
      const icdEl = findInput(['мкб', 'код', 'icd', 'диагноз']) || document.getElementById('f-icd');
      if (icdEl && (params.icd_code || params.icd_name)) {
        fillField(icdEl, (params.icd_code ? params.icd_code + ' ' : '') + (params.icd_name || ''));
      }
      const typeEl = findInput(['тип диагноза', 'diag-type', 'тип']) || document.getElementById('f-diag-type');
      if (typeEl && params.diag_type) fillField(typeEl, params.diag_type);
      const kindEl = findInput(['вид', 'госпитализация']) || document.getElementById('f-kind');
      if (kindEl && params.kind) fillField(kindEl, params.kind);
      const noteEl = findInput(['примечание', 'note']) || document.getElementById('f-note');
      if (noteEl && params.note) fillField(noteEl, params.note);

      setTimeout(() => {
        const saveBtn = findButton(['сохранить', 'save', 'ок', 'применить']) ||
                        document.getElementById('btn-save');
        if (saveBtn) saveBtn.click();
      }, 400);
    }, 150);

    return { ok: true, message: `Диагноз ${params.icd_code || params.icd_name || ''} добавлен` };
  }

  function handleAddAssignment(params) {
    const { page, patientId } = detectCurrentPage();
    const pid = patientId || '352';

    if (page !== 'assignments') {
      window.location.href = `assignments.html?id=${pid}&voice_add=1` +
        `&code=${encodeURIComponent(params.procedure_code||'')}` +
        `&pname=${encodeURIComponent(params.procedure_name||'')}` +
        `&sessions=${params.sessions||10}`;
      return { ok: true, message: 'Открываю назначения...' };
    }

    // On assignments page — try to add procedure row
    const code = params.procedure_code;
    const name = params.procedure_name || code;
    const sessions = params.sessions || 10;

    if (typeof window.addProcedureVoice === 'function') {
      window.addProcedureVoice(code, name, sessions);
      return { ok: true, message: `${name} добавлен (${sessions} сеансов)` };
    }

    // Fallback: dispatch event for assignments.html to handle
    window.dispatchEvent(new CustomEvent('dmed-add-procedure', {
      detail: { code, name, sessions }
    }));
    return { ok: true, message: `${name} добавлен (${sessions} сеансов)` };
  }

  function handleGenerateProtocol(params) {
    const { page } = detectCurrentPage();

    if (page !== 'diagnoses') {
      const { patientId } = detectCurrentPage();
      window.location.href = `diagnoses.html?id=${patientId || '352'}&voice_proto=1`;
      return { ok: true, message: 'Открываю диагнозы для генерации протокола...' };
    }

    // Trigger openProtocol for the first diagnosis
    if (typeof window.openProtocol === 'function' && window.diagnoses?.length) {
      const diag = params.icd_code
        ? (window.diagnoses.find(d => d.icd?.includes(params.icd_code)) || window.diagnoses[0])
        : window.diagnoses[0];
      window.openProtocol(diag);
      return { ok: true, message: `Генерирую протокол для ${diag.icd}...` };
    }

    return { ok: false, message: 'Откройте страницу «Диагнозы» и попробуйте снова' };
  }

  function dispatchAction(action) {
    if (!action || !action.action) return { ok: false, message: 'Некорректный ответ от модели' };

    switch (action.action) {
      case 'navigate':           return handleNavigate(action);
      case 'fill_diary':         return handleFillDiary(action);
      case 'fill_medical_record':return handleFillMedicalRecord(action);
      case 'create_schedule':    return handleCreateSchedule(action);
      case 'mark_done':          return handleMarkDone(action);
      case 'add_diagnosis':      return handleAddDiagnosis(action);
      case 'add_assignment':     return handleAddAssignment(action);
      case 'generate_protocol':  return handleGenerateProtocol(action);
      case 'unknown':            return { ok: false, message: action.message || 'Команда не распознана' };
      default:                   return { ok: false, message: `Неизвестное действие: ${action.action}` };
    }
  }

  window.__DamumedActions = { detectCurrentPage, buildPageContext, dispatchAction };
})();
