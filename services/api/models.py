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
