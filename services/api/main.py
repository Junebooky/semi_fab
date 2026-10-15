import uuid
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, SQLITE_DB_PATH
from .database import init_db, db_session
from datetime import datetime, timedelta, timezone
from .models import (
    HealthResponse,
    StartRunRequest,
    SummaryResponse,
    SensorSample,
    FdcAlertItem,
    WaferItem,
    SensorEvidence,
    InvestigationDetail,
    WaferTimelineEvent,
    WaferTraceDetail,
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

@app.get("/api/v1/demo/wafers/{wafer_id}/trace", response_model=WaferTraceDetail)
def get_wafer_trace(wafer_id: str, run_id: Optional[str] = Query(default=None)):
    """
    Returns full Lot/Wafer Traceability detail and chronological process timeline for a specific wafer.
    Guarantees strict binding with run, equipment, chamber, recipe, and related FDC excursion alert.
    All data is clearly tagged with data_origin: 'synthetic'.
    """
    with db_session() as conn:
        if run_id:
            run = conn.execute(
                "SELECT run_id, session_id, equipment_id, chamber_id, recipe_id, lot_id, data_origin, start_time_utc FROM process_run WHERE run_id = ?;",
                (run_id,)
            ).fetchone()
            if not run:
                raise HTTPException(status_code=404, detail=f"Process run '{run_id}' not found")
        else:
            run = conn.execute(
                """
                SELECT r.run_id, r.session_id, r.equipment_id, r.chamber_id, r.recipe_id, r.lot_id, r.data_origin, r.start_time_utc
                FROM process_run r
                JOIN simulation_session s ON r.session_id = s.session_id
                WHERE s.is_active = 1
                ORDER BY r.start_time_utc DESC LIMIT 1;
                """
            ).fetchone()
            if not run:
                run = conn.execute("SELECT run_id, session_id, equipment_id, chamber_id, recipe_id, lot_id, data_origin, start_time_utc FROM process_run ORDER BY start_time_utc DESC LIMIT 1;").fetchone()
            if not run:
                raise HTTPException(status_code=404, detail="No active process run found")
            run_id = run["run_id"]

        wafer = conn.execute(
            """
            SELECT wafer_id, lot_id, slot_number, wafer_sequence_in_run as sequence, exposure_status
            FROM process_run_wafer
            WHERE run_id = ? AND wafer_id = ?;
            """,
            (run_id, wafer_id)
        ).fetchone()

        if not wafer:
            raise HTTPException(status_code=404, detail=f"Wafer '{wafer_id}' not found in run '{run_id}'")

        # Related FDC alert for this run
        alert = conn.execute(
            """
            SELECT alert_id, severity, rule_code, message, event_time_utc
            FROM fdc_alert
            WHERE run_id = ? AND severity = 'CRITICAL'
            ORDER BY event_time_utc DESC LIMIT 1;
            """,
            (run_id,)
        ).fetchone()

        exposure_status = wafer["exposure_status"]
        slot_number = wafer["slot_number"]

        related_alert_id = None
        related_alert_rule = None
        related_alert_severity = None
        investigation_id = None

        if exposure_status in ("CONFIRMED_EXPOSED", "CANDIDATE_EXPOSED") and alert:
            related_alert_id = alert["alert_id"]
            related_alert_rule = alert["rule_code"]
            related_alert_severity = alert["severity"]
            investigation_id = f"INV-{alert['alert_id']}"

        # Parse start_time_utc
        try:
            base_dt = datetime.fromisoformat(run["start_time_utc"].replace("Z", "+00:00"))
        except Exception:
            base_dt = datetime.now(timezone.utc)

        t_m60 = (base_dt - timedelta(seconds=60)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        t_m20 = (base_dt - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        t_0 = base_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        t_p35 = (base_dt + timedelta(seconds=35)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        t_p60 = (base_dt + timedelta(seconds=60)).strftime("%Y-%m-%dT%H:%M:%S.000Z")

        timeline: List[WaferTimelineEvent] = [
            WaferTimelineEvent(
                step_index=1,
                step_name="FOUP 카세트 로드 및 RFID 슬롯 매핑",
                time_label="T-60s",
                timestamp_utc=t_m60,
                equipment_id=run["equipment_id"],
                chamber_id="LOADPORT-01",
                event_type="LOAD",
                status="COMPLETED",
                description=f"25매 FOUP 로트({run['lot_id']}) 로드포트 01 안착, RFID 태그 판독 및 슬롯 #{slot_number} 위치 매핑 완료."
            ),
            WaferTimelineEvent(
                step_index=2,
                step_name="웨이퍼 반송 및 사전 정렬 (Pre-Align)",
                time_label="T-20s",
                timestamp_utc=t_m20,
                equipment_id=run["equipment_id"],
                chamber_id="ALIGNER-01",
                event_type="ALIGN",
                status="COMPLETED",
                description=f"대기 반송 로봇(EFEM)에 의해 노치(Notch) 정렬 및 레시피({run['recipe_id']}) 공정 파라미터 사전 매핑 완료."
            ),
        ]

        # Step 3: Process or Queue or Stored
        if exposure_status == "CONFIRMED_EXPOSED":
            timeline.append(WaferTimelineEvent(
                step_index=3,
                step_name=f"식각 공정 진행 완료 ({run['chamber_id']} Main Etch)",
                time_label="T0 ~ T6",
                timestamp_utc=t_0,
                equipment_id=run["equipment_id"],
                chamber_id=run["chamber_id"],
                event_type="PROCESS",
                status="COMPLETED",
                description=f"식각 챔버({run['chamber_id']}) 정전척(ESC) 안착 및 고주파 플라즈마 방전 식각 공정 완료."
            ))
        elif exposure_status == "CANDIDATE_EXPOSED":
            timeline.append(WaferTimelineEvent(
                step_index=3,
                step_name="챔버 진입 대기 큐 (Loadlock Buffer Queue)",
                time_label="T6 ~ T7",
                timestamp_utc=t_0,
                equipment_id=run["equipment_id"],
                chamber_id="LOADLOCK-B",
                event_type="PROCESS",
                status="INTERRUPTED",
                description=f"진공 로드락 버퍼에서 {run['chamber_id']} 진입 준비 중 T7 센서 일탈 스파이크 감지로 이송 인터록(Interrupted) 발동."
            ))
        else:
            timeline.append(WaferTimelineEvent(
                step_index=3,
                step_name="FOUP 카세트 내 미노출 대기 (Cassette Stored)",
                time_label="T0 ~ T7",
                timestamp_utc=t_0,
                equipment_id=run["equipment_id"],
                chamber_id="LOADPORT-01",
                event_type="PROCESS",
                status="SKIPPED",
                description="선행 웨이퍼 가공 중 챔버 일탈 발생으로 공정 시퀀스가 정지되어 FOUP 카세트 내 미가공(Not Exposed) 상태 유지."
            ))

        # Step 4: Interlock / Anomaly
        if exposure_status in ("CONFIRMED_EXPOSED", "CANDIDATE_EXPOSED"):
            timeline.append(WaferTimelineEvent(
                step_index=4,
                step_name="FDC 센서 공정 이상 감지 (SPC UCL Excursion)",
                time_label="T7",
                timestamp_utc=t_p35,
                equipment_id=run["equipment_id"],
                chamber_id=run["chamber_id"],
                event_type="INTERLOCK",
                status="HELD",
                description=f"식각 챔버({run['chamber_id']}) 압력/RF Power 급증으로 FDC 이상 알람({related_alert_id or 'AL-DEMO-001'}) 트리거 및 설비 인터록."
            ))
        else:
            timeline.append(WaferTimelineEvent(
                step_index=4,
                step_name="설비 안전 인터록 정지 (Safety Interlock)",
                time_label="T7",
                timestamp_utc=t_p35,
                equipment_id=run["equipment_id"],
                chamber_id=run["equipment_id"],
                event_type="INTERLOCK",
                status="COMPLETED",
                description="설비 전역 비상 인터록 정지 작동으로 추가 웨이퍼 반송 차단."
            ))

        # Step 5: Disposition / Quality Hold
        if exposure_status == "CANDIDATE_EXPOSED":
            timeline.append(WaferTimelineEvent(
                step_index=5,
                step_name="품질 보류 판정 및 결함 검측 배정 (Quality Hold)",
                time_label="T8+",
                timestamp_utc=t_p60,
                equipment_id=run["equipment_id"],
                chamber_id="QA-DISPOSITION",
                event_type="HOLD",
                status="HELD",
                description=f"엔지니어링 조사({investigation_id or 'INV-AL-DEMO-001'}) 연계: 잠재 노출 후보군으로 분류되어 결함 검측(Defect Review) 및 EDS 우선 검사군으로 배정됨."
            ))
        elif exposure_status == "CONFIRMED_EXPOSED":
            timeline.append(WaferTimelineEvent(
                step_index=5,
                step_name="노출 완료군 품질 일치성 검증 대기 (Lot Hold)",
                time_label="T8+",
                timestamp_utc=t_p60,
                equipment_id=run["equipment_id"],
                chamber_id="QA-DISPOSITION",
                event_type="HOLD",
                status="HELD",
                description="노출 완료군 품질 일치성 검증 및 박막 두께 측정 대기를 위해 로트 단위 품질 보류(Hold) 등록."
            ))
        else:
            timeline.append(WaferTimelineEvent(
                step_index=5,
                step_name="미노출 웨이퍼 재투입 대기 (Unexposed Disposition)",
                time_label="T8+",
                timestamp_utc=t_p60,
                equipment_id=run["equipment_id"],
                chamber_id="LOADPORT-01",
                event_type="HOLD",
                status="PENDING",
                description="미노출 안전 웨이퍼로 확인되어 설비 점검 완료 후 다음 생산 배치로 재투입 대기."
            ))

        return WaferTraceDetail(
            wafer_id=wafer["wafer_id"],
            lot_id=run["lot_id"],
            slot_number=slot_number,
            sequence=wafer["sequence"],
            exposure_status=exposure_status,
            equipment_id=run["equipment_id"],
            chamber_id=run["chamber_id"],
            run_id=run_id,
            recipe_id=run["recipe_id"],
            start_time_utc=run["start_time_utc"],
            data_origin="synthetic",
            is_synthetic=True,
            related_alert_id=related_alert_id,
            related_alert_rule=related_alert_rule,
            related_alert_severity=related_alert_severity,
            investigation_id=investigation_id,
            timeline=timeline
        )


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
    Guarantees strict binding between alert, equipment/chamber, run, and wafer evidence.
    """
    with db_session() as conn:
        if alert_id:
            alert = conn.execute("SELECT * FROM fdc_alert WHERE alert_id = ?;", (alert_id,)).fetchone()
            if not alert:
                raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
            
            if not alert["run_id"]:
                raise HTTPException(
                    status_code=404,
                    detail=f"Alert '{alert_id}' is a standby equipment alert with no active process run or wafer investigation context"
                )
            
            run = conn.execute(
                "SELECT run_id, session_id, equipment_id, chamber_id, recipe_id, lot_id, start_time_utc FROM process_run WHERE run_id = ?;",
                (alert["run_id"],)
            ).fetchone()
            if not run:
                raise HTTPException(status_code=404, detail=f"Process run '{alert['run_id']}' for alert '{alert_id}' not found")

            # Verify run belongs to active simulation session to avoid cross-session contamination
            session = conn.execute("SELECT is_active FROM simulation_session WHERE session_id = ?;", (run["session_id"],)).fetchone()
            if not session or not session["is_active"]:
                raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' belongs to an inactive or previous simulation session")

            # [P1-B Fix]: Strict multi-origin consistency checks between alert and run
            if alert["session_id"] != run["session_id"]:
                raise HTTPException(
                    status_code=404,
                    detail=f"Lineage mismatch: Alert '{alert_id}' session '{alert['session_id']}' does not match process run session '{run['session_id']}'"
                )

            if alert["equipment_id"] != run["equipment_id"]:
                raise HTTPException(
                    status_code=404,
                    detail=f"Equipment mismatch: Alert '{alert_id}' equipment '{alert['equipment_id']}' does not match process run equipment '{run['equipment_id']}'"
                )

            if alert["chamber_id"] != run["chamber_id"]:
                raise HTTPException(
                    status_code=404,
                    detail=f"Chamber mismatch: Alert '{alert_id}' chamber '{alert['chamber_id']}' does not match process run chamber '{run['chamber_id']}'"
                )
        else:
            # Default to latest active session's active run
            run = conn.execute(
                """
                SELECT r.run_id, r.session_id, r.equipment_id, r.chamber_id, r.recipe_id, r.lot_id, r.start_time_utc
                FROM process_run r
                JOIN simulation_session s ON r.session_id = s.session_id
                WHERE s.is_active = 1
                ORDER BY r.start_time_utc DESC LIMIT 1;
                """
            ).fetchone()
            if not run:
                raise HTTPException(status_code=404, detail="No active process run found in active simulation session")

            alert = conn.execute(
                """
                SELECT * FROM fdc_alert
                WHERE run_id = ? AND session_id = ? AND equipment_id = ? AND chamber_id = ?
                ORDER BY event_time_utc DESC LIMIT 1;
                """,
                (run["run_id"], run["session_id"], run["equipment_id"], run["chamber_id"])
            ).fetchone()
            if not alert:
                raise HTTPException(status_code=404, detail=f"No matching FDC excursion alert found for active run {run['run_id']}")

        run_id = run["run_id"]
        target_alert_id = alert["alert_id"]
        severity = alert["severity"]
        rule_code = alert["rule_code"]
        event_time = alert["event_time_utc"]

        # Fetch step 7 measurements for this specific run and session
        sample_rows = conn.execute(
            """
            SELECT sensor_id, measured_value, unit, quality_flag
            FROM sensor_measurement
            WHERE run_id = ? AND session_id = ? AND step_index = 7;
            """,
            (run_id, run["session_id"])
        ).fetchall()
        
        if not sample_rows:
            raise HTTPException(status_code=404, detail=f"No sensor measurement evidence recorded at step 7 for run {run_id}")

        meas_map = {row["sensor_id"]: row for row in sample_rows}

        # Build evidence sensors from actual measurements only (no invented observations)
        evidence = []
        meta_configs = [
            ("RELATIVE_SIGNAL", "광학 발광 상대 신호 (OES Relative Signal)", 65.0, 50.0),
            ("CHAMBER_PRESSURE", "챔버 공정 진공 압력 (Capacitance Manometer)", 140.0, 120.0),
            ("RF_POWER", "RF 플라즈마 전원 출력 (RF Generator Forward Power)", 1650.0, 1500.0),
        ]

        for sid, sname, ucl, tgt in meta_configs:
            meas = meas_map.get(sid)
            if meas and meas["measured_value"] is not None:
                val = float(meas["measured_value"])
                dev = round(((val - ucl) / ucl) * 100.0, 1)
                evidence.append(SensorEvidence(
                    sensor_id=sid,
                    sensor_name=sname,
                    measured_value=val,
                    unit=meas["unit"],
                    quality_flag=meas["quality_flag"],
                    ucl_threshold=ucl,
                    target_value=tgt,
                    deviation_percent=dev
                ))

        if not evidence:
            raise HTTPException(status_code=404, detail=f"No valid sensor evidence found at step 7 for run {run_id}")

        # Fetch actual wafers for this run and session
        wafer_rows = conn.execute(
            """
            SELECT wafer_id, exposure_status
            FROM process_run_wafer
            WHERE run_id = ? AND session_id = ?
            ORDER BY slot_number ASC;
            """,
            (run_id, run["session_id"])
        ).fetchall()

        if not wafer_rows:
            raise HTTPException(status_code=404, detail=f"No wafer cassette records found for run {run_id}")

        confirmed_wafers = [w["wafer_id"] for w in wafer_rows if w["exposure_status"] == "CONFIRMED_EXPOSED"]
        candidate_wafers = [w["wafer_id"] for w in wafer_rows if w["exposure_status"] == "CANDIDATE_EXPOSED"]
        unexposed_count = len([w for w in wafer_rows if w["exposure_status"] == "NOT_EXPOSED"])

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
            total_wafers=len(wafer_rows),
            confirmed_exposed_wafers=confirmed_wafers,
            candidate_exposed_wafers=candidate_wafers,
            unexposed_wafers_count=unexposed_count,
            disclaimer="※ [품질 분석 가이드라인] 센서 이상 계측(FDC Spike)은 식각 챔버 내 공정 조건 일탈(Excursion) 감지이며, 웨이퍼의 물리적 결함(Defect) 확정 원인이 아닙니다. 결함 확정은 후속 계측(Defect Review / EDS)을 통한 교차 분석이 필수적입니다.",
            recommended_dispositions=[
                f"[장비 조치] {run['chamber_id']} 챔버 일시 공정 인터록 및 쿼츠 링/RF 정합 회로 점검",
                f"[품질 조치] 잠재 영향군({candidate_wafers[0] if candidate_wafers else '후보군'}~{candidate_wafers[-1] if candidate_wafers else ''}) 결함 검측(Defect Inspection) 우선 배정",
                "[공정 승인] 로트 처리 보류(Hold) 등록 및 수석 엔지니어 검토 대기"
            ]
        )


