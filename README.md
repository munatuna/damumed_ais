# Damumed AI Agent — AIS Hack 3.0

Внешний AI-агент для КМИС Дамумед. Chrome Extension + FastAPI + OR-Tools + Claude API.

Помогает врачам реабилитационного центра «Акбобек» заполнять медицинскую документацию голосом, генерировать расписание процедур и анализировать PDF выписок.

---

## Структура проекта

```
damumed-extension/   — Chrome Extension (Manifest V3)
damumed-mock/        — HTML-мокап интерфейса Дамумед
scheduler-api/       — FastAPI сервер (Claude прокси + OR-Tools планировщик)
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
| `localhost:8080` | Лечащий врач |
| `localhost:8080/specialist-queue.html?specialist=massager` | Массажист |
| `localhost:8080/specialist-queue.html?specialist=psychologist` | Психолог |

---

## Стек

- **Claude Sonnet / Haiku** — NLU, заполнение полей, PDF-парсинг, протоколы
- **OR-Tools CP-SAT** — оптимизация расписания процедур
- **Web Speech API** — распознавание голоса (встроено в Chrome)
- **FastAPI + httpx** — прокси к Claude API (обход CORS)
- **Chrome Extension MV3** — внешний агент без изменений в Дамумед
