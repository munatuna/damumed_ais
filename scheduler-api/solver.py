"""
Damumed Scheduler — OR-Tools CP-SAT solver.

Model:
  - One "task" per (patient, procedure, day).
  - Each task occupies `duration_slots` consecutive 30-min slots.
  - Hard constraints:
      * A patient cannot be in two places at the same time (NoOverlap per patient×day).
      * A specialist cannot serve two patients at the same time (NoOverlap per specialist×day).
  - Soft objective: minimise total weighted completion time (encourages compact schedules
    and early finish; fair load is handled via specialist-level interval packing).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from ortools.sat.python import cp_model

# ── Constants ────────────────────────────────────────────────────────────────
SLOTS_PER_DAY = 16   # 9:00–17:00, 30-min slots  (slot 0 = 09:00, slot 15 = 16:30)
SLOT_START_H  = 9


def slot_to_time(slot: int) -> str:
    h = SLOT_START_H + slot // 2
    m = (slot % 2) * 30
    return f"{h:02d}:{m:02d}"


# ── Input data classes ────────────────────────────────────────────────────────
@dataclass
class ProcedureTask:
    code:            str
    name:            str
    specialist_type: str          # must match Specialist.type
    duration_slots:  int = 1      # 1 slot = 30 min
    days:            Optional[List[int]] = None   # 0-based; None → all days


@dataclass
class Patient:
    id:         str
    name:       str
    procedures: List[ProcedureTask] = field(default_factory=list)


@dataclass
class Specialist:
    id:   str
    name: str
    type: str   # e.g. "massager", "psychologist", "doctor"
    role: str   # display label


# ── Solver ────────────────────────────────────────────────────────────────────
@dataclass
class ScheduleEntry:
    patient_id:      str
    patient_name:    str
    procedure_code:  str
    procedure_name:  str
    specialist_id:   str
    specialist_name: str
    day:             int    # 1-based
    slot:            int    # 0-based within day
    time:            str    # "HH:MM"
    duration_slots:  int


def solve(
    patients:    List[Patient],
    specialists: List[Specialist],
    num_days:    int = 14,
    timeout_sec: int = 30,
) -> Tuple[Optional[List[ScheduleEntry]], str]:
    """
    Returns (schedule, status_name).
    schedule is None when the problem is infeasible or solver timed-out with no solution.
    """

    model = cp_model.CpModel()

    # Index helpers
    spec_list  = specialists
    spec_count = len(spec_list)
    spec_by_type: Dict[str, List[int]] = {}
    for si, sp in enumerate(spec_list):
        spec_by_type.setdefault(sp.type, []).append(si)

    # Per-day interval lists for NoOverlap constraints
    # patient_intervals[(pi, d)] and spec_intervals[(si, d)]
    patient_intervals: Dict[Tuple[int, int], list] = {}
    spec_intervals:    Dict[Tuple[int, int], list] = {}

    # Store decision variables for solution extraction
    # task_key → {start_var, spec_bools: {si: BoolVar}}
    tasks: Dict[Tuple[int, int, int], dict] = {}

    for pi, patient in enumerate(patients):
        for proc_i, proc in enumerate(patient.procedures):
            dur = proc.duration_slots
            eligible = spec_by_type.get(proc.specialist_type, [])
            if not eligible:
                continue  # no specialist available — skip

            days = proc.days if proc.days is not None else list(range(num_days))

            for d in days:
                key = (pi, proc_i, d)

                # Start slot of this task
                max_start = SLOTS_PER_DAY - dur
                start = model.new_int_var(0, max_start, f"s_{pi}_{proc_i}_{d}")
                end   = model.new_int_var(dur, SLOTS_PER_DAY, f"e_{pi}_{proc_i}_{d}")
                model.add(end == start + dur)

                # ── Patient interval (required — patient always attends) ──
                p_interval = model.new_interval_var(start, dur, end, f"pi_{pi}_{proc_i}_{d}")
                patient_intervals.setdefault((pi, d), []).append(p_interval)

                # ── Specialist assignment ──
                # If only one eligible specialist → just create required interval.
                # If multiple → create optional intervals, enforce exactly one chosen.
                spec_bools: Dict[int, cp_model.BoolVarT] = {}

                if len(eligible) == 1:
                    si = eligible[0]
                    s_interval = model.new_interval_var(start, dur, end, f"si_{pi}_{proc_i}_{d}_{si}")
                    spec_intervals.setdefault((si, d), []).append(s_interval)
                    # no bool needed — always assigned to this specialist
                else:
                    exactly_one_chosen = []
                    for si in eligible:
                        b = model.new_bool_var(f"b_{pi}_{proc_i}_{d}_{si}")
                        spec_bools[si] = b
                        exactly_one_chosen.append(b)
                        opt = model.new_optional_interval_var(
                            start, dur, end, b, f"oi_{pi}_{proc_i}_{d}_{si}"
                        )
                        spec_intervals.setdefault((si, d), []).append(opt)
                    model.add_exactly_one(exactly_one_chosen)

                tasks[key] = {
                    "start":      start,
                    "end":        end,
                    "proc_i":     proc_i,
                    "pi":         pi,
                    "d":          d,
                    "eligible":   eligible,
                    "spec_bools": spec_bools,   # empty if only one eligible
                }

    # ── Hard constraints ──────────────────────────────────────────────────────

    # 1. Patient can't attend two procedures simultaneously
    for intervals in patient_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)

    # 2. Specialist can't run two sessions simultaneously
    for intervals in spec_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)

    # ── Objective: minimise sum of weighted end times ─────────────────────────
    # Weight = day * SLOTS_PER_DAY + end_slot → earlier days and earlier slots preferred.
    # This naturally compacts each patient's daily schedule.
    obj_terms = []
    for (pi, proc_i, d), t in tasks.items():
        weight = (d + 1)  # later days count more → solver tries to finish early each day
        obj_terms.append(weight * t["end"])

    if obj_terms:
        model.minimize(sum(obj_terms))

    # ── Solve ─────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout_sec
    solver.parameters.num_search_workers  = 4

    status = solver.solve(model)
    status_name = solver.status_name(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None, status_name

    # ── Extract solution ──────────────────────────────────────────────────────
    schedule: List[ScheduleEntry] = []

    for (pi, proc_i, d), t in tasks.items():
        patient  = patients[t["pi"]]
        proc     = patient.procedures[t["proc_i"]]
        start_sl = solver.value(t["start"])

        # Determine which specialist was chosen
        if not t["spec_bools"]:
            # Only one eligible
            si = t["eligible"][0]
        else:
            si = next(
                (s for s, b in t["spec_bools"].items() if solver.value(b) == 1),
                t["eligible"][0],
            )

        sp = spec_list[si]
        schedule.append(ScheduleEntry(
            patient_id      = patient.id,
            patient_name    = patient.name,
            procedure_code  = proc.code,
            procedure_name  = proc.name,
            specialist_id   = sp.id,
            specialist_name = sp.name,
            day             = d + 1,
            slot            = start_sl,
            time            = slot_to_time(start_sl),
            duration_slots  = proc.duration_slots,
        ))

    schedule.sort(key=lambda e: (e.day, e.slot, e.patient_id))
    return schedule, status_name
  