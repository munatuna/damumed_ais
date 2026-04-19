"""
Demo data that mirrors data.js patients and procedures.
Used by the /api/schedule/demo endpoint.
"""

from solver import Patient, ProcedureTask, Specialist

# ── Specialists (mirrors data.js SPECIALISTS) ─────────────────────────────────
SPECIALISTS = [
    Specialist(id="massager",    name="Бекова А.Т.",    type="massager",    role="Массажист"),
    Specialist(id="psychologist",name="Нурланов Б.С.",  type="psychologist",role="Психолог"),
    Specialist(id="lfc",         name="Сейткали Д.О.",  type="lfc",         role="Инструктор ЛФК"),
    Specialist(id="physio",      name="Ахметова Г.К.",  type="physio",      role="Физиотерапевт"),
]

# ── Procedure catalogue (code → task template) ────────────────────────────────
# duration_slots: 1 = 30 min, 2 = 60 min
PROC_CATALOGUE = {
    "MASSAGE_BACK":   ProcedureTask(code="MASSAGE_BACK",   name="Массаж спины",            specialist_type="massager",     duration_slots=2),
    "MASSAGE_LIMB":   ProcedureTask(code="MASSAGE_LIMB",   name="Массаж конечностей",      specialist_type="massager",     duration_slots=2),
    "PSYCH_SESSION":  ProcedureTask(code="PSYCH_SESSION",  name="Сеанс психолога",          specialist_type="psychologist", duration_slots=2),
    "LFC_INDIVIDUAL": ProcedureTask(code="LFC_INDIVIDUAL", name="ЛФК индивидуальная",       specialist_type="lfc",          duration_slots=2),
    "LFC_GROUP":      ProcedureTask(code="LFC_GROUP",      name="ЛФК групповая",            specialist_type="lfc",          duration_slots=2),
    "ELECTRO":        ProcedureTask(code="ELECTRO",        name="Электрофорез",             specialist_type="physio",       duration_slots=1),
    "MAGNETO":        ProcedureTask(code="MAGNETO",        name="Магнитотерапия",           specialist_type="physio",       duration_slots=1),
    "HYDRO":          ProcedureTask(code="HYDRO",          name="Гидромассаж",              specialist_type="physio",       duration_slots=1),
    "NEEDLE":         ProcedureTask(code="NEEDLE",         name="Иглорефлексотерапия",      specialist_type="physio",       duration_slots=2),
}

# ── Procedure sets per diagnosis category ─────────────────────────────────────
PROCEDURE_SETS = {
    "spine": ["MASSAGE_BACK", "LFC_INDIVIDUAL", "ELECTRO", "MAGNETO", "PSYCH_SESSION"],
    "neuro": ["LFC_INDIVIDUAL", "LFC_GROUP",    "PSYCH_SESSION", "ELECTRO", "NEEDLE"],
    "joint": ["MASSAGE_LIMB",   "HYDRO",         "LFC_GROUP",    "MAGNETO", "ELECTRO"],
}

# ── Demo patients (mirrors data.js PATIENTS, trimmed) ─────────────────────────
def build_demo_patients(num_days: int = 14) -> list[Patient]:
    raw = [
        {"id": "352", "name": "Сейтханов Д.К.",    "category": "spine"},
        {"id": "353", "name": "Мусина А.О.",        "category": "neuro"},
        {"id": "354", "name": "Жакупов Е.Т.",       "category": "joint"},
        {"id": "355", "name": "Бердалиева С.Н.",    "category": "spine"},
        {"id": "356", "name": "Абенов Н.К.",        "category": "neuro"},
    ]

    patients = []
    for r in raw:
        codes = PROCEDURE_SETS.get(r["category"], [])
        procs = []
        for code in codes:
            tmpl = PROC_CATALOGUE[code]
            procs.append(ProcedureTask(
                code            = tmpl.code,
                name            = tmpl.name,
                specialist_type = tmpl.specialist_type,
                duration_slots  = tmpl.duration_slots,
                days            = list(range(num_days)),   # daily
            ))
        patients.append(Patient(id=r["id"], name=r["name"], procedures=procs))

    return patients
