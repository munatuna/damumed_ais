// specialist-common.js — helpers for specialist-side mock views

(function () {
  'use strict';

  function getSpecialistFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const specialistId = params.get('specialist') || 'massager';
    return window.SPECIALISTS[specialistId] || window.SPECIALISTS.massager;
  }

  function getTodayDayIndex(patient) {
    return Math.max(0, Math.min(13, (patient.currentDay || 1) - 1));
  }

  function buildFallbackSchedule(patient) {
    const procSet = window.PROCEDURE_SETS[patient.diagnosisCategory] || [];
    return procSet.map(code => ({
      code,
      days: Array(14).fill('scheduled').map((_, i) => i < getTodayDayIndex(patient) ? 'done' : 'scheduled')
    }));
  }

  function getPatientSchedule(patient) {
    return window.DmedStorage.getSchedule(patient.id) || buildFallbackSchedule(patient);
  }

  function getAssignmentsForSpecialist(specialistId, mode = 'today') {
    const specialist = window.SPECIALISTS[specialistId];
    if (!specialist) return [];

    const items = [];

    window.PATIENTS.forEach(patient => {
      const todayIdx = getTodayDayIndex(patient);
      const schedule = getPatientSchedule(patient);

      schedule.forEach(row => {
        const proc = window.PROCEDURES[row.code];
        if (!proc) return;
        if (!specialist.procedureCodes.includes(row.code)) return;

        row.days.forEach((status, dayIdx) => {
          if (status === 'empty') return;
          if (mode === 'today' && dayIdx !== todayIdx) return;
          if (mode === 'upcoming' && dayIdx < todayIdx) return;

          items.push({
            patient,
            procedure: proc,
            code: row.code,
            status,
            dayIdx,
            todayIdx,
            isToday: dayIdx === todayIdx
          });
        });
      });
    });

    return items.sort((a, b) => {
      if (a.dayIdx !== b.dayIdx) return a.dayIdx - b.dayIdx;
      return (a.procedure.slot || '').localeCompare(b.procedure.slot || '');
    });
  }

  function getQueueForSpecialist(specialistId) {
    const items = getAssignmentsForSpecialist(specialistId, 'today');
    const grouped = new Map();

    items.forEach(item => {
      const key = item.patient.id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          patient: item.patient,
          procedures: [],
          allDone: true
        });
      }
      const group = grouped.get(key);
      group.procedures.push(item);
      if (item.status !== 'done') group.allDone = false;
    });

    return Array.from(grouped.values());
  }

  function saveProcedureExecution({ patientId, specialistId, code, dayIdx, note, procedureName, statusText }) {
    window.DmedStorage.patchScheduleCell(patientId, code, dayIdx, 'done');
    window.DmedStorage.saveSpecialistNote(patientId, specialistId, code, {
      note,
      procedureName,
      statusText,
      dayIdx
    });
  }

  function getPatientById(pid) {
    return window.PATIENTS.find(p => p.id === pid) || window.PATIENTS[0];
  }

  function formatDayLabel(patient, dayIdx) {
    return `День ${dayIdx + 1} курса`;
  }

  function buildSpecialistNav(current, specialistId) {
    const suffix = `?specialist=${specialistId}`;
    return `
      <nav class="dmed-navbar">
        <div class="logo">Dmed.Стационар</div>
        <ul class="nav-menu">
          <li><a href="specialist-queue.html${suffix}"${current === 'queue' ? ' class="active"' : ''}>Очередь</a></li>
          <li><a href="specialist-assignments.html${suffix}"${current === 'assignments' ? ' class="active"' : ''}>Мои назначения</a></li>
        </ul>
        <div class="user-info">
          <div class="name">${window.SPECIALISTS[specialistId].name}</div>
          <div>${window.SPECIALISTS[specialistId].role} | ${window.SPECIALISTS[specialistId].office}</div>
        </div>
      </nav>
    `;
  }

  window.DmedSpecialist = {
    getSpecialistFromUrl,
    getPatientById,
    getTodayDayIndex,
    getPatientSchedule,
    getAssignmentsForSpecialist,
    getQueueForSpecialist,
    saveProcedureExecution,
    formatDayLabel,
    buildSpecialistNav
  };
})();
