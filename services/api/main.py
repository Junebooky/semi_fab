import uuid
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, SQLITE_DB_PATH
from .database import init_db, db_session
from .models import (
    HealthResponse,
    StartRunRequest,
    SummaryResponse,
    SensorSample,
    FdcAlertItem,
    WaferItem,
)
from .generator import generate_etch_demo_dataset

def seed_demo_data_if_needed(db_path: str | None = None):
    init_db(db_path)
    with db_session(db_path) as conn:
        count = conn.execute("SELECT COUNT(*) FROM simulation_session;").fetchone()[0]
        if count == 0:
            dataset = generate_etch_demo_dataset(seed=20261015)
            # Insert session
            s = dataset["session"]
            conn.execute(
                """
                INSERT INTO simulation_session (session_id, scenario_id, seed, is_active, integrity_status, started_at_utc)
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                (s["session_id"], s["scenario_id"], s["seed"], s["is_active"], s["integrity_status"], s["started_at_utc"])
            )
            # Insert run
            r = dataset["run"]
            conn.execute(
                """
                INSERT INTO process_run (run_id, session_id, equipment_id, chamber_id, recipe_id, lot_id, data_origin, start_time_utc, run_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (r["run_id"], r["session_id"], r["equipment_id"], r["chamber_id"], r["recipe_id"], r["lot_id"], r["data_origin"], r["start_time_utc"], r["run_status"])
            )
            # Insert wafers
            for w in dataset["wafers"]:
                conn.execute(
                    """
                    INSERT INTO process_run_wafer (run_wafer_id, session_id, run_id, wafer_id, lot_id, slot_number, wafer_sequence_in_run, exposure_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (w["run_wafer_id"], w["session_id"], w["run_id"], w["wafer_id"], w["lot_id"], w["slot_number"], w["wafer_sequence_in_run"], w["exposure_status"])
                )
            # Insert measurements
            for m in dataset["samples"]:
                conn.execute(
                    """
                    INSERT INTO sensor_measurement (measurement_id, session_id, run_id, sensor_id, measured_value, unit, quality_flag, data_origin, event_time_utc, sim_time_utc, step_index)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (m["measurement_id"], m["session_id"], m["run_id"], m["sensor_id"], m["measured_value"], m["unit"], m["quality_flag"], m["data_origin"], m["event_time_utc"], m["sim_time_utc"], m["step_index"])
                )
            # Insert alerts
            for a in dataset["alerts"]:
                conn.execute(
                    """
                    INSERT INTO fdc_alert (alert_id, session_id, run_id, equipment_id, chamber_id, severity, rule_code, message, status, event_time_utc)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (a["alert_id"], a["session_id"], a["run_id"], a["equipment_id"], a["chamber_id"], a["severity"], a["rule_code"], a["message"], a["status"], a["event_time_utc"])
                )

@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_demo_data_if_needed()
    yield

app = FastAPI(
    title="FAB ONE Semiconductor Etch Simulation API",
    description="Python FastAPI + SQLite API for deterministic synthetic etch equipment simulation",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health", response_model=HealthResponse)
def get_health():
    with db_session() as conn:
        conn.execute("SELECT 1;").fetchone()
    return HealthResponse(
        status="ok",
        mode="B",
        database="connected",
        engine="ready",
        version="0.1.0"
    )

@app.get("/api/v1/demo/summary", response_model=SummaryResponse)
def get_demo_summary():
    with db_session() as conn:
        run = conn.execute(
            """
            SELECT r.* FROM process_run r
            JOIN simulation_session s ON r.session_id = s.session_id
            WHERE s.is_active = 1
            ORDER BY r.start_time_utc DESC LIMIT 1;
            """
        ).fetchone()
        if not run:
            run = conn.execute(
                """
                SELECT * FROM process_run
                ORDER BY start_time_utc DESC LIMIT 1;
                """
            ).fetchone()
        if not run:
            raise HTTPException(status_code=404, detail="No active demo run found")
        
        wafer_counts = conn.execute(
            """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN exposure_status = 'CONFIRMED_EXPOSED' THEN 1 ELSE 0 END) as exposed
            FROM process_run_wafer
            WHERE run_id = ?;
            """,
            (run["run_id"],)
        ).fetchone()

        alerts_count = conn.execute(
            """
            SELECT COUNT(*) FROM fdc_alert
            WHERE session_id = ? AND status = 'ACTIVE';
            """,
            (run["session_id"],)
        ).fetchone()[0]

        latest_samples = conn.execute(
            """
            SELECT sensor_id, measured_value
            FROM sensor_measurement
            WHERE run_id = ? AND step_index = 7;
            """,
            (run["run_id"],)
        ).fetchall()

        latest_map = {row["sensor_id"]: row["measured_value"] for row in latest_samples}

        return SummaryResponse(
            equipment_id=run["equipment_id"],
            chamber_id=run["chamber_id"],
            active_session_id=run["session_id"],
            active_run_id=run["run_id"],
            lot_id=run["lot_id"],
            recipe_id=run["recipe_id"],
            total_wafers=wafer_counts["total"],
            exposed_wafers=wafer_counts["exposed"],
            active_alerts_count=alerts_count,
            latest_pressure_mtorr=latest_map.get("CHAMBER_PRESSURE"),
            latest_rf_power_w=latest_map.get("RF_POWER"),
            latest_relative_signal=latest_map.get("RELATIVE_SIGNAL"),
            mode="B",
            data_origin=run["data_origin"]
        )

@app.post("/api/v1/demo/runs", response_model=SummaryResponse, status_code=status.HTTP_201_CREATED)
def start_demo_run(req: StartRunRequest):
    run_suffix = uuid.uuid4().hex[:8]
    dataset = generate_etch_demo_dataset(seed=req.seed, scenario_id=req.scenario_id, run_suffix=run_suffix)
    with db_session() as conn:
        # Atomic single transaction:
        # 1. Mark previous sessions inactive
        conn.execute("UPDATE simulation_session SET is_active = 0 WHERE is_active = 1;")
        
        # 2. Insert new session non-destructively (INSERT INTO, NO REPLACE)
        s = dataset["session"]
        conn.execute(
            """
            INSERT INTO simulation_session (session_id, scenario_id, seed, is_active, integrity_status, started_at_utc)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            (s["session_id"], s["scenario_id"], s["seed"], 1, s["integrity_status"], s["started_at_utc"])
        )
        # 3. Insert run (INSERT INTO, NO REPLACE)
        r = dataset["run"]
        r["equipment_id"] = req.equipment_id
        r["chamber_id"] = req.chamber_id
        conn.execute(
            """
            INSERT INTO process_run (run_id, session_id, equipment_id, chamber_id, recipe_id, lot_id, data_origin, start_time_utc, run_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (r["run_id"], r["session_id"], r["equipment_id"], r["chamber_id"], r["recipe_id"], r["lot_id"], r["data_origin"], r["start_time_utc"], r["run_status"])
        )
        # 4. Insert wafers (INSERT INTO, NO REPLACE)
        for w in dataset["wafers"]:
            conn.execute(
                """
                INSERT INTO process_run_wafer (run_wafer_id, session_id, run_id, wafer_id, lot_id, slot_number, wafer_sequence_in_run, exposure_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (w["run_wafer_id"], w["session_id"], w["run_id"], w["wafer_id"], w["lot_id"], w["slot_number"], w["wafer_sequence_in_run"], w["exposure_status"])
            )
        # 5. Insert measurements (INSERT INTO, NO REPLACE)
        for m in dataset["samples"]:
            conn.execute(
                """
                INSERT INTO sensor_measurement (measurement_id, session_id, run_id, sensor_id, measured_value, unit, quality_flag, data_origin, event_time_utc, sim_time_utc, step_index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (m["measurement_id"], m["session_id"], m["run_id"], m["sensor_id"], m["measured_value"], m["unit"], m["quality_flag"], m["data_origin"], m["event_time_utc"], m["sim_time_utc"], m["step_index"])
            )
        # 6. Insert alerts (INSERT INTO, NO REPLACE)
        for a in dataset["alerts"]:
            conn.execute(
                """
                INSERT INTO fdc_alert (alert_id, session_id, run_id, equipment_id, chamber_id, severity, rule_code, message, status, event_time_utc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (a["alert_id"], a["session_id"], a["run_id"], a["equipment_id"], a["chamber_id"], a["severity"], a["rule_code"], a["message"], a["status"], a["event_time_utc"])
            )

    return get_demo_summary()

@app.get("/api/v1/demo/runs/{run_id}/samples", response_model=List[SensorSample])
def get_run_samples(run_id: str, sensor_id: Optional[str] = Query(default=None)):
    with db_session() as conn:
        if sensor_id:
            rows = conn.execute(
                """
                SELECT step_index, 'T' || step_index as time_label, sim_time_utc, sensor_id, measured_value, unit, quality_flag, data_origin
                FROM sensor_measurement
                WHERE run_id = ? AND sensor_id = ?
                ORDER BY step_index ASC;
                """,
                (run_id, sensor_id)
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT step_index, 'T' || step_index as time_label, sim_time_utc, sensor_id, measured_value, unit, quality_flag, data_origin
                FROM sensor_measurement
                WHERE run_id = ?
                ORDER BY step_index ASC, sensor_id ASC;
                """,
                (run_id,)
            ).fetchall()
        
        return [SensorSample(**dict(row)) for row in rows]

@app.get("/api/v1/demo/alerts", response_model=List[FdcAlertItem])
def get_demo_alerts(run_id: Optional[str] = Query(default=None)):
    with db_session() as conn:
        if run_id:
            rows = conn.execute(
                """
                SELECT alert_id, severity, equipment_id, chamber_id, run_id, rule_code, message, status, event_time_utc
                FROM fdc_alert
                WHERE run_id = ?
                ORDER BY event_time_utc DESC;
                """,
                (run_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT a.alert_id, a.severity, a.equipment_id, a.chamber_id, a.run_id, a.rule_code, a.message, a.status, a.event_time_utc
                FROM fdc_alert a
                JOIN simulation_session s ON a.session_id = s.session_id
                WHERE s.is_active = 1
                ORDER BY a.event_time_utc DESC;
                """
            ).fetchall()
            if not rows:
                rows = conn.execute(
                    """
                    SELECT alert_id, severity, equipment_id, chamber_id, run_id, rule_code, message, status, event_time_utc
                    FROM fdc_alert
                    ORDER BY event_time_utc DESC;
                    """
                ).fetchall()
        
        alerts = []
        for r in rows:
            alert = dict(r)
            if alert["rule_code"] == "FDC-RULE-SPC-UCL-01" or alert["alert_id"].startswith("AL-DEMO-001"):
                alert["candidate_lot"] = "LOT-DEMO-801"
                alert["candidate_wafers"] = ["W-08", "W-09", "W-10", "W-11", "W-12"]
            else:
                alert["candidate_lot"] = None
                alert["candidate_wafers"] = []
            alerts.append(FdcAlertItem(**alert))
            
        return alerts

@app.get("/api/v1/demo/wafers", response_model=List[WaferItem])
def get_demo_wafers(run_id: Optional[str] = None):
    with db_session() as conn:
        if not run_id:
            run = conn.execute(
                """
                SELECT r.run_id FROM process_run r
                JOIN simulation_session s ON r.session_id = s.session_id
                WHERE s.is_active = 1
                ORDER BY r.start_time_utc DESC LIMIT 1;
                """
            ).fetchone()
            if not run:
                run = conn.execute("SELECT run_id FROM process_run ORDER BY start_time_utc DESC LIMIT 1;").fetchone()
            if not run:
                return []
            run_id = run["run_id"]

        rows = conn.execute(
            """
            SELECT wafer_id, lot_id, slot_number, wafer_sequence_in_run as sequence, exposure_status
            FROM process_run_wafer
            WHERE run_id = ?
            ORDER BY slot_number ASC;
            """,
            (run_id,)
        ).fetchall()

        return [WaferItem(**dict(row)) for row in rows]

@app.post("/api/v1/demo/seek-anomaly")
def seek_anomaly():
    """Returns anomaly window state without modifying durable operational state."""
    with db_session() as conn:
        active_alert = conn.execute(
            """
            SELECT a.alert_id, a.equipment_id, a.chamber_id, a.rule_code
            FROM fdc_alert a
            JOIN simulation_session s ON a.session_id = s.session_id
            WHERE s.is_active = 1 AND a.rule_code = 'FDC-RULE-SPC-UCL-01'
            LIMIT 1;
            """
        ).fetchone()
        alert_id = active_alert["alert_id"] if active_alert else "AL-DEMO-001"
        equipment_id = active_alert["equipment_id"] if active_alert else "ETCH-02"
        chamber_id = active_alert["chamber_id"] if active_alert else "CH-B"

    return {
        "status": "anomaly_focused",
        "step_index": 7,
        "time_label": "T7",
        "alert_id": alert_id,
        "equipment_id": equipment_id,
        "chamber_id": chamber_id,
        "observed_value": 80.0,
        "unit": "a.u.",
        "ucl_threshold": 65.0,
        "exposure_status": "CANDIDATE_EXPOSED",
        "candidate_lot": "LOT-DEMO-801",
        "candidate_wafers": ["W-08", "W-09", "W-10", "W-11", "W-12"],
        "message": "Playback cursor moved to anomaly window at T7 (Spike observed)"
    }

