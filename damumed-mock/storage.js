// storage.js — localStorage persistence for Dmed mock

window.DmedStorage = (function () {
  function k(type, pid, sub) {
    return 'dmed_' + type + '_' + pid + (sub ? '_' + sub : '');
  }
  function get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  return {
    // ── Medical records ──────────────────────────────────────────────
    saveRecord(pid, rtype, data) {
      set(k('record', pid, rtype), data);
      const idx = get(k('records_idx', pid)) || [];
      const i = idx.findIndex(r => r.rtype === rtype);
      const entry = { rtype, typeLabel: data.typeLabel, savedAt: data.savedAt, dateStr: data.dateStr, signed: data.signed };
      if (i >= 0) idx[i] = entry; else idx.unshift(entry);
      set(k('records_idx', pid), idx);
    },
    getRecord: (pid, rtype) => get(k('record', pid, rtype)),
    getRecordsIndex: (pid) => get(k('records_idx', pid)) || [],

    // ── Diary entries ────────────────────────────────────────────────
    saveDiary(pid, data) {
      const kk = k('diaries', pid);
      const list = get(kk) || [];
      const i = list.findIndex(d => d.id === data.id);
      if (i >= 0) list[i] = data; else list.unshift(data);
      set(kk, list.slice(0, 30));
    },
    getDiaries: (pid) => get(k('diaries', pid)) || [],

    // ── Schedule ─────────────────────────────────────────────────────
    saveSchedule: (pid, s) => set(k('schedule', pid), s),
    getSchedule: (pid) => get(k('schedule', pid)),
    patchScheduleCell(pid, code, dayIdx, status) {
      const s = this.getSchedule(pid);
      if (!s) return;
      const row = s.find(r => r.code === code);
      if (!row) return;
      const cell = row.days[dayIdx];
      if (cell && typeof cell === 'object') {
        cell.status = status;
      } else {
        row.days[dayIdx] = status;
      }
      this.saveSchedule(pid, s);
    },

    // ── Specialist notes / execution ────────────────────────────────
    saveSpecialistNote(pid, specialistId, code, data) {
      const kk = k('specialist_notes', pid, specialistId);
      const list = get(kk) || [];
      const note = Object.assign({
        id: 'note_' + Date.now(),
        code,
        savedAt: new Date().toISOString()
      }, data);
      list.unshift(note);
      set(kk, list.slice(0, 50));
    },
    getSpecialistNotes(pid, specialistId) {
      return get(k('specialist_notes', pid, specialistId)) || [];
    },
    getSpecialistNotesByCode(pid, specialistId, code) {
      return this.getSpecialistNotes(pid, specialistId).filter(n => n.code === code);
    },

    // ── Psychologist sheet ──────────────────────────────────────────
    savePsychologistSheet(pid, data) {
      set(k('psych_sheet', pid), Object.assign({
        savedAt: new Date().toISOString()
      }, data));
    },
    getPsychologistSheet(pid) {
      return get(k('psych_sheet', pid)) || null;
    },

    // ── Dynamic patients (added via PDF upload) ──────────────────────
    addPatient(patientObj) {
      const list = get('dmed_dynamic_patients') || [];
      const i = list.findIndex(p => p.id === patientObj.id || p.iin === patientObj.iin);
      if (i >= 0) list[i] = patientObj; else list.push(patientObj);
      set('dmed_dynamic_patients', list);
    },
    getDynamicPatients: () => get('dmed_dynamic_patients') || [],
    clearDynamicPatients: () => localStorage.removeItem('dmed_dynamic_patients'),

    // ── Patient extras (blood group, current day override) ───────────
    savePatientExtra(pid, fields) {
      const d = get(k('patient_extra', pid)) || {};
      Object.assign(d, fields);
      set(k('patient_extra', pid), d);
    },
    getPatientExtra: (pid) => get(k('patient_extra', pid)) || {},
  };
})();
