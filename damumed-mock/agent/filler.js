// agent/filler.js — утилиты заполнения DOM.
// Основная логика заполнения реализована в самих HTML-страницах мокапа через обработку
// CustomEvent (dmed-fill-diary, dmed-fill-record, dmed-fill-schedule). Это делает
// мокап самодостаточным и тестируемым без расширения.
//
// Здесь — вспомогательные функции, если понадобится более низкоуровневое воздействие
// на DOM (например, для работы с реальным Дамумедом, где наших CustomEvent не будет).

(function () {
  'use strict';

  /**
   * Безопасная установка значения в input/textarea с триггером события 'input',
   * чтобы реактивные фреймворки (Vue/React/Kendo) увидели изменение.
   */
  function setFieldValue(selector, value) {
    const el = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if (!el) return false;
    if (el.tagName === 'SELECT') {
      el.value = value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Для input/textarea используем native setter чтобы React не кешировал значение
      const nativeSetter = Object.getOwnPropertyDescriptor(
        el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeSetter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  /**
   * Находит поле по нескольким признакам: id, name, placeholder, label text.
   */
  function findField({ id, name, label, placeholder }) {
    if (id) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    if (name) {
      const el = document.querySelector(`[name="${name}"]`);
      if (el) return el;
    }
    if (placeholder) {
      const el = document.querySelector(`[placeholder*="${placeholder}"]`);
      if (el) return el;
    }
    if (label) {
      // Ищем label содержащий текст и по for → id
      const labels = [...document.querySelectorAll('label')];
      const match = labels.find(l => l.textContent.toLowerCase().includes(label.toLowerCase()));
      if (match) {
        const forId = match.getAttribute('for');
        if (forId) return document.getElementById(forId);
        const sibling = match.parentElement?.querySelector('input, textarea, select');
        if (sibling) return sibling;
      }
    }
    return null;
  }

  /**
   * Кликает на элемент с подсветкой (для visual feedback врачу).
   */
  function clickWithHighlight(selector) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return false;
    el.classList.add('ai-filled-animation');
    el.click();
    return true;
  }

  // Экспорт
  window.__DamumedFiller = { setFieldValue, findField, clickWithHighlight };
})();
