// Моковые данные пациентов. Абай Амина - с реальными данными из PDF (демо-пациент).
// Остальные - заглушки, заполнишь когда скинет больше историй болезни.

window.PATIENTS = [
  {
    id: "352",
    iin: "150713602636",
    fullName: "АБАЙ АМИНА МУРАТОВНА",
    birthDate: "13.07.2015",
    age: 10,
    gender: "Женский",
    nationality: "Казашка",
    address: "Актюбинская обл., Хобдинский р-н, с. Булак, ул. А.Молдагулова, 1",
    school: "ОСШ им А.Молдагулова, Класс 4",
    ward: "Кардиохирургическая палата для детей № 3",
    admissionDate: "04.03.2026",
    admissionTime: "06:29",
    dischargeDate: "18.03.2026",
    admissionDiagnosisMain: "(Z87.0) В личном анамнезе болезни органов дыхания",
    admissionDiagnosisClarify: "(J41.0) Простой хронический бронхит",
    attendingDoctor: "МАХМУТХАН АҚЗИРА МАХМУТХАНҚЫЗЫ",
    doctorShort: "Махмутхан А.М.",
    referralOrg: "ГКП Кобдинская РБ",
    admissionType: "Плановая госпитализация",
    status: "current", // current | discharged | new
    diagnosisCategory: "respiratory", // для подбора процедур
    // Уже собранные объективные данные (для предзаполнения демо)
    vitals: {
      weight: 31,
      height: 134,
      bmi: 17.26,
      temperature: 36.5,
      pulse: 86,
      breath: 20,
      saturation: 98,
      pressureTop: 110,
      pressureBottom: 60
    },
    currentDay: 10 // текущий день курса для демо
  },
  {
    id: "353",
    iin: "160422500123",
    fullName: "ИВАНОВ ИВАН СЕРГЕЕВИЧ",
    birthDate: "22.04.2016",
    age: 9,
    gender: "Мужской",
    nationality: "Русский",
    address: "г. Актобе, ул. Ленина, 45",
    school: "СОШ №12, Класс 3",
    ward: "Неврологическая палата № 5",
    admissionDate: "10.04.2026",
    admissionDiagnosisMain: "(G80.1) Спастическая диплегия",
    admissionDiagnosisClarify: "ДЦП, спастическая форма",
    attendingDoctor: "САРЕНОВА БОТАКОЗ МАКСАТОВНА",
    doctorShort: "Саренова Б.М.",
    admissionType: "Плановая госпитализация",
    status: "current",
    diagnosisCategory: "neurological",
    vitals: { weight: 28, height: 128, bmi: 17.1, temperature: 36.6, pulse: 92, breath: 22, saturation: 97, pressureTop: 105, pressureBottom: 65 },
    currentDay: 7
  },
  {
    id: "354",
    iin: "180509400789",
    fullName: "НУРЛАНОВА АЙДАНА БАКЫТОВНА",
    birthDate: "09.05.2018",
    age: 7,
    gender: "Женский",
    nationality: "Казашка",
    address: "г. Актобе, мкр. 11, д. 23, кв. 15",
    school: "Детский сад №8",
    ward: "Общая детская палата № 2",
    admissionDate: "05.04.2026",
    admissionDiagnosisMain: "(F80.1) Расстройство экспрессивной речи",
    admissionDiagnosisClarify: "Задержка речевого развития",
    attendingDoctor: "САРЕНОВА БОТАКОЗ МАКСАТОВНА",
    doctorShort: "Саренова Б.М.",
    admissionType: "Плановая госпитализация",
    status: "current",
    diagnosisCategory: "speech",
    vitals: { weight: 22, height: 118, bmi: 15.8, temperature: 36.4, pulse: 95, breath: 20, saturation: 99, pressureTop: 100, pressureBottom: 60 },
    currentDay: 12
  },
  {
    id: "355",
    iin: "140308602341",
    fullName: "СМАГУЛОВ БЕКЗАТ ТИМУРОВИЧ",
    birthDate: "08.03.2014",
    age: 11,
    gender: "Мужской",
    nationality: "Казах",
    address: "Актюбинская обл., Мартукский р-н, с. Мартук",
    school: "СОШ им. Абая, Класс 5",
    ward: "Травматологическая палата № 4",
    admissionDate: "01.04.2026",
    admissionDiagnosisMain: "(S82.3) Перелом дистального отдела большеберцовой кости",
    admissionDiagnosisClarify: "Состояние после консолидации перелома",
    attendingDoctor: "МАХМУТХАН АҚЗИРА МАХМУТХАНҚЫЗЫ",
    doctorShort: "Махмутхан А.М.",
    admissionType: "Плановая госпитализация",
    status: "current",
    diagnosisCategory: "orthopedic",
    vitals: { weight: 38, height: 142, bmi: 18.8, temperature: 36.5, pulse: 84, breath: 19, saturation: 98, pressureTop: 110, pressureBottom: 70 },
    currentDay: 16
  },
  {
    id: "356",
    iin: "170611500456",
    fullName: "КАМИЛОВА ЗАРИНА АРМАНОВНА",
    birthDate: "11.06.2017",
    age: 8,
    gender: "Женский",
    nationality: "Казашка",
    address: "г. Актобе, ул. Есет батыра, 87",
    school: "СОШ №22, Класс 2",
    ward: "Неврологическая палата № 6",
    admissionDate: "12.04.2026",
    admissionDiagnosisMain: "(F90.0) Нарушение активности и внимания",
    admissionDiagnosisClarify: "СДВГ",
    attendingDoctor: "САРЕНОВА БОТАКОЗ МАКСАТОВНА",
    doctorShort: "Саренова Б.М.",
    admissionType: "Плановая госпитализация",
    status: "new",
    diagnosisCategory: "psychological",
    vitals: { weight: 25, height: 124, bmi: 16.3, temperature: 36.5, pulse: 98, breath: 21, saturation: 99, pressureTop: 100, pressureBottom: 65 },
    currentDay: 5
  },
  {
    id: "357",
    iin: "190702400890",
    fullName: "ТЛЕУЖАНОВ ДАНИЯР ЕРЛАНОВИЧ",
    birthDate: "02.07.2019",
    age: 6,
    gender: "Мужской",
    nationality: "Казах",
    address: "Актюбинская обл., Хромтауский р-н, г. Хромтау",
    school: "Детский сад №14",
    ward: "Неврологическая палата № 5",
    admissionDate: "08.04.2026",
    admissionDiagnosisMain: "(G40.3) Генерализованная идиопатическая эпилепсия",
    admissionDiagnosisClarify: "Эпилепсия, период ремиссии",
    attendingDoctor: "САРЕНОВА БОТАКОЗ МАКСАТОВНА",
    doctorShort: "Саренова Б.М.",
    admissionType: "Плановая госпитализация",
    status: "current",
    diagnosisCategory: "neurological",
    vitals: { weight: 20, height: 115, bmi: 15.1, temperature: 36.6, pulse: 102, breath: 22, saturation: 98, pressureTop: 95, pressureBottom: 55 },
    currentDay: 9
  }
];

// Стандартные процедуры центра с кодами Минздрава РК (из PDF Абай Амины)
window.PROCEDURES = {
  "A02.050.000": { name: "Консультация: Реабилитолог", duration: 30, specialist: "Махмутхан А.М.", slot: "09:00", room: "Каб. реаб." },
  "A02.063.000": { name: "Консультация: Физиотерапевт", duration: 30, specialist: "Айдарханова Г.А.", slot: "09:00", room: "Каб. физио" },
  "A02.069.000": { name: "Консультация: Врач ЛФК", duration: 30, specialist: "Жанзакова С.А.", slot: "09:30", room: "ЛФК-зал" },
  "A02.070.000": { name: "Консультация: Психолог", duration: 40, specialist: "Психолог", slot: "10:00", room: "Каб. псих." },
  "A02.075.000": { name: "Консультация: Логопед", duration: 30, specialist: "Логопед", slot: "10:30", room: "Каб. лог." },
  "D02.001.002": { name: "Местное УФ-облучение", duration: 15, specialist: "Тапиева М.М.", slot: "08:30", room: "Физио" },
  "D02.001.003": { name: "Аэрозольтерапия", duration: 15, specialist: "Тапиева М.М.", slot: "08:30", room: "Физио" },
  "D02.001.008": { name: "Дыхательная гимнастика", duration: 30, specialist: "Таңатар К.", slot: "08:00", room: "ЛФК-зал" },
  "D02.002.008": { name: "Кинезотерапия групповая", duration: 40, specialist: "Таңатар К.", slot: "08:00", room: "ЛФК-зал" },
  "D02.007.008": { name: "Гидрокинезотерапия групповая", duration: 40, specialist: "Таңатар К.", slot: "08:05", room: "Бассейн" },
  "D02.015.007": { name: "Массаж области грудной клетки", duration: 30, specialist: "Кунакбаева Ж.Ж.", slot: "09:30", room: "Массажный каб." },
  "D02.015.001": { name: "Массаж общий", duration: 40, specialist: "Кунакбаева Ж.Ж.", slot: "09:30", room: "Массажный каб." },
  "D02.015.005": { name: "Массаж воротниковой зоны", duration: 20, specialist: "Кунакбаева Ж.Ж.", slot: "10:00", room: "Массажный каб." },
  "D02.030.001": { name: "Биоптрон", duration: 15, specialist: "Тапиева М.М.", slot: "08:30", room: "Физио" },
  "D02.040.001": { name: "Соляная камера (спелеокамера)", duration: 30, specialist: "Тапиева М.М.", slot: "11:00", room: "Спелеокамера" },
  "D02.050.001": { name: "Парафинотерапия", duration: 20, specialist: "Тапиева М.М.", slot: "14:00", room: "Физио" },
  "D02.060.001": { name: "Эрготерапия", duration: 40, specialist: "Эрготерапевт", slot: "11:30", room: "Каб. эрг." }
};

// Подбор типовых процедур по категории диагноза (основа для Smart Scheduling)
window.PROCEDURE_SETS = {
  respiratory: [
    "D02.001.008", // Дыхательная гимнастика
    "D02.002.008", // Кинезотерапия
    "D02.007.008", // Гидрокинезотерапия
    "D02.001.003", // Аэрозольтерапия
    "D02.030.001", // Биоптрон
    "D02.015.007", // Массаж грудной клетки
    "D02.001.002", // УФО
    "D02.040.001"  // Соляная камера
  ],
  neurological: [
    "D02.015.001", // Массаж общий
    "D02.015.005", // Массаж воротниковой зоны
    "D02.002.008", // Кинезотерапия
    "D02.007.008", // Гидрокинезотерапия
    "D02.030.001", // Биоптрон
    "A02.050.000", // Реабилитолог
    "A02.070.000"  // Психолог
  ],
  speech: [
    "A02.075.000", // Логопед
    "A02.070.000", // Психолог
    "D02.060.001", // Эрготерапия
    "D02.015.005"  // Массаж воротниковой зоны
  ],
  orthopedic: [
    "D02.002.008", // Кинезотерапия
    "D02.007.008", // Гидрокинезотерапия
    "D02.015.001", // Массаж общий
    "D02.050.001", // Парафинотерапия
    "D02.030.001"  // Биоптрон
  ],
  psychological: [
    "A02.070.000", // Психолог
    "D02.060.001", // Эрготерапия
    "D02.015.005", // Массаж воротниковой зоны
    "D02.002.008"  // Кинезотерапия
  ]
};

// Схема подкатегорий медзаписи (извлечена из HTML-дампов Дамумеда)
window.MEDICAL_RECORD_SECTIONS = [
  { code: "100", key: "complaints",       title: "Жалобы при поступлении" },
  { code: "200", key: "anamnesis_disease", title: "Анамнез заболевания" },
  { code: "300", key: "anamnesis_life",    title: "Анамнез жизни" },
  { code: "400", key: "allergy_anamnesis", title: "Аллергологический анамнез" },
  { code: "500", key: "objective",         title: "Объективные данные" },
  { code: "700", key: "diagnosis_rationale", title: "Обоснование диагноза" },
  { code: "800", key: "instrumental",      title: "Инструментальные исследования" },
  { code: "900", key: "treatment",         title: "Проведенное лечение" },
  { code: "1200", key: "outcome",          title: "Исход лечения" },
  { code: "600", key: "discharge_summary", title: "Выписной эпикриз" }
];
