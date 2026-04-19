# Damumed AI Agent — AIS Hack 3.0

Внешний AI-агент для КМИС Дамумед. Chrome Extension + FastAPI + OR-Tools + Claude API.

Помогает врачам реабилитационного центра «Акбобек» заполнять медицинскую документацию голосом, генерировать расписание процедур и анализировать PDF выписок.

## Демо

**https://web-production-7cb3b.up.railway.app**

| Интерфейс | Ссылка |
|---|---|
| Лечащий врач | [/index.html](https://web-production-7cb3b.up.railway.app/index.html) |
| Массажист | [/specialist-queue.html?specialist=massager](https://web-production-7cb3b.up.railway.app/specialist-queue.html?specialist=massager) |
| Психолог | [/specialist-queue.html?specialist=psychologist](https://web-production-7cb3b.up.railway.app/specialist-queue.html?specialist=psychologist) |

---

## Читать код — с чего начать

Если хотите понять как всё устроено, читайте в таком порядке:

| Файл | Что делает |
|---|---|
| `damumed-extension/manifest.json` | Точка входа extension, права доступа |
| `damumed-extension/content.js` | Главный агент: голос → LLM → DOM. Весь основной флоу здесь |
| `damumed-extension/agent/prompts.js` | Системные промпты и JSON-схемы для Claude |
| `damumed-extension/agent/actions.js` | Исполнение действий: заполнение полей, навигация, диагнозы |
| `damumed-extension/background.js` | Service worker: хранит API ключ, проксирует настройки |
| `scheduler-api/main.py` | FastAPI: `/api/llm` (Claude прокси) + `/api/schedule` (OR-Tools) |
| `scheduler-api/solver.py` | CP-SAT планировщик расписания на 14 дней |
| `damumed-mock/data.js` | Данные пациентов, справочник процедур МКБ |
| `damumed-mock/storage.js` | Вся localStorage-персистентность |
| `damumed-mock/specialist-common.js` | Логика кабинетов специалистов |

---

## Структура проекта

```
damumed-extension/
  content.js          — основной агент (внедряется в страницу)
  background.js       — service worker
  bridge.js           — мост между мирами extension
  popup.html/js       — настройка API ключа
  agent/
    prompts.js        — промпты Claude + JSON-схемы
    actions.js        — выполнение действий в DOM
    filler.js         — заполнение форм
    scheduler.js      — вызов OR-Tools
  lib/
    speech.js         — Web Speech API обёртка

damumed-mock/
  index.html          — список пациентов
  patient.html        — карта пациента
  medical-record.html — медицинская запись
  diary.html          — дневниковые записи
  diagnoses.html      — диагнозы + AI-протоколы
  assignments.html    — назначения + расписание
  specialist-queue.html      — очередь специалиста
  specialist-assignments.html — назначения специалиста
  specialist-note.html       — запись о выполнении процедуры
  psychologist-sheet.html    — лист психолога
  data.js             — справочники (пациенты, процедуры)
  storage.js          — localStorage API
  specialist-common.js — общая логика специалистов

scheduler-api/
  main.py             — FastAPI (Claude прокси + schedule endpoint)
  solver.py           — OR-Tools CP-SAT решатель
  requirements.txt
```

---

## Быстрый старт

### 1. Запуск мокапа (HTML)

```bash
cd damumed-mock
python3 -m http.server 8080
```

Открыть в браузере: `http://localhost:8080`

---

### 2. Запуск FastAPI сервера

```bash
cd scheduler-api
pip install -r requirements.txt
uvicorn main:app --port 8001
```

Сервер поднимается на `http://localhost:8001`.

Обязательно запущен — без него не работают:
- Claude API (прокси для CORS)
- OR-Tools планировщик расписания

---

### 3. Установка Chrome Extension

1. Открыть Chrome → `chrome://extensions/`
2. Включить **Режим разработчика** (правый верхний угол)
3. Нажать **Загрузить распакованное**
4. Выбрать папку `damumed-extension/`
5. Extension появится в панели браузера

---

### 4. Настройка API ключа

1. Кликнуть иконку extension в браузере
2. Вставить Claude API ключ (получить на `console.anthropic.com`)
3. Выбрать модель: `claude-haiku-4-5` (быстро) или `claude-sonnet-4-6` (точнее)
4. Нажать **Сохранить**

---

## Что умеет агент

| Функция | Как вызвать |
|---|---|
| Заполнить дневниковую запись | Голос: «Температура 36.5, пульс 86...» |
| Заполнить медкарту | Голос: «Жалобы на кашель, анамнез...» |
| Добавить диагноз | Голос: «Добавь диагноз J41 основной» |
| Добавить назначение | Голос: «Добавь логопеда на 10 сеансов» |
| Сгенерировать расписание | Голос: «Сформируй расписание» |
| Отметить процедуру | Голос: «Отметь массаж выполненным» |
| AI-протокол лечения | Голос: «Сгенерируй протокол» |
| Навигация | Голос: «Открой карту Амины» |
| Загрузить пациента из PDF | Кнопка в Extension: прикрепить PDF выписки |

---

## Требования

- Python 3.10+
- Chrome браузер
- Работающий сервер на `localhost:8001`
- Claude API ключ (Anthropic)

### Python зависимости (`scheduler-api/requirements.txt`)

```
fastapi
uvicorn
ortools
httpx
python-multipart
```

---

## Интерфейсы специалистов

| URL | Кто |
|---|---|
| `https://web-production-7cb3b.up.railway.app` | Лечащий врач |
| `https://web-production-7cb3b.up.railway.app/specialist-queue.html?specialist=massager` | Массажист |
| `https://web-production-7cb3b.up.railway.app/specialist-queue.html?specialist=psychologist` | Психолог |

---

## Стек

- **Claude Sonnet / Haiku** — NLU, заполнение полей, PDF-парсинг, протоколы
- **OR-Tools CP-SAT** — оптимизация расписания процедур
- **Web Speech API** — распознавание голоса (встроено в Chrome)
- **FastAPI + httpx** — прокси к Claude API (обход CORS)
- **Chrome Extension MV3** — внешний агент без изменений в Дамумед
