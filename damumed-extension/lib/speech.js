// lib/speech.js — обёртка над Web Speech API для непрерывного распознавания русской речи.
// Также содержит speechSynthesis для голосовых подсказок агента.

(function () {
  'use strict';

  // Web Speech API в Chrome под именем webkitSpeechRecognition
  const SpeechRecognitionClass =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  class VoiceRecognizer {
    constructor() {
      this.recognition = null;
      this.isListening = false;
      this.interimTranscript = '';
      this.finalTranscript = '';

      // Callbacks — назначаются извне
      this.onInterim = null;   // (text) => void  — промежуточный транскрипт
      this.onFinal = null;     // (text) => void  — окончательный транскрипт (одна фраза)
      this.onError = null;     // (errType, message) => void
      this.onStart = null;
      this.onEnd = null;

      if (!SpeechRecognitionClass) {
        console.error('[Speech] Web Speech API не поддерживается в этом браузере');
        return;
      }

      this._setupRecognition();
    }

    _setupRecognition() {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.lang = 'ru-RU';
      this.recognition.continuous = true;    // не останавливаться после паузы
      this.recognition.interimResults = true; // стриминг промежуточных результатов
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.interimTranscript = '';
        this.finalTranscript = '';
        if (this.onStart) this.onStart();
      };

      this.recognition.onresult = (event) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        this.interimTranscript = interim;
        if (interim && this.onInterim) this.onInterim(interim.trim());
        if (finalText) {
          this.finalTranscript += finalText;
          if (this.onFinal) this.onFinal(finalText.trim());
        }
      };

      this.recognition.onerror = (event) => {
        console.error('[Speech] Error:', event.error, event.message);
        if (this.onError) this.onError(event.error, event.message || '');
        // Некоторые ошибки требуют перезапуска
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          // no-speech — просто молчание, пробуем снова
          this.isListening = false;
        }
      };

      this.recognition.onend = () => {
        const wasListening = this.isListening;
        this.isListening = false;
        if (this.onEnd) this.onEnd();
        // Если пользователь не нажимал стоп, автоматически перезапускаем
        // (Chrome прерывает continuous-recognition каждые ~60 сек)
        if (wasListening && this._shouldRestart) {
          setTimeout(() => {
            try { this.recognition.start(); this.isListening = true; } catch (e) {}
          }, 100);
        }
      };
    }

    start() {
      if (!this.recognition) return false;
      if (this.isListening) return false;
      try {
        this._shouldRestart = true;
        this.recognition.start();
        return true;
      } catch (e) {
        console.error('[Speech] Start error:', e);
        return false;
      }
    }

    stop() {
      if (!this.recognition) return;
      this._shouldRestart = false;
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.isListening = false;
    }

    isSupported() {
      return Boolean(SpeechRecognitionClass);
    }
  }

  // Синтез речи для голосовых подсказок агента
  class VoiceSpeaker {
    constructor() {
      this.synth = window.speechSynthesis;
      this.voice = null;
      this._loadVoice();
      // Voices загружаются асинхронно
      if (this.synth) {
        this.synth.onvoiceschanged = () => this._loadVoice();
      }
    }

    _loadVoice() {
      if (!this.synth) return;
      const voices = this.synth.getVoices();
      // Предпочитаем женский русский голос, иначе любой русский
      this.voice =
        voices.find(v => v.lang === 'ru-RU' && /female|female|zira|milena/i.test(v.name)) ||
        voices.find(v => v.lang === 'ru-RU') ||
        voices.find(v => v.lang && v.lang.startsWith('ru')) ||
        null;
    }

    speak(text, { rate = 1.05, pitch = 1.0 } = {}) {
      if (!this.synth || !text) return;
      // Отменяем предыдущее, если что-то ещё говорится
      this.synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      if (this.voice) u.voice = this.voice;
      u.rate = rate;
      u.pitch = pitch;
      this.synth.speak(u);
    }

    stop() {
      if (this.synth) this.synth.cancel();
    }
  }

  // Экспорт в глобал (внутри content script всё в одной области видимости)
  window.__DamumedSpeech = { VoiceRecognizer, VoiceSpeaker };
})();
