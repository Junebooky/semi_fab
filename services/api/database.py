import sqlite3
from typing import Generator
from contextlib import contextmanager
from .config import get_db_path

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS simulation_session (
    session_id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    seed INTEGER NOT NULL,
    is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
    integrity_status TEXT NOT NULL DEFAULT 'VALID' CHECK (integrity_status IN ('VALID', 'INTEGRITY_COMPROMISED')),
    integrity_reason TEXT,
    integrity_marked_at_utc TEXT,
    started_at_utc TEXT NOT NULL,
    completed_at_utc TEXT
);

CREATE TABLE IF NOT EXISTS process_run (
    run_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    equipment_id TEXT NOT NULL,
    chamber_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    data_origin TEXT NOT NULL DEFAULT 'synthetic',
    start_time_utc TEXT NOT NULL,
    end_time_utc TEXT,
    run_status TEXT NOT NULL CHECK (run_status IN ('READY', 'IN_PROGRESS', 'COMPLETED', 'ABORTED', 'FAILED')),
    FOREIGN KEY (session_id) REFERENCES simulation_session(session_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS process_run_wafer (
    run_wafer_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    wafer_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 25),
    wafer_sequence_in_run INTEGER NOT NULL,
    exposure_start_time_utc TEXT,
    exposure_end_time_utc TEXT,
    exposure_status TEXT NOT NULL CHECK (exposure_status IN ('CONFIRMED_EXPOSED', 'CANDIDATE_EXPOSED', 'NOT_EXPOSED', 'BYPASSED', 'UNKNOWN')),
    FOREIGN KEY (run_id) REFERENCES process_run(run_id) ON DELETE RESTRICT,
    FOREIGN KEY (session_id) REFERENCES simulation_session(session_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sensor_measurement (
    measurement_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    measured_value REAL,
    unit TEXT NOT NULL,
    quality_flag TEXT NOT NULL CHECK (quality_flag IN ('GOOD', 'SUSPECT', 'BAD', 'MISSING')),
    data_origin TEXT NOT NULL DEFAULT 'synthetic',
    event_time_utc TEXT NOT NULL,
    sim_time_utc TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    FOREIGN KEY (run_id) REFERENCES process_run(run_id) ON DELETE RESTRICT,
    FOREIGN KEY (session_id) REFERENCES simulation_session(session_id) ON DELETE RESTRICT,
    CHECK (
        (quality_flag = 'MISSING' AND measured_value IS NULL) OR
        (quality_flag IN ('GOOD', 'SUSPECT', 'BAD') AND measured_value IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS fdc_alert (
    alert_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    run_id TEXT,
    equipment_id TEXT NOT NULL,
    chamber_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    rule_code TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
    event_time_utc TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES simulation_session(session_id) ON DELETE RESTRICT
);
"""

def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    target_path = db_path if db_path is not None else get_db_path()
    conn = sqlite3.connect(target_path, timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn

@contextmanager
def db_session(db_path: str | None = None) -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db(db_path: str | None = None) -> None:
    with db_session(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
