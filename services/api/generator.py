import random
import uuid
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta

def generate_etch_demo_dataset(
    seed: int = 20261015,
    scenario_id: str = "ETH-SYN-01",
    run_suffix: str | None = None
) -> Dict[str, Any]:
    rng = random.Random(seed)
    
    suffix_part = f"-{run_suffix}" if run_suffix else ""
    session_id = f"SES-{scenario_id}-{seed}{suffix_part}"
    run_id = f"RUN-DEMO-044-{seed % 1000:03d}{suffix_part}"
    lot_id = f"LOT-DEMO-801"
    recipe_id = "RECIPE-OXIDE-ETCH-V4"
    equipment_id = "ETCH-02"
    chamber_id = "CH-B"

    # Base start time (UTC)
    base_time = datetime(2026, 10, 15, 1, 24, 0, tzinfo=timezone.utc)
    started_at_utc = base_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    
    # 8 time steps (T0 ~ T7)
    # T4 and T5 have missing data (NULL, MISSING quality flag)
    relative_signal_values = [42.0, 44.0, 47.0, 46.0, None, None, 57.0, 80.0]
    
    samples = []
    for step_idx, rel_val in enumerate(relative_signal_values):
        t = base_time + timedelta(seconds=step_idx * 15)
        t_iso = t.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        time_label = f"T{step_idx}"
        
        # Perturbations
        prs_noise = (rng.random() - 0.5) * 1.2
        rf_noise = (rng.random() - 0.5) * 15.0

        # Step 7 is anomaly spike
        if step_idx == 7:
            prs_val = round(168.50 + prs_noise, 2)
            rf_val = round(1820.0 + rf_noise, 1)
            q_flag_prs = "SUSPECT"
            q_flag_rf = "SUSPECT"
        elif step_idx == 4:
            prs_val = round(120.20 + (rng.random() - 0.5) * 0.4, 2)
            rf_val = round(1500.0 + rf_noise, 1)
            q_flag_prs = "GOOD"
            q_flag_rf = "GOOD"
        elif step_idx == 5:
            prs_val = round(120.00 + (rng.random() - 0.5) * 0.4, 2)
            rf_val = round(1500.0 + rf_noise, 1)
            q_flag_prs = "GOOD"
            q_flag_rf = "GOOD"
        else:
            prs_val = round(120.45 + (rel_val - 45.0) * 0.8 + prs_noise, 2)
            rf_val = round(1500.0 + (rel_val - 45.0) * 4.5 + rf_noise, 1)
            q_flag_prs = "GOOD"
            q_flag_rf = "GOOD"

        if rel_val is None:
            # RELATIVE_SIGNAL is MISSING at T4 and T5 (e.g. optical shutter closed during stabilization)
            samples.append({
                "measurement_id": f"MEAS-{run_id}-REL-{step_idx}",
                "session_id": session_id,
                "run_id": run_id,
                "sensor_id": "RELATIVE_SIGNAL",
                "measured_value": None,
                "unit": "a.u.",
                "quality_flag": "MISSING",
                "data_origin": "synthetic",
                "event_time_utc": t_iso,
                "sim_time_utc": t_iso,
                "step_index": step_idx,
                "time_label": time_label
            })
        else:
            q_flag_rel = "SUSPECT" if step_idx == 7 else "GOOD"
            samples.append({
                "measurement_id": f"MEAS-{run_id}-REL-{step_idx}",
                "session_id": session_id,
                "run_id": run_id,
                "sensor_id": "RELATIVE_SIGNAL",
                "measured_value": float(rel_val),
                "unit": "a.u.",
                "quality_flag": q_flag_rel,
                "data_origin": "synthetic",
                "event_time_utc": t_iso,
                "sim_time_utc": t_iso,
                "step_index": step_idx,
                "time_label": time_label
            })

        # CHAMBER_PRESSURE (continuous measurement)
        samples.append({
            "measurement_id": f"MEAS-{run_id}-PRS-{step_idx}",
            "session_id": session_id,
            "run_id": run_id,
            "sensor_id": "CHAMBER_PRESSURE",
            "measured_value": prs_val,
            "unit": "mTorr",
            "quality_flag": q_flag_prs,
            "data_origin": "synthetic",
            "event_time_utc": t_iso,
            "sim_time_utc": t_iso,
            "step_index": step_idx,
            "time_label": time_label
        })

        # RF_POWER (continuous measurement)
        samples.append({
            "measurement_id": f"MEAS-{run_id}-RFP-{step_idx}",
            "session_id": session_id,
            "run_id": run_id,
            "sensor_id": "RF_POWER",
            "measured_value": rf_val,
            "unit": "W",
            "quality_flag": q_flag_rf,
            "data_origin": "synthetic",
            "event_time_utc": t_iso,
            "sim_time_utc": t_iso,
            "step_index": step_idx,
            "time_label": time_label
        })

    # Wafers
    wafers = []
    for seq in range(1, 26):
        wafer_id = f"W-{seq:02d}"
        if seq <= 7:
            status = "CONFIRMED_EXPOSED"
        elif 8 <= seq <= 12:
            status = "CANDIDATE_EXPOSED"
        else:
            status = "NOT_EXPOSED"
            
        wafers.append({
            "run_wafer_id": f"RWF-{run_id}-{wafer_id}",
            "session_id": session_id,
            "run_id": run_id,
            "wafer_id": wafer_id,
            "lot_id": lot_id,
            "slot_number": seq,
            "wafer_sequence_in_run": seq,
            "exposure_status": status
        })

    # Alert
    anomaly_time_iso = (base_time + timedelta(seconds=7 * 15)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    alerts = [
        {
            "alert_id": f"AL-DEMO-001{suffix_part}",
            "session_id": session_id,
            "run_id": run_id,
            "equipment_id": equipment_id,
            "chamber_id": chamber_id,
            "severity": "CRITICAL",
            "rule_code": "FDC-RULE-SPC-UCL-01",
            "message": "Chamber relative signal spike (80.0 a.u. > UCL 65.0) detected at T7",
            "status": "ACTIVE",
            "event_time_utc": anomaly_time_iso,
            "candidate_lot": lot_id,
            "candidate_wafers": ["W-08", "W-09", "W-10", "W-11", "W-12"]
        },
        {
            "alert_id": f"AL-DEMO-002{suffix_part}",
            "session_id": session_id,
            "run_id": None,
            "equipment_id": "ETCH-01",
            "chamber_id": "CH-A",
            "severity": "WARNING",
            "rule_code": "FDC-RULE-HEURISTIC-02",
            "message": "Idle chamber standby temp drift warning (No active run evidence attached)",
            "status": "ACTIVE",
            "event_time_utc": started_at_utc,
            "candidate_lot": None,
            "candidate_wafers": []
        }
    ]

    return {
        "session": {
            "session_id": session_id,
            "scenario_id": scenario_id,
            "seed": seed,
            "is_active": 1,
            "integrity_status": "VALID",
            "started_at_utc": started_at_utc,
            "completed_at_utc": None
        },
        "run": {
            "run_id": run_id,
            "session_id": session_id,
            "equipment_id": equipment_id,
            "chamber_id": chamber_id,
            "recipe_id": recipe_id,
            "lot_id": lot_id,
            "data_origin": "synthetic",
            "start_time_utc": started_at_utc,
            "end_time_utc": None,
            "run_status": "IN_PROGRESS"
        },
        "wafers": wafers,
        "samples": samples,
        "alerts": alerts
    }
