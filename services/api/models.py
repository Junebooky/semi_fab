from typing import List, Optional
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str
    mode: str
    database: str
    engine: str
    version: str

class StartRunRequest(BaseModel):
    seed: int = 20261015
    scenario_id: str = "ETH-SYN-01"
    equipment_id: str = "ETCH-02"
    chamber_id: str = "CH-B"

class SensorSample(BaseModel):
    step_index: int
    time_label: str
    sim_time_utc: str
    sensor_id: str
    measured_value: Optional[float]
    unit: str
    quality_flag: str
    data_origin: str

class FdcAlertItem(BaseModel):
    alert_id: str
    severity: str
    equipment_id: str
    chamber_id: str
    run_id: Optional[str]
    rule_code: str
    message: str
    status: str
    event_time_utc: str
    candidate_lot: Optional[str] = None
    candidate_wafers: List[str] = Field(default_factory=list)

class WaferItem(BaseModel):
    wafer_id: str
    lot_id: str
    slot_number: int
    sequence: int
    exposure_status: str

class SummaryResponse(BaseModel):
    equipment_id: str
    chamber_id: str
    active_session_id: str
    active_run_id: str
    lot_id: str
    recipe_id: str
    total_wafers: int
    exposed_wafers: int
    active_alerts_count: int
    latest_pressure_mtorr: Optional[float]
    latest_rf_power_w: Optional[float]
    latest_relative_signal: Optional[float]
    mode: str = "B"
    data_origin: str = "synthetic"

class CasebookRunItem(BaseModel):
    run_id: str
    session_id: str
    seed: int
    is_active: bool
    equipment_id: str
    chamber_id: str
    recipe_id: str
    lot_id: str
    start_time_utc: str
    run_status: str
    alert_id: Optional[str] = None
    alert_severity: Optional[str] = None
    alert_rule_code: Optional[str] = None
    data_origin: str = "synthetic"


class SensorEvidence(BaseModel):
    sensor_id: str
    sensor_name: str
    measured_value: float
    unit: str
    quality_flag: str
    ucl_threshold: float
    target_value: float
    deviation_percent: float

class InvestigationDetail(BaseModel):
    investigation_id: str
    alert_id: str
    equipment_id: str
    chamber_id: str
    run_id: str
    lot_id: str
    recipe_id: str
    event_time_utc: str
    anomaly_step: int
    severity: str
    rule_code: str
    status: str
    evidence_sensors: List[SensorEvidence]
    total_wafers: int
    confirmed_exposed_wafers: List[str]
    candidate_exposed_wafers: List[str]
    unexposed_wafers_count: int
    disclaimer: str
    recommended_dispositions: List[str]

class WaferTimelineEvent(BaseModel):
    step_index: int
    step_name: str
    time_label: str
    timestamp_utc: str
    equipment_id: str
    chamber_id: str
    event_type: str  # "LOAD", "ALIGN", "PROCESS", "INTERLOCK", "HOLD"
    status: str      # "COMPLETED", "INTERRUPTED", "HELD", "SKIPPED", "PENDING"
    description: str

class WaferTraceDetail(BaseModel):
    wafer_id: str
    lot_id: str
    slot_number: int
    sequence: int
    exposure_status: str  # "CONFIRMED_EXPOSED", "CANDIDATE_EXPOSED", "NOT_EXPOSED"
    equipment_id: str
    chamber_id: str
    run_id: str
    recipe_id: str
    start_time_utc: str
    data_origin: str = "synthetic"
    is_synthetic: bool = True
    related_alert_id: Optional[str] = None
    related_alert_rule: Optional[str] = None
    related_alert_severity: Optional[str] = None
    investigation_id: Optional[str] = None
    timeline: List[WaferTimelineEvent] = Field(default_factory=list)
