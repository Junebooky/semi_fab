import os
import sqlite3
import tempfile
import unittest
from fastapi.testclient import TestClient

from services.api.config import SQLITE_DB_PATH
from services.api.database import init_db, db_session
from services.api.main import app, seed_demo_data_if_needed


class TestEtchDemoAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create test DB
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.test_db_path = os.path.join(cls.temp_dir.name, "test_fab_one.db")
        os.environ["FAB_SQLITE_PATH"] = cls.test_db_path
        
        init_db(cls.test_db_path)
        seed_demo_data_if_needed(cls.test_db_path)

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.temp_dir.cleanup()
        os.environ.pop("FAB_SQLITE_PATH", None)

    def test_01_health_check(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["mode"], "B")
        self.assertEqual(data["database"], "connected")

    def test_02_summary(self):
        response = self.client.get("/api/v1/demo/summary")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["equipment_id"], "ETCH-02")
        self.assertEqual(data["chamber_id"], "CH-B")
        self.assertEqual(data["lot_id"], "LOT-DEMO-801")
        self.assertEqual(data["total_wafers"], 25)
        self.assertEqual(data["exposed_wafers"], 7)
        self.assertGreaterEqual(data["active_alerts_count"], 1)

    def test_03_samples_retrieval(self):
        summary = self.client.get("/api/v1/demo/summary").json()
        run_id = summary["active_run_id"]

        # All samples
        res = self.client.get(f"/api/v1/demo/runs/{run_id}/samples")
        self.assertEqual(res.status_code, 200)
        samples = res.json()
        self.assertGreater(len(samples), 0)

        # Filtered by RELATIVE_SIGNAL
        res_sig = self.client.get(f"/api/v1/demo/runs/{run_id}/samples?sensor_id=RELATIVE_SIGNAL")
        self.assertEqual(res_sig.status_code, 200)
        sig_samples = res_sig.json()
        self.assertEqual(len(sig_samples), 8)  # T0 ~ T7

        # Check missing data representation: T4 and T5 are None/null
        t4_sample = [s for s in sig_samples if s["step_index"] == 4][0]
        self.assertIsNone(t4_sample["measured_value"])
        self.assertEqual(t4_sample["quality_flag"], "MISSING")

        # T7 anomaly check
        t7_sample = [s for s in sig_samples if s["step_index"] == 7][0]
        self.assertEqual(t7_sample["measured_value"], 80.0)

    def test_04_alerts(self):
        res = self.client.get("/api/v1/demo/alerts")
        self.assertEqual(res.status_code, 200)
        alerts = res.json()
        self.assertGreaterEqual(len(alerts), 1)
        al1 = [a for a in alerts if "AL-DEMO-001" in a["alert_id"]][0]
        self.assertEqual(al1["severity"], "CRITICAL")
        self.assertEqual(al1["equipment_id"], "ETCH-02")
        self.assertEqual(al1["candidate_lot"], "LOT-DEMO-801")
        self.assertIn("W-08", al1["candidate_wafers"])

    def test_05_wafers(self):
        res = self.client.get("/api/v1/demo/wafers")
        self.assertEqual(res.status_code, 200)
        wafers = res.json()
        self.assertEqual(len(wafers), 25)
        # Check slot 1..7 confirmed exposed
        for i in range(7):
            self.assertEqual(wafers[i]["exposure_status"], "CONFIRMED_EXPOSED")
        # Check candidate exposed
        candidates = [w for w in wafers if w["exposure_status"] == "CANDIDATE_EXPOSED"]
        self.assertEqual(len(candidates), 5)
        self.assertEqual([w["wafer_id"] for w in candidates], ["W-08", "W-09", "W-10", "W-11", "W-12"])

    def test_06_seek_anomaly(self):
        res = self.client.post("/api/v1/demo/seek-anomaly")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "anomaly_focused")
        self.assertEqual(data["step_index"], 7)
        self.assertIn("AL-DEMO-001", data["alert_id"])
        self.assertEqual(data["observed_value"], 80.0)

    def test_07_start_new_run_seed(self):
        res = self.client.post(
            "/api/v1/demo/runs",
            json={
                "seed": 9999,
                "scenario_id": "ETH-SYN-01",
                "equipment_id": "ETCH-02",
                "chamber_id": "CH-B"
            }
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["equipment_id"], "ETCH-02")
        self.assertEqual(data["total_wafers"], 25)

    def test_08_restart_same_seed_foreign_key_safety(self):
        """
        Regression test for P0 defect:
        When UI or API restarts a demo with the same seed (20261015) repeatedly,
        it must NOT cause SQLite FK RESTRICT violation, must not lose previous runs,
        and must maintain exactly one active session.
        """
        initial_summary = self.client.get("/api/v1/demo/summary").json()
        initial_run_id = initial_summary["active_run_id"]

        # Call 1: Restart with same default seed 20261015
        res1 = self.client.post(
            "/api/v1/demo/runs",
            json={
                "seed": 20261015,
                "scenario_id": "ETH-SYN-01",
                "equipment_id": "ETCH-02",
                "chamber_id": "CH-B"
            }
        )
        self.assertEqual(res1.status_code, 201, f"Failed on restart 1 with same seed: {res1.text}")
        run1_data = res1.json()
        run1_id = run1_data["active_run_id"]
        self.assertNotEqual(initial_run_id, run1_id, "New run must have a distinct non-destructive run ID")

        # Call 2: Restart AGAIN with same default seed 20261015 immediately
        res2 = self.client.post(
            "/api/v1/demo/runs",
            json={
                "seed": 20261015,
                "scenario_id": "ETH-SYN-01",
                "equipment_id": "ETCH-02",
                "chamber_id": "CH-B"
            }
        )
        self.assertEqual(res2.status_code, 201, f"Failed on restart 2 with same seed: {res2.text}")
        run2_data = res2.json()
        run2_id = run2_data["active_run_id"]
        self.assertNotEqual(run1_id, run2_id, "Second restart must have a distinct non-destructive run ID")

        # Call 3: Seed cycle A (20261015) -> B (42) -> A (20261015)
        res_b = self.client.post(
            "/api/v1/demo/runs",
            json={"seed": 42, "scenario_id": "ETH-SYN-01", "equipment_id": "ETCH-02", "chamber_id": "CH-B"}
        )
        self.assertEqual(res_b.status_code, 201)

        res_a_again = self.client.post(
            "/api/v1/demo/runs",
            json={"seed": 20261015, "scenario_id": "ETH-SYN-01", "equipment_id": "ETCH-02", "chamber_id": "CH-B"}
        )
        self.assertEqual(res_a_again.status_code, 201)

        # Database Integrity Invariants Check
        with db_session(self.test_db_path) as conn:
            # 1. PRAGMA foreign_key_check MUST be completely empty (0 violations)
            fk_violations = conn.execute("PRAGMA foreign_key_check;").fetchall()
            self.assertEqual(len(fk_violations), 0, f"Foreign key violations detected: {fk_violations}")

            # 2. Exactly one simulation_session has is_active = 1
            active_sessions = conn.execute("SELECT session_id FROM simulation_session WHERE is_active = 1;").fetchall()
            self.assertEqual(len(active_sessions), 1, "Exactly one session must be active at any time")

            # 3. Previous sessions are preserved (non-destructive history)
            total_sessions = conn.execute("SELECT COUNT(*) FROM simulation_session;").fetchone()[0]
            self.assertGreaterEqual(total_sessions, 4, "Historical sessions must be preserved without deletion")

            # 4. Previous runs are preserved
            total_runs = conn.execute("SELECT COUNT(*) FROM process_run;").fetchone()[0]
            self.assertGreaterEqual(total_runs, 4, "Historical runs must be preserved without deletion")

        # Verify latest summary and samples correspond to the latest active run
        latest_summary = self.client.get("/api/v1/demo/summary").json()
        self.assertEqual(latest_summary["active_run_id"], res_a_again.json()["active_run_id"])

        latest_samples = self.client.get(f"/api/v1/demo/runs/{latest_summary['active_run_id']}/samples").json()
        self.assertEqual(len(latest_samples), 24)  # 8 steps * 3 sensors

    def test_09_sensor_quality_differentiation(self):
        """
        Regression test for P1-01:
        Verify that CHAMBER_PRESSURE and RF_POWER maintain continuous measurements
        with GOOD quality flag across all steps including T4 and T5, while RELATIVE_SIGNAL
        correctly models the optical shutter gap as MISSING at T4 and T5.
        At T7 anomaly spike, quality_flag is SUSPECT.
        """
        summary = self.client.get("/api/v1/demo/summary").json()
        run_id = summary["active_run_id"]

        # 1. CHAMBER_PRESSURE checks
        prs_res = self.client.get(f"/api/v1/demo/runs/{run_id}/samples?sensor_id=CHAMBER_PRESSURE")
        self.assertEqual(prs_res.status_code, 200)
        prs_samples = prs_res.json()
        self.assertEqual(len(prs_samples), 8)

        for s in prs_samples:
            step = s["step_index"]
            self.assertIsNotNone(s["measured_value"], f"Pressure at T{step} must not be None")
            if step == 7:
                self.assertEqual(s["quality_flag"], "SUSPECT", "Pressure at T7 must be SUSPECT")
                self.assertGreater(s["measured_value"], 140.0)
            else:
                self.assertEqual(s["quality_flag"], "GOOD", f"Pressure at T{step} must be GOOD")
                self.assertLess(s["measured_value"], 140.0, f"Pressure at T{step} must be below UCL")
                self.assertGreater(s["measured_value"], 100.0, f"Pressure at T{step} must be above vacuum lower bound")

        # 2. RELATIVE_SIGNAL checks
        rel_res = self.client.get(f"/api/v1/demo/runs/{run_id}/samples?sensor_id=RELATIVE_SIGNAL")
        self.assertEqual(rel_res.status_code, 200)
        rel_samples = rel_res.json()
        self.assertEqual(len(rel_samples), 8)

        t4_rel = [s for s in rel_samples if s["step_index"] == 4][0]
        t5_rel = [s for s in rel_samples if s["step_index"] == 5][0]
        self.assertIsNone(t4_rel["measured_value"])
        self.assertEqual(t4_rel["quality_flag"], "MISSING")
        self.assertIsNone(t5_rel["measured_value"])
        self.assertEqual(t5_rel["quality_flag"], "MISSING")

        t7_rel = [s for s in rel_samples if s["step_index"] == 7][0]
        self.assertIsNotNone(t7_rel["measured_value"])
        self.assertEqual(t7_rel["quality_flag"], "SUSPECT")

    def test_10_engineering_investigation_detail(self):
        """
        Verification test for BUILD-02 Engineering Investigation:
        Correlates FDC excursion alert with step T7 sensor evidence, candidate wafers,
        and domain disclaimer stating that sensor excursion is not confirmed wafer defect.
        """
        res = self.client.get("/api/v1/demo/investigation")
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertIn("INV-", data["investigation_id"])
        self.assertEqual(data["equipment_id"], "ETCH-02")
        self.assertEqual(data["chamber_id"], "CH-B")
        self.assertEqual(data["anomaly_step"], 7)
        self.assertEqual(data["severity"], "CRITICAL")
        self.assertEqual(data["status"], "UNDER_INVESTIGATION")

        # 3 Evidence sensors at T7
        evidence = data["evidence_sensors"]
        self.assertEqual(len(evidence), 3)
        sensors = {e["sensor_id"]: e for e in evidence}
        self.assertIn("RELATIVE_SIGNAL", sensors)
        self.assertIn("CHAMBER_PRESSURE", sensors)
        self.assertIn("RF_POWER", sensors)

        self.assertEqual(sensors["RELATIVE_SIGNAL"]["quality_flag"], "SUSPECT")
        self.assertGreater(sensors["RELATIVE_SIGNAL"]["measured_value"], 65.0)

        self.assertEqual(sensors["CHAMBER_PRESSURE"]["quality_flag"], "SUSPECT")
        self.assertGreater(sensors["CHAMBER_PRESSURE"]["measured_value"], 140.0)

        # Wafer breakdown
        self.assertEqual(len(data["confirmed_exposed_wafers"]), 7)
        self.assertEqual(len(data["candidate_exposed_wafers"]), 5)
        self.assertEqual(data["candidate_exposed_wafers"], ["W-08", "W-09", "W-10", "W-11", "W-12"])
        self.assertEqual(data["unexposed_wafers_count"], 13)

        # Domain disclaimer
        self.assertIn("물리적 결함(Defect) 확정 원인이 아닙니다", data["disclaimer"])
        self.assertGreaterEqual(len(data["recommended_dispositions"]), 3)

    def test_11_investigation_alert_binding_and_standby_isolation(self):
        """
        P1-02 Verification:
        Guarantees that:
        1. An active-run CRITICAL alert query returns exact matching run/equipment/wafer evidence.
        2. A standby WARNING alert (AL-DEMO-002) without an active run returns HTTP 404 and NEVER leaks CH-B T7 excursion evidence.
        3. A non-existent alert ID returns HTTP 404.
        4. Cross-session querying for an old inactive session alert is rejected (HTTP 404).
        """
        # 1. Active run alert
        alerts_res = self.client.get("/api/v1/demo/alerts")
        self.assertEqual(alerts_res.status_code, 200)
        alerts = alerts_res.json()
        critical_alerts = [a for a in alerts if a["severity"] == "CRITICAL" and a["run_id"] is not None]
        self.assertGreaterEqual(len(critical_alerts), 1)
        active_critical = critical_alerts[0]

        res = self.client.get(f"/api/v1/demo/investigation?alert_id={active_critical['alert_id']}")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["alert_id"], active_critical["alert_id"])
        self.assertEqual(data["equipment_id"], "ETCH-02")
        self.assertEqual(data["chamber_id"], "CH-B")
        self.assertIn("RUN-DEMO-", data["run_id"])

        # 2. Standby warning alert without active run
        standby_alerts = [a for a in alerts if a["severity"] == "WARNING" or a["run_id"] is None]
        self.assertGreaterEqual(len(standby_alerts), 1)
        standby_alert = standby_alerts[0]

        res_standby = self.client.get(f"/api/v1/demo/investigation?alert_id={standby_alert['alert_id']}")
        self.assertEqual(res_standby.status_code, 404)
        self.assertIn("standby", res_standby.json()["detail"].lower())

        # 3. Non-existent alert
        res_nonexistent = self.client.get("/api/v1/demo/investigation?alert_id=AL-INVALID-999")
        self.assertEqual(res_nonexistent.status_code, 404)

        # 4. Inactive session isolation test
        # Create a new active session
        new_run_res = self.client.post("/api/v1/demo/runs", json={
            "seed": 9999,
            "scenario_id": "ETH-SYN-01",
            "equipment_id": "ETCH-02",
            "chamber_id": "CH-B"
        })
        self.assertEqual(new_run_res.status_code, 201)

        # Previous active alert now belongs to an inactive session
        res_old_alert = self.client.get(f"/api/v1/demo/investigation?alert_id={active_critical['alert_id']}")
        self.assertEqual(res_old_alert.status_code, 404)
        self.assertIn("inactive", res_old_alert.json()["detail"].lower())

    def test_12_rf_power_consistency_and_samples(self):
        """
        P1-01 Verification:
        Ensures RF_POWER measurements are consistent between time-series samples and investigation evidence:
        1. T0~T6 samples are around nominal target (1500W, GOOD).
        2. T7 sample is an anomaly excursion (>1650W UCL, SUSPECT).
        3. Investigation RF_POWER evidence exact match with step 7 measurement.
        """
        summary_res = self.client.get("/api/v1/demo/summary")
        self.assertEqual(summary_res.status_code, 200)
        run_id = summary_res.json()["active_run_id"]

        rf_res = self.client.get(f"/api/v1/demo/runs/{run_id}/samples?sensor_id=RF_POWER")
        self.assertEqual(rf_res.status_code, 200)
        rf_samples = rf_res.json()
        self.assertEqual(len(rf_samples), 8)

        # Steps 0~6: Nominal
        for s in rf_samples:
            if s["step_index"] < 7:
                self.assertEqual(s["quality_flag"], "GOOD")
                self.assertLess(s["measured_value"], 1650.0)
                self.assertGreater(s["measured_value"], 1400.0)

        # Step 7: Excursion
        t7_rf = [s for s in rf_samples if s["step_index"] == 7][0]
        self.assertEqual(t7_rf["quality_flag"], "SUSPECT")
        self.assertGreater(t7_rf["measured_value"], 1650.0)

        # Investigation evidence matches
        inv_res = self.client.get("/api/v1/demo/investigation")
        self.assertEqual(inv_res.status_code, 200)
        evidence = inv_res.json()["evidence_sensors"]
        rf_ev = [e for e in evidence if e["sensor_id"] == "RF_POWER"][0]
        self.assertEqual(rf_ev["measured_value"], t7_rf["measured_value"])
        self.assertEqual(rf_ev["quality_flag"], t7_rf["quality_flag"])


if __name__ == "__main__":
    unittest.main()
