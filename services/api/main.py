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
    SensorEvidence,
    InvestigationDetail,
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


@app.get("/api/v1/demo/investigation", response_model=InvestigationDetail)
def get_demo_investigation(alert_id: Optional[str] = Query(default=None)):
    """
    Returns detailed engineering investigation context for an FDC excursion alert.
    Correlates sensor time-series spike evidence at step T7 with candidate affected wafers.
    """
    with db_session() as conn:
        # Find active session & run
        run = conn.execute(
            """
            SELECT r.run_id, r.equipment_id, r.chamber_id, r.recipe_id, r.lot_id, r.start_time_utc
            FROM process_run r
            JOIN simulation_session s ON r.session_id = s.session_id
            WHERE s.is_active = 1
            ORDER BY r.start_time_utc DESC LIMIT 1;
            """
        ).fetchone()
        if not run:
            run = conn.execute("SELECT run_id, equipment_id, chamber_id, recipe_id, lot_id, start_time_utc FROM process_run ORDER BY start_time_utc DESC LIMIT 1;").fetchone()
        if not run:
            raise HTTPException(status_code=404, detail="No active process run found")

        run_id = run["run_id"]

        # Find alert
        if alert_id:
            alert = conn.execute("SELECT * FROM fdc_alert WHERE alert_id = ?;", (alert_id,)).fetchone()
        else:
            alert = conn.execute("SELECT * FROM fdc_alert WHERE run_id = ? ORDER BY event_time_utc DESC LIMIT 1;", (run_id,)).fetchone()
        
        target_alert_id = alert["alert_id"] if alert else f"AL-{run_id}-001"
        severity = alert["severity"] if alert else "CRITICAL"
        rule_code = alert["rule_code"] if alert else "FDC-RULE-SPC-UCL-01"
        event_time = alert["event_time_utc"] if alert else run["start_time_utc"]

        # Fetch step 7 measurements for this run
        sample_rows = conn.execute(
            """
            SELECT sensor_id, measured_value, unit, quality_flag
            FROM sensor_measurement
            WHERE run_id = ? AND step_index = 7;
            """,
            (run_id,)
        ).fetchall()
        
        meas_map = {row["sensor_id"]: row for row in sample_rows}

        # Build evidence sensors
        evidence = []
        # 1. RELATIVE_SIGNAL
        rel_meas = meas_map.get("RELATIVE_SIGNAL")
        rel_val = float(rel_meas["measured_value"]) if rel_meas and rel_meas["measured_value"] is not None else 80.0
        evidence.append(SensorEvidence(
            sensor_id="RELATIVE_SIGNAL",
            sensor_name="광학 발광 상대 신호 (OES Relative Signal)",
            measured_value=rel_val,
            unit="a.u.",
            quality_flag=rel_meas["quality_flag"] if rel_meas else "SUSPECT",
            ucl_threshold=65.0,
            target_value=50.0,
            deviation_percent=round(((rel_val - 65.0) / 65.0) * 100.0, 1)
        ))

        # 2. CHAMBER_PRESSURE
        prs_meas = meas_map.get("CHAMBER_PRESSURE")
        prs_val = float(prs_meas["measured_value"]) if prs_meas and prs_meas["measured_value"] is not None else 168.5
        evidence.append(SensorEvidence(
            sensor_id="CHAMBER_PRESSURE",
            sensor_name="챔버 공정 진공 압력 (Capacitance Manometer)",
            measured_value=prs_val,
            unit="mTorr",
            quality_flag=prs_meas["quality_flag"] if prs_meas else "SUSPECT",
            ucl_threshold=140.0,
            target_value=120.0,
            deviation_percent=round(((prs_val - 140.0) / 140.0) * 100.0, 1)
        ))

        # 3. RF_POWER
        rf_meas = meas_map.get("RF_POWER")
        rf_val = float(rf_meas["measured_value"]) if rf_meas and rf_meas["measured_value"] is not None else 1820.0
        evidence.append(SensorEvidence(
            sensor_id="RF_POWER",
            sensor_name="RF 플라즈마 전원 출력 (RF Generator Forward Power)",
            measured_value=rf_val,
            unit="W",
            quality_flag=rf_meas["quality_flag"] if rf_meas else "SUSPECT",
            ucl_threshold=1650.0,
            target_value=1500.0,
            deviation_percent=round(((rf_val - 1650.0) / 1650.0) * 100.0, 1)
        ))

        # Wafers
        wafer_rows = conn.execute(
            """
            SELECT wafer_id, exposure_status
            FROM process_run_wafer
            WHERE run_id = ?
            ORDER BY slot_number ASC;
            """,
            (run_id,)
        ).fetchall()

        confirmed_wafers = [w["wafer_id"] for w in wafer_rows if w["exposure_status"] == "CONFIRMED_EXPOSED"]
        candidate_wafers = [w["wafer_id"] for w in wafer_rows if w["exposure_status"] == "CANDIDATE_EXPOSED"]
        unexposed_count = len([w for w in wafer_rows if w["exposure_status"] == "NOT_EXPOSED"])

        if not confirmed_wafers and not candidate_wafers:
            confirmed_wafers = [f"W-0{i}" for i in range(1, 8)]
            candidate_wafers = ["W-08", "W-09", "W-10", "W-11", "W-12"]
            unexposed_count = 13

        return InvestigationDetail(
            investigation_id=f"INV-{target_alert_id}",
            alert_id=target_alert_id,
            equipment_id=run["equipment_id"],
            chamber_id=run["chamber_id"],
            run_id=run_id,
            lot_id=run["lot_id"],
            recipe_id=run["recipe_id"],
            event_time_utc=event_time,
            anomaly_step=7,
            severity=severity,
            rule_code=rule_code,
            status="UNDER_INVESTIGATION",
            evidence_sensors=evidence,
            total_wafers=25,
            confirmed_exposed_wafers=confirmed_wafers,
            candidate_exposed_wafers=candidate_wafers,
            unexposed_wafers_count=unexposed_count,
            disclaimer="※ [품질 분석 가이드라인] 센서 이상 계측(FDC Spike)은 식각 챔버 내 공정 조건 일탈(Excursion) 감지이며, 웨이퍼의 물리적 결함(Defect) 확정 원인이 아닙니다. 결함 확정은 후속 계측(Defect Review / EDS)을 통한 교차 분석이 필수적입니다.",
            recommended_dispositions=[
                "[장비 조치] CH-B 챔버 일시 공정 인터록 및 쿼츠 링/RF 정합 회로 점검",
                "[품질 조치] 잠재 영향군(W-08~W-12) 결함 검측(Defect Inspection) 우선 배정",
                "[공정 승인] 로트 처리 보류(Hold) 등록 및 수석 엔지니어 검토 대기"
            ]
        )


