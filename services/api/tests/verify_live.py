import urllib.request
import json
import sys

def verify():
    base_url = "http://127.0.0.1:8000"
    
    # 1. Health
    with urllib.request.urlopen(f"{base_url}/api/v1/health") as res:
        health = json.loads(res.read().decode())
        print(f"[PASS] Health: status={health['status']}, mode={health['mode']}")
        assert health['status'] == 'ok'
        assert health['mode'] == 'B'

    # 2. Summary
    with urllib.request.urlopen(f"{base_url}/api/v1/demo/summary") as res:
        summary = json.loads(res.read().decode())
        print(f"[PASS] Summary: equipment={summary['equipment_id']}, chamber={summary['chamber_id']}, lot={summary['lot_id']}, wafers={summary['total_wafers']}")
        assert summary['equipment_id'] == 'ETCH-02'
        assert summary['chamber_id'] == 'CH-B'

    # 3. Samples
    with urllib.request.urlopen(f"{base_url}/api/v1/demo/runs/{summary['active_run_id']}/samples?sensor_id=RELATIVE_SIGNAL") as res:
        samples = json.loads(res.read().decode())
        print(f"[PASS] Samples count: {len(samples)} (T0~T7)")
        assert len(samples) == 8
        t4 = [s for s in samples if s['step_index'] == 4][0]
        assert t4['measured_value'] is None
        assert t4['quality_flag'] == 'MISSING'
        t7 = [s for s in samples if s['step_index'] == 7][0]
        assert t7['measured_value'] == 80.0
        print("[PASS] Missing invariant (T4 null) and Anomaly invariant (T7=80.0) satisfied")

    # 4. Alerts
    with urllib.request.urlopen(f"{base_url}/api/v1/demo/alerts") as res:
        alerts = json.loads(res.read().decode())
        print(f"[PASS] Alerts count: {len(alerts)}")
        assert len(alerts) >= 1
        al = alerts[0]
        assert al['alert_id'] == 'AL-DEMO-001'
        assert al['candidate_lot'] == 'LOT-DEMO-801'
        assert 'W-08' in al['candidate_wafers']

    # 5. Wafers
    with urllib.request.urlopen(f"{base_url}/api/v1/demo/wafers") as res:
        wafers = json.loads(res.read().decode())
        print(f"[PASS] Wafers count: {len(wafers)}")
        assert len(wafers) == 25
        confirmed = [w for w in wafers if w['exposure_status'] == 'CONFIRMED_EXPOSED']
        candidates = [w for w in wafers if w['exposure_status'] == 'CANDIDATE_EXPOSED']
        assert len(confirmed) == 7
        assert len(candidates) == 5

    # 6. Seek Anomaly
    req = urllib.request.Request(f"{base_url}/api/v1/demo/seek-anomaly", data=b"", method="POST")
    with urllib.request.urlopen(req) as res:
        seek = json.loads(res.read().decode())
        print(f"[PASS] Seek Anomaly: status={seek['status']}, step={seek['step_index']}, alert={seek['alert_id']}")
        assert seek['status'] == 'anomaly_focused'
        assert seek['step_index'] == 7

    # 7. Frontend check
    with urllib.request.urlopen("http://localhost:3000") as res:
        html = res.read().decode()
        assert "FAB ONE" in html
        assert "ETCH-02" in html
        assert "LOT-DEMO-801" in html
        print("[PASS] Frontend SSR rendered successfully on http://localhost:3000")

    print("\nALL 7 LIVE INTEGRATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    verify()
