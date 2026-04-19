// agent/scheduler.js — генератор расписания с простым учётом конфликтов.
// LLM решает КАКИЕ процедуры назначить, а этот модуль раскладывает их по 9 рабочим дням.

(function () {
  'use strict';

  /**
   * Генерирует расписание для списка процедур.
   *
   * @param {string[]} procedureCodes - массив кодов из справочника PROCEDURES
   * @param {number} currentDay - текущий день курса (1..14); дни < currentDay помечаются 'done'
   * @returns {Array<{code: string, days: Array<'done'|'scheduled'|'empty'>, assignedSlots: string[]}>}
   */
  function generate(procedureCodes, currentDay = 1) {
    if (!window.PROCEDURES) {
      console.error('[Scheduler] window.PROCEDURES не загружены');
      return [];
    }

    // Сортируем процедуры по времени слота (так расписание выглядит логично сверху вниз)
    const valid = procedureCodes
      .filter(code => window.PROCEDURES[code])
      .sort((a, b) => {
        const slotA = window.PROCEDURES[a].slot || '12:00';
        const slotB = window.PROCEDURES[b].slot || '12:00';
        return slotA.localeCompare(slotB);
      });

    const dayBookings = Array.from({ length: 9 }, () => new Set());

    // Генерируем дни: количество берём из proc.sessions (или 9 если не задано).
    // Для одноразовых консультаций ставим на ближайший доступный день, остальные распределяем последовательно.
    return valid.map((code) => {
      const proc = window.PROCEDURES[code];
      const totalSessions = proc.sessions || 9;
      const days = [];
      const assignedSlots = Array(9).fill('');
      const targetDays = chooseProcedureDays(totalSessions, currentDay);

      for (let i = 0; i < 9; i++) {
        const dayNum = i + 1;
        if (dayNum > totalSessions) {
          days.push('empty');
        } else if (dayNum < currentDay) {
          days.push('done');
        } else {
          const shouldSchedule = targetDays.has(dayNum);
          if (!shouldSchedule) {
            days.push('empty');
            continue;
          }

          const slot = reserveSlot(dayBookings[i], proc);
          assignedSlots[i] = slot;
          days.push('scheduled');
        }
      }

      return { code, days, assignedSlots };
    });
  }

  function chooseProcedureDays(totalSessions, currentDay) {
    const remainingDays = [];
    for (let day = Math.max(1, currentDay); day <= 9; day++) {
      remainingDays.push(day);
    }

    if (!remainingDays.length) return new Set();
    if (totalSessions <= 1) return new Set([remainingDays[0]]);

    const selected = new Set();
    const cappedSessions = Math.min(totalSessions, 9);
    let index = 0;

    while (selected.size < cappedSessions && remainingDays.length) {
      selected.add(remainingDays[index]);
      index = Math.min(index + 1, remainingDays.length - 1);
      if (selected.size < cappedSessions && index === remainingDays.length - 1) {
        for (const day of remainingDays) {
          if (selected.size >= cappedSessions) break;
          selected.add(day);
        }
      }
    }

    for (let day = 1; day < currentDay; day++) {
      if (selected.size >= cappedSessions) break;
      selected.add(day);
    }

    return selected;
  }

  function reserveSlot(dayBookings, proc) {
    let slot = proc.slot || '12:00';
    let attempts = 0;

    while (attempts < 12) {
      const specialistKey = `specialist|${proc.specialist}|${slot}`;
      const roomKey = `room|${proc.room}|${slot}`;
      if (!dayBookings.has(specialistKey) && !dayBookings.has(roomKey)) {
        dayBookings.add(specialistKey);
        dayBookings.add(roomKey);
        return slot;
      }
      slot = shiftSlot(slot, 10);
      attempts += 1;
    }

    dayBookings.add(`specialist|${proc.specialist}|${slot}`);
    dayBookings.add(`room|${proc.room}|${slot}`);
    return slot;
  }

  /**
   * Сдвигает слот времени "HH:MM" на N минут
   */
  function shiftSlot(slot, minutes) {
    const [h, m] = slot.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  /**
   * Возвращает рекомендованный набор процедур по категории диагноза.
   * Используется как fallback если LLM не дала список.
   */
  function suggestForCategory(category) {
    return (window.PROCEDURE_SETS && window.PROCEDURE_SETS[category]) || [];
  }

  // Экспорт
  window.__DamumedScheduler = { generate, suggestForCategory, shiftSlot };
})();
