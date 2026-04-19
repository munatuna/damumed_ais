"""
Damumed Scheduler API — FastAPI entry point.

Endpoints:
  POST /api/schedule        — full custom schedule request
  POST /api/schedule/demo   — generate from built-in demo data
  GET  /health              — liveness check
"""

from __future__ import annotations
from typing import List, Optional
import os

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from solver import (
    Patient      as SolverPatient,
    ProcedureTask as SolverProc,
    Specialist   as SolverSpecialist,
    ScheduleEntry,
    solve,
)
import demo_data

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Damumed Scheduler API",
    description = "OR-Tools CP-SAT schedule generator for rehab center Aqbobek",
    version     = "1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# ── Request / Response schemas ────────────────────────────────────────────────
class ProcedureIn(BaseModel):
    code:            str
    name:            str
    specialist_type: str
    duration_slots:  int  = 1
    days:            Optional[List[int]] = None   # 0-based; None → all days

class PatientIn(BaseModel):
    id:         str
    name:       str
    procedures: List[ProcedureIn]

class SpecialistIn(BaseModel):
    id:   str
    name: str
    type: str
    role: str

class ScheduleRequest(BaseModel):
    patients:    List[PatientIn]
    specialists: List[SpecialistIn]
    num_days:    int = 14
    timeout_sec: int = 30

class ScheduleEntryOut(BaseModel):
    patient_id:      str
    patient_name:    str
    procedure_code:  str
    procedure_name:  str
    specialist_id:   str
    specialist_name: str
    day:             int
    slot:            int
    time:            str
    duration_slots:  int

class ScheduleResponse(BaseModel):
    status:   str                     # "ok" | "infeasible" | "timeout"
    schedule: List[ScheduleEntryOut]
    stats:    dict

class DemoRequest(BaseModel):
    num_days:    int = 14
    timeout_sec: int = 30


# ── Helpers ───────────────────────────────────────────────────────────────────
def _build_stats(schedule: List[ScheduleEntry]) -> dict:
    load: dict = {}
    for e in schedule:
        load[e.specialist_id] = load.get(e.specialist_id, 0) + 1
    per_patient: dict = {}
    for e in schedule:
        per_patient[e.patient_id] = per_patient.get(e.patient_id, 0) + 1
    return {
        "total_tasks":    len(schedule),
        "specialist_load": load,
        "patient_tasks":   per_patient,
    }

def _entry_to_out(e: ScheduleEntry) -> ScheduleEntryOut:
    return ScheduleEntryOut(**e.__dict__)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/schedule", response_model=ScheduleResponse)
def generate_schedule(req: ScheduleRequest):
    patients = [
        SolverPatient(
            id=p.id, name=p.name,
            procedures=[
                SolverProc(
                    code=pr.code, name=pr.name,
                    specialist_type=pr.specialist_type,
                    duration_slots=pr.duration_slots,
                    days=pr.days if pr.days is not None else list(range(req.num_days)),
                )
                for pr in p.procedures
            ]
        )
        for p in req.patients
    ]
    specs = [
        SolverSpecialist(id=s.id, name=s.name, type=s.type, role=s.role)
        for s in req.specialists
    ]

    schedule, status_name = solve(patients, specs, req.num_days, req.timeout_sec)

    if schedule is None:
        return ScheduleResponse(status=status_name.lower(), schedule=[], stats={})

    return ScheduleResponse(
        status   = "ok",
        schedule = [_entry_to_out(e) for e in schedule],
        stats    = _build_stats(schedule),
    )


# ── Claude API proxy (avoids browser CORS restrictions) ──────────────────────
class ClaudeProxyRequest(BaseModel):
    apiKey:       str
    model:        str
    systemPrompt: str
    userMessage:  str
    pdfBase64:    Optional[str] = None
    pdfMimeType:  Optional[str] = None
    maxTokens:    int = 4096

@app.post("/api/llm")
async def claude_proxy(req: ClaudeProxyRequest):
    user_content = []
    if req.pdfBase64:
        user_content.append({
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": req.pdfMimeType or "application/pdf",
                "data": req.pdfBase64,
            }
        })
    user_content.append({"type": "text", "text": req.userMessage})

    payload = {
        "model": req.model,
        "max_tokens": req.maxTokens,
        "system": req.systemPrompt,
        "messages": [{"role": "user", "content": user_content}],
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": req.apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    text = data.get("content", [{}])[0].get("text", "")
    return {"ok": True, "text": text}


@app.post("/api/schedule/demo", response_model=ScheduleResponse)
def generate_demo(req: DemoRequest):
    """Generate schedule using built-in demo patients and specialists."""
    patients = demo_data.build_demo_patients(req.num_days)
    specs    = demo_data.SPECIALISTS

    schedule, status_name = solve(patients, specs, req.num_days, req.timeout_sec)

    if schedule is None:
        return ScheduleResponse(status=status_name.lower(), schedule=[], stats={})

    return ScheduleResponse(
        status   = "ok",
        schedule = [_entry_to_out(e) for e in schedule],
        stats    = _build_stats(schedule),
    )


@app.get("/")
def root():
    return RedirectResponse(url="/login.html")


# ── Static files (damumed-mock) — must be last ────────────────────────────────
_mock_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'damumed-mock')
if os.path.isdir(_mock_dir):
    app.mount("/", StaticFiles(directory=_mock_dir, html=True), name="static")
