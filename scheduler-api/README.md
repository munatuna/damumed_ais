# Damumed Scheduler API

OR-Tools CP-SAT schedule generator for rehab center Aqbobek.

## Quick start

```bash
cd scheduler-api
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Swagger UI: http://localhost:8001/docs

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness check |
| POST | /api/schedule | Full custom schedule request |
| POST | /api/schedule/demo | Demo schedule (built-in patients) |

## Quick demo test

```bash
curl -s -X POST http://localhost:8001/api/schedule/demo \
  -H "Content-Type: application/json" \
  -d '{"num_days": 3, "timeout_sec": 10}' | python3 -m json.tool | head -60
```

## Schedule model

- **Working hours:** 09:00–17:00 (16 slots × 30 min/slot)
- **Horizon:** configurable `num_days` (default 14)
- **Hard constraints:**
  - Patient cannot attend two procedures at the same time
  - Specialist cannot serve two patients at the same time
- **Objective:** minimise weighted completion time → compact daily schedules

## Input format (`POST /api/schedule`)

```json
{
  "num_days": 14,
  "specialists": [
    {"id": "massager", "name": "Бекова А.Т.", "type": "massager", "role": "Массажист"}
  ],
  "patients": [
    {
      "id": "352",
      "name": "Сейтханов Д.К.",
      "procedures": [
        {
          "code": "MASSAGE_BACK",
          "name": "Массаж спины",
          "specialist_type": "massager",
          "duration_slots": 2,
          "days": [0,1,2,3,4,5,6,7,8,9,10,11,12,13]
        }
      ]
    }
  ]
}
```
