import os
import tempfile
import unittest
from fastapi.testclient import TestClient

from services.api.config import SQLITE_DB_PATH
from services.api.database import init_db
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
        al1 = [a for a in alerts if a["alert_id"] == "AL-DEMO-001"][0]
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
        self.assertEqual(data["alert_id"], "AL-DEMO-001")
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


if __name__ == "__main__":
    unittest.main()
