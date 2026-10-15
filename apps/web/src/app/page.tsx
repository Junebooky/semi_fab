'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Types
interface SensorSample {
  step_index: number;
  time_label: string;
  sim_time_utc: string;
  sensor_id: string;
  measured_value: number | null;
  unit: string;
  quality_flag: 'GOOD' | 'SUSPECT' | 'BAD' | 'MISSING';
  data_origin: string;
}

interface FdcAlert {
  alert_id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  equipment_id: string;
  chamber_id: string;
  run_id: string;
  rule_code: string;
  message: string;
  status: string;
  event_time_utc: string;
  candidate_lot?: string;
  candidate_wafers?: string[];
}

interface WaferItem {
  wafer_id: string;
  lot_id: string;
  slot_number: number;
  sequence: number;
  exposure_status: 'CONFIRMED_EXPOSED' | 'CANDIDATE_EXPOSED' | 'NOT_EXPOSED' | 'BYPASSED' | 'UNKNOWN';
}

interface DemoSummary {
  equipment_id: string;
  chamber_id: string;
  active_session_id: string;
  active_run_id: string;
  lot_id: string;
  recipe_id: string;
  total_wafers: number;
  exposed_wafers: number;
  active_alerts_count: number;
  latest_pressure_mtorr?: number;
  latest_rf_power_w?: number;
  latest_relative_signal?: number;
  mode: 'A' | 'B';
  data_origin: string;
}

interface SensorEvidence {
  sensor_id: string;
  sensor_name: string;
  measured_value: number;
  unit: string;
  quality_flag: string;
  ucl_threshold: number;
  target_value: number;
  deviation_percent: number;
}

interface InvestigationDetail {
  investigation_id: string;
  alert_id: string;
  equipment_id: string;
  chamber_id: string;
  run_id: string;
  lot_id: string;
  recipe_id: string;
  event_time_utc: string;
  anomaly_step: number;
  severity: string;
  rule_code: string;
  status: string;
  evidence_sensors: SensorEvidence[];
  total_wafers: number;
  confirmed_exposed_wafers: string[];
  candidate_exposed_wafers: string[];
  unexposed_wafers_count: number;
  disclaimer: string;
  recommended_dispositions: string[];
}

// Built-in Mode A Synthetic Fixture Generator (Deterministic pseudo-random synthesis by seed)
function generateModeAFixture(seed: number) {
  let s = Math.abs(seed);
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const relNoise = (nextRand() - 0.5) * 2.0;
  const prsNoise = (nextRand() - 0.5) * 1.5;
  const rfNoise = (nextRand() - 0.5) * 20.0;

  const t7Rel = +(80.0 + (nextRand() - 0.5) * 4.0).toFixed(1);
  const t7Prs = +(168.5 + (nextRand() - 0.5) * 5.0).toFixed(2);
  const t7Rf = +(1820.0 + rfNoise).toFixed(1);

  const samples: SensorSample[] = [
    // RELATIVE_SIGNAL (Optical sensor: T4 and T5 missing due to optical shutter)
    { step_index: 0, time_label: "T0", sim_time_utc: "2026-10-15T00:00:00.000Z", sensor_id: "RELATIVE_SIGNAL", measured_value: +(48.2 + relNoise).toFixed(1), unit: "a.u.", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 1, time_label: "T1", sim_time_utc: "2026-10-15T00:00:05.000Z", sensor_id: "RELATIVE_SIGNAL", measured_value: +(50.1 + relNoise * 0.8).toFixed(1), unit: "a.u.", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 2, time_label: "T2", sim_time_utc: "2026-10-15T00:00:10.000Z", sensor_id: "RELATIVE_SIGNAL", measured_value: +(51.4 + relNoise * 0.5).toFixed(1), unit: "a.u.", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 3, time_label: "T3", sim_time_utc: "2026-10-15T00:00:15.000Z", sensor_id: "RELATIVE_SIGNAL", measured_value: +(49.8 + relNoise * 0.7).toFixed(1), unit: "a.u.", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 4, time_label: "T4", sim_time_utc: "2026-10-15T00:00:20.000Z", sensor_id: "RELATIVE_SIGNAL", measured_value: null, unit: "a.u.", quality_flag: "MISSING", data_origin: "synthetic" },
    { step_index: 5, time_label: "T5", sim_time_utc: "2026-10-15T00:00:25.000Z", sensor_id: "RELATIVE_SIGNAL", measured_value: null, unit: "a.u.", quality_flag: "MISSING", data_origin: "synthetic" },
    { step_index: 6, time_label: "T6", sim_time_utc: "2026-10-15T00:00:30.000Z", sensor_id: "RELATIVE_SIGNAL", measured_value: +(52.0 + relNoise * 0.9).toFixed(1), unit: "a.u.", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 7, time_label: "T7", sim_time_utc: "2026-10-15T00:00:35.000Z", sensor_id: "RELATIVE_SIGNAL", measured_value: t7Rel, unit: "a.u.", quality_flag: "SUSPECT", data_origin: "synthetic" },

    // CHAMBER_PRESSURE (Continuous measurement, strictly valid & GOOD at T4/T5)
    { step_index: 0, time_label: "T0", sim_time_utc: "2026-10-15T00:00:00.000Z", sensor_id: "CHAMBER_PRESSURE", measured_value: +(120.1 + prsNoise).toFixed(2), unit: "mTorr", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 1, time_label: "T1", sim_time_utc: "2026-10-15T00:00:05.000Z", sensor_id: "CHAMBER_PRESSURE", measured_value: +(120.4 + prsNoise * 0.7).toFixed(2), unit: "mTorr", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 2, time_label: "T2", sim_time_utc: "2026-10-15T00:00:10.000Z", sensor_id: "CHAMBER_PRESSURE", measured_value: +(119.8 + prsNoise * 0.6).toFixed(2), unit: "mTorr", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 3, time_label: "T3", sim_time_utc: "2026-10-15T00:00:15.000Z", sensor_id: "CHAMBER_PRESSURE", measured_value: +(120.5 + prsNoise * 0.8).toFixed(2), unit: "mTorr", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 4, time_label: "T4", sim_time_utc: "2026-10-15T00:00:20.000Z", sensor_id: "CHAMBER_PRESSURE", measured_value: +(120.2 + (nextRand() - 0.5) * 0.4).toFixed(2), unit: "mTorr", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 5, time_label: "T5", sim_time_utc: "2026-10-15T00:00:25.000Z", sensor_id: "CHAMBER_PRESSURE", measured_value: +(120.0 + (nextRand() - 0.5) * 0.4).toFixed(2), unit: "mTorr", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 6, time_label: "T6", sim_time_utc: "2026-10-15T00:00:30.000Z", sensor_id: "CHAMBER_PRESSURE", measured_value: +(121.3 + prsNoise * 0.5).toFixed(2), unit: "mTorr", quality_flag: "GOOD", data_origin: "synthetic" },
    { step_index: 7, time_label: "T7", sim_time_utc: "2026-10-15T00:00:35.000Z", sensor_id: "CHAMBER_PRESSURE", measured_value: t7Prs, unit: "mTorr", quality_flag: "SUSPECT", data_origin: "synthetic" },
  ];

  const lotNum = 800 + (seed % 50);
  const lotId = `LOT-DEMO-${lotNum}`;
  const runId = `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`;
  const alertId = `AL-DEMO-${String(seed % 1000).padStart(3, '0')}`;

  const alerts: FdcAlert[] = [
    {
      alert_id: alertId,
      severity: "CRITICAL",
      equipment_id: "ETCH-02",
      chamber_id: "CH-B",
      run_id: runId,
      rule_code: "FDC-RULE-SPC-UCL-01",
      message: `Chamber Pressure and Signal Spike Detected at step T7 (> UCL 65.0 a.u., measured ${t7Rel} a.u., ${t7Prs} mTorr)`,
      status: "ACTIVE",
      event_time_utc: "2026-10-15T00:00:35.000Z",
      candidate_lot: lotId,
      candidate_wafers: ["W-08", "W-09", "W-10", "W-11", "W-12"]
    }
  ];

  const wafers: WaferItem[] = Array.from({ length: 25 }, (_, i) => {
    const slot = i + 1;
    const wafer_id = `W-${slot < 10 ? '0' + slot : slot}`;
    let status: WaferItem['exposure_status'] = 'NOT_EXPOSED';
    if (slot <= 7) status = 'CONFIRMED_EXPOSED';
    else if (slot >= 8 && slot <= 12) status = 'CANDIDATE_EXPOSED';
    return {
      wafer_id,
      lot_id: lotId,
      slot_number: slot,
      sequence: slot,
      exposure_status: status
    };
  });

  const summary: DemoSummary = {
    equipment_id: "ETCH-02",
    chamber_id: "CH-B",
    active_session_id: `SES-DEMO-${seed}`,
    active_run_id: runId,
    lot_id: lotId,
    recipe_id: "RCP-ETCH-POLY-04",
    total_wafers: 25,
    exposed_wafers: 7,
    active_alerts_count: 1,
    latest_pressure_mtorr: t7Prs,
    latest_rf_power_w: t7Rf,
    latest_relative_signal: t7Rel,
    mode: "A",
    data_origin: "synthetic"
  };

  const investigation: InvestigationDetail = {
    investigation_id: `INV-${alertId}`,
    alert_id: alertId,
    equipment_id: "ETCH-02",
    chamber_id: "CH-B",
    run_id: runId,
    lot_id: lotId,
    recipe_id: "RCP-ETCH-POLY-04",
    event_time_utc: "2026-10-15T00:00:35.000Z",
    anomaly_step: 7,
    severity: "CRITICAL",
    rule_code: "FDC-RULE-SPC-UCL-01",
    status: "UNDER_INVESTIGATION",
    evidence_sensors: [
      {
        sensor_id: "RELATIVE_SIGNAL",
        sensor_name: "광학 발광 상대 신호 (OES Relative Signal)",
        measured_value: t7Rel,
        unit: "a.u.",
        quality_flag: "SUSPECT",
        ucl_threshold: 65.0,
        target_value: 50.0,
        deviation_percent: +(((t7Rel - 65.0) / 65.0) * 100.0).toFixed(1)
      },
      {
        sensor_id: "CHAMBER_PRESSURE",
        sensor_name: "챔버 공정 진공 압력 (Capacitance Manometer)",
        measured_value: t7Prs,
        unit: "mTorr",
        quality_flag: "SUSPECT",
        ucl_threshold: 140.0,
        target_value: 120.0,
        deviation_percent: +(((t7Prs - 140.0) / 140.0) * 100.0).toFixed(1)
      },
      {
        sensor_id: "RF_POWER",
        sensor_name: "RF 플라즈마 전원 출력 (RF Generator Forward Power)",
        measured_value: t7Rf,
        unit: "W",
        quality_flag: "SUSPECT",
        ucl_threshold: 1650.0,
        target_value: 1500.0,
        deviation_percent: +(((t7Rf - 1650.0) / 1650.0) * 100.0).toFixed(1)
      }
    ],
    total_wafers: 25,
    confirmed_exposed_wafers: ["W-01", "W-02", "W-03", "W-04", "W-05", "W-06", "W-07"],
    candidate_exposed_wafers: ["W-08", "W-09", "W-10", "W-11", "W-12"],
    unexposed_wafers_count: 13,
    disclaimer: "※ [품질 분석 가이드라인] 센서 이상 계측(FDC Spike)은 식각 챔버 내 공정 조건 일탈(Excursion) 감지이며, 웨이퍼의 물리적 결함(Defect) 확정 원인이 아닙니다. 결함 확정은 후속 계측(Defect Review / EDS)을 통한 교차 분석이 필수적입니다.",
    recommended_dispositions: [
      "[장비 조치] CH-B 챔버 일시 공정 인터록 및 쿼츠 링/RF 정합 회로 점검",
      "[품질 조치] 잠재 영향군(W-08~W-12) 결함 검측(Defect Inspection) 우선 배정",
      "[공정 승인] 로트 처리 보류(Hold) 등록 및 수석 엔지니어 검토 대기"
    ]
  };

  return { summary, samples, alerts, wafers, investigation };
}

const DEFAULT_FIXTURE = generateModeAFixture(20261015);

export default function FabOneDemoPage() {
  const [mode, setMode] = useState<'A' | 'B'>('A');
  const [backendAvailable, setBackendAvailable] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [summary, setSummary] = useState<DemoSummary>(DEFAULT_FIXTURE.summary);
  const [samples, setSamples] = useState<SensorSample[]>(DEFAULT_FIXTURE.samples);
  const [alerts, setAlerts] = useState<FdcAlert[]>(DEFAULT_FIXTURE.alerts);
  const [wafers, setWafers] = useState<WaferItem[]>(DEFAULT_FIXTURE.wafers);
  const [investigationData, setInvestigationData] = useState<InvestigationDetail | null>(DEFAULT_FIXTURE.investigation);
  const [selectedAlert, setSelectedAlert] = useState<FdcAlert | null>(DEFAULT_FIXTURE.alerts[0]);
  const [isInvestigationOpen, setIsInvestigationOpen] = useState<boolean>(true);

  // Playback timeline state
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedSensor, setSelectedSensor] = useState<'RELATIVE_SIGNAL' | 'CHAMBER_PRESSURE'>('RELATIVE_SIGNAL');
  const [selectedWafer, setSelectedWafer] = useState<WaferItem | null>(DEFAULT_FIXTURE.wafers[7]); // W-08 default candidate
  const [isAnomalyActive, setIsAnomalyActive] = useState<boolean>(false);
  const [seed, setSeed] = useState<number>(20261015);
  const [noticeMessage, setNoticeMessage] = useState<string>("FAB ONE 식각 공정 시뮬레이터 준비 완료");

  // Centralized fallback to Mode A
  const fallbackToModeA = useCallback((errorMsg: string) => {
    const fixture = generateModeAFixture(seed);
    setMode('A');
    setBackendAvailable(false);
    setConnectionError(errorMsg);
    setSummary(fixture.summary);
    setSamples(fixture.samples);
    setAlerts(fixture.alerts);
    setWafers(fixture.wafers);
    setInvestigationData(fixture.investigation);
    setNoticeMessage(`⚠️ ${errorMsg} - Mode A 로컬 합성 픽스처로 안전하게 전환되었습니다.`);
  }, [seed]);

  const loadBackendData = useCallback(async (): Promise<boolean> => {
    try {
      const [sumRes, alertRes, waferRes, invRes] = await Promise.all([
        fetch("http://localhost:8000/api/v1/demo/summary", { cache: "no-store" }),
        fetch("http://localhost:8000/api/v1/demo/alerts", { cache: "no-store" }),
        fetch("http://localhost:8000/api/v1/demo/wafers", { cache: "no-store" }),
        fetch("http://localhost:8000/api/v1/demo/investigation", { cache: "no-store" }),
      ]);

      if (!sumRes.ok || !alertRes.ok || !waferRes.ok) {
        fallbackToModeA(`서버 응답 오류 (HTTP summary:${sumRes.status}, alerts:${alertRes.status}, wafers:${waferRes.status})`);
        return false;
      }

      const sumData: DemoSummary = await sumRes.json();
      const alertData: FdcAlert[] = await alertRes.json();
      const waferData: WaferItem[] = await waferRes.json();
      let invData: InvestigationDetail | null = null;
      if (invRes.ok) {
        invData = await invRes.json();
      }

      const sampleRes = await fetch(`http://localhost:8000/api/v1/demo/runs/${sumData.active_run_id}/samples`, { cache: "no-store" });
      if (!sampleRes.ok) {
        fallbackToModeA(`시계열 센서 로드 실패 (HTTP ${sampleRes.status})`);
        return false;
      }
      const sampleData: SensorSample[] = await sampleRes.json();

      setSummary(sumData);
      setAlerts(alertData);
      setWafers(waferData);
      setSamples(sampleData);
      if (invData) setInvestigationData(invData);
      setMode('B');
      setBackendAvailable(true);
      setConnectionError(null);
      return true;
    } catch {
      fallbackToModeA("백엔드 통신 실패 (네트워크 단절)");
      return false;
    }
  }, [fallbackToModeA]);

  const checkBackend = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const res = await fetch("http://localhost:8000/api/v1/health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ok") {
          await loadBackendData();
          setIsConnecting(false);
          return;
        }
      }
      fallbackToModeA(`헬스체크 실패 (HTTP ${res.status})`);
    } catch {
      fallbackToModeA("백엔드 서버(포트 8000) 미실행");
    } finally {
      setIsConnecting(false);
    }
  }, [fallbackToModeA, loadBackendData]);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  // Playback timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= 7) {
            setIsPlaying(false);
            setIsAnomalyActive(true);
            setIsInvestigationOpen(true);
            if (alerts.length > 0) setSelectedAlert(alerts[0]);
            return 7;
          }
          return prev + 1;
        });
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, alerts]);

  // Filter current series
  const filteredSamples = useMemo(() => {
    return samples.filter(s => s.sensor_id === selectedSensor);
  }, [samples, selectedSensor]);

  // Current value at currentStep
  const currentSample = useMemo(() => {
    return filteredSamples.find(s => s.step_index === currentStep);
  }, [filteredSamples, currentStep]);

  // Update anomaly active status based on currentStep and selectedSensor
  useEffect(() => {
    const currentSampleForSelected = filteredSamples.find(s => s.step_index === currentStep);
    if (currentStep === 7) {
      setIsAnomalyActive(true);
      setNoticeMessage(`경고: T7 시점 센서 급증 이상 발생! FDC-RULE-SPC-UCL-01 알람 트리거됨 (${selectedSensor}: ${currentSampleForSelected?.measured_value ?? '-'} ${currentSampleForSelected?.unit || ''}).`);
    } else if (currentSampleForSelected?.quality_flag === 'MISSING' || currentSampleForSelected?.measured_value === null) {
      setIsAnomalyActive(false);
      setNoticeMessage(`시점 T${currentStep}: ${selectedSensor} 데이터 결측(MISSING). 0으로 보간하지 않고 단절 처리.`);
    } else {
      setIsAnomalyActive(false);
      setNoticeMessage(`시점 T${currentStep}: ${selectedSensor} 정상 계측 (${currentSampleForSelected?.measured_value ?? '-'} ${currentSampleForSelected?.unit || ''}).`);
    }
  }, [currentStep, selectedSensor, filteredSamples]);

  // Action handlers
  const handleStartDemo = async () => {
    setCurrentStep(0);
    setIsPlaying(true);

    if (mode === 'B') {
      try {
        const res = await fetch("http://localhost:8000/api/v1/demo/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed: seed,
            scenario_id: "ETH-SYN-01",
            equipment_id: "ETCH-02",
            chamber_id: "CH-B"
          })
        });
        if (res.ok) {
          const loaded = await loadBackendData();
          if (loaded) {
            setNoticeMessage(`Mode B: 실시간 시뮬레이션 시작 (Seed: ${seed}, T0 ~ T7 재생)`);
          }
        } else {
          fallbackToModeA(`새 데모 Run 생성 실패 (HTTP ${res.status})`);
        }
      } catch {
        fallbackToModeA("새 데모 Run 요청 중 서버 응답 없음");
      }
    } else {
      setNoticeMessage("Mode A: 합성 픽스처 데모 시작 (T0 ~ T7 순차 재생)");
    }
  };

  const handleTogglePlay = () => {
    if (currentStep >= 7 && !isPlaying) {
      setCurrentStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentStep(prev => (prev >= 7 ? 0 : prev + 1));
  };

  const handleSeekAnomaly = async () => {
    setIsPlaying(false);
    setCurrentStep(7);
    setIsAnomalyActive(true);
    setIsInvestigationOpen(true);
    if (alerts.length > 0) setSelectedAlert(alerts[0]);
    setNoticeMessage("이상 구간 탐색: T7 스파이크 시점으로 즉시 이동. 영향 가능 Lot/Wafer 후보군(W-08~W-12) 및 엔지니어링 조사 패널 활성화.");

    if (mode === 'B') {
      try {
        const res = await fetch("http://localhost:8000/api/v1/demo/seek-anomaly", { method: "POST" });
        if (!res.ok) {
          fallbackToModeA(`이상 구간 탐색 API 실패 (HTTP ${res.status})`);
        }
      } catch {
        fallbackToModeA("이상 탐색 API 요청 중 서버 응답 없음");
      }
    }
  };

  const handleSelectAlert = (alert: FdcAlert) => {
    setSelectedAlert(alert);
    setIsInvestigationOpen(true);
    setCurrentStep(7);
    setIsAnomalyActive(true);
    setNoticeMessage(`엔지니어링 조사: [${alert.severity}] ${alert.alert_id} (${alert.rule_code}) 세부 근거 및 영향 웨이퍼 분석 열림`);
  };

  const handleChangeSeed = async () => {
    const seeds = [20261015, 9999, 42, 12345];
    const nextSeed = seeds[(seeds.indexOf(seed) + 1) % seeds.length];
    setSeed(nextSeed);
    setCurrentStep(0);
    setIsPlaying(false);

    if (mode === 'B') {
      try {
        const res = await fetch("http://localhost:8000/api/v1/demo/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed: nextSeed,
            scenario_id: "ETH-SYN-01",
            equipment_id: "ETCH-02",
            chamber_id: "CH-B"
          })
        });
        if (res.ok) {
          const loaded = await loadBackendData();
          if (loaded) {
            setNoticeMessage(`Mode B: 새 난수 시드(Seed: ${nextSeed}) 적용 및 백엔드 재합성 완료.`);
          }
        } else {
          fallbackToModeA(`시드 변경 실패 (HTTP ${res.status})`);
        }
      } catch {
        fallbackToModeA("시드 변경 중 서버 응답 없음");
      }
    } else {
      const fixture = generateModeAFixture(nextSeed);
      setSummary(fixture.summary);
      setSamples(fixture.samples);
      setAlerts(fixture.alerts);
      setWafers(fixture.wafers);
      setInvestigationData(fixture.investigation);
      setSelectedAlert(fixture.alerts[0] || null);
      setSelectedWafer(fixture.wafers[7]);
      setNoticeMessage(`Mode A: 난수 시드(Seed: ${nextSeed}) 기반 로컬 합성 데이터 동적 재합성 완료 (계측값·Lot ${fixture.summary.lot_id} 갱신).`);
    }
  };

  // SVG Chart rendering calculation
  // ViewBox: 0 0 600 240
  // X: 60 + (step * 70) => T0:60, T1:130, T2:200, T3:270, T4:340, T5:410, T6:480, T7:550
  // Y range: 0 to 100 a.u. (for RELATIVE_SIGNAL) or 100 to 200 mTorr (for CHAMBER_PRESSURE)
  const chartCoordinates = useMemo(() => {
    return filteredSamples.map(sample => {
      const x = 60 + sample.step_index * 70;
      let y: number | null = null;
      if (sample.measured_value !== null) {
        if (selectedSensor === 'RELATIVE_SIGNAL') {
          // 0 to 100 a.u. => Y from 210 to 30
          y = 210 - (sample.measured_value / 100) * 180;
        } else {
          // 100 to 200 mTorr => Y from 210 to 30
          const clamped = Math.max(100, Math.min(200, sample.measured_value));
          y = 210 - ((clamped - 100) / 100) * 180;
        }
      }
      return { ...sample, x, y };
    });
  }, [filteredSamples, selectedSensor]);

  // Dynamic path segmentation based on actual valid points (P1-01 fix: Never connects across missing points, but keeps continuous points intact)
  const dynamicSegments = useMemo(() => {
    const segments: string[] = [];
    let currentPts: { x: number; y: number }[] = [];

    chartCoordinates.forEach(pt => {
      if (pt.y !== null && pt.quality_flag !== 'MISSING') {
        currentPts.push({ x: pt.x, y: pt.y });
      } else {
        if (currentPts.length > 0) {
          segments.push(currentPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '));
          currentPts = [];
        }
      }
    });
    if (currentPts.length > 0) {
      segments.push(currentPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '));
    }
    return segments;
  }, [chartCoordinates]);

  // Dynamic missing range detection for currently selected sensor (P1-01 fix)
  const missingPoints = useMemo(() => {
    return chartCoordinates.filter(c => c.quality_flag === 'MISSING' || c.measured_value === null);
  }, [chartCoordinates]);

  const missingRange = useMemo(() => {
    if (missingPoints.length === 0) return null;
    const minX = Math.min(...missingPoints.map(p => p.x)) - 35;
    const maxX = Math.max(...missingPoints.map(p => p.x)) + 35;
    const labels = missingPoints.map(p => p.time_label).join(', ');
    return { minX, width: maxX - minX, labels };
  }, [missingPoints]);

  // UCL & Target threshold Y positions
  const uclY = selectedSensor === 'RELATIVE_SIGNAL' ? (210 - (65 / 100) * 180) : (210 - ((140 - 100) / 100) * 180);
  const targetY = selectedSensor === 'RELATIVE_SIGNAL' ? (210 - (50 / 100) * 180) : (210 - ((120 - 100) / 100) * 180);

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="logo-badge" aria-hidden="true">F1</div>
          <div>
            <span className="brand-title">FAB ONE</span>
            <span className="brand-subtitle">· Semiconductor Etch Intelligence Demo</span>
          </div>
        </div>

        <div className="top-status-pills">
          {mode === 'B' ? (
            <span className="pill pill-mode-b" title="FastAPI + SQLite 백엔드 API와 실시간 동기화 상태">
              <span className="pulse-dot"></span>
              Mode B · Live API Connected (Port 8000)
            </span>
          ) : (
            <span
              className="pill pill-mode-a"
              style={{ borderColor: connectionError ? '#FCD34D' : '#BAE6FD' }}
              title={connectionError ? `API 오류 (${connectionError}): Mode A 로컬 픽스처로 동작 중` : "백엔드 미실행 시에도 브라우저에서 독립 동작하는 합성 픽스처 모드"}
            >
              <span className="pulse-dot" style={{ background: connectionError ? '#D97706' : '#0369A1' }}></span>
              Mode A · Standalone Synthetic Fixture {connectionError ? '(API 미연결 / 폴백)' : ''}
            </span>
          )}

          {isAnomalyActive ? (
            <span className="pill pill-danger">
              <span className="pulse-dot"></span>
              이상 감지 (AL-DEMO-001)
            </span>
          ) : (
            <span className="pill" style={{ color: '#047857', borderColor: '#A7F3D0', background: '#ECFDF5' }}>
              Chamber Normal
            </span>
          )}

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={checkBackend}
            disabled={isConnecting}
            title="백엔드 연결 상태를 다시 확인합니다"
          >
            {isConnecting ? "연결 확인 중..." : (backendAvailable ? "API 연결됨 (재확인)" : "API 재연결 시도")}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-wrapper">
        {/* Interactive Playback Control Bar */}
        <section className="control-bar-card" aria-label="데모 조작 제어판">
          <div className="playback-controls">
            <button
              type="button"
              id="btn-start-demo"
              className="btn-primary"
              onClick={handleStartDemo}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              데모 시작 (Start)
            </button>

            <button
              type="button"
              id="btn-toggle-play"
              className="btn-secondary"
              onClick={handleTogglePlay}
            >
              {isPlaying ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  일시정지 (Pause)
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  재생 (Resume)
                </>
              )}
            </button>

            <button
              type="button"
              id="btn-step-forward"
              className="btn-secondary"
              onClick={handleStepForward}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
              다음 스텝 (+1)
            </button>

            <button
              type="button"
              id="btn-seek-anomaly"
              className="btn-danger-outline"
              onClick={handleSeekAnomaly}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              이상 구간 탐색 (Seek T7 Anomaly)
            </button>

            <button
              type="button"
              id="btn-change-seed"
              className="btn-secondary"
              onClick={handleChangeSeed}
              title="동일 시나리오를 새로운 난수 시드로 다시 생성합니다"
            >
              시드 변경 (Seed: {seed})
            </button>
          </div>

          {/* Step Timeline Indicator */}
          <div className="timeline-tracker" aria-label="타임라인 단계">
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginRight: '4px' }}>
              스텝:
            </span>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(step => {
              const isCurrent = currentStep === step;
              const stepSample = filteredSamples.find(s => s.step_index === step);
              const isMissing = stepSample?.quality_flag === 'MISSING' || stepSample?.measured_value === null;
              const isAnomaly = step === 7;
              let classNames = "step-chip";
              if (isCurrent) classNames += " active";
              if (isMissing) classNames += " missing";
              if (isAnomaly) classNames += " anomaly";

              return (
                <button
                  key={step}
                  type="button"
                  id={`step-chip-t${step}`}
                  className={classNames}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep(step);
                  }}
                  title={`시점 T${step} (클릭 시 이동)`}
                >
                  T{step}
                </button>
              );
            })}
          </div>
        </section>

        {/* Notice Banner */}
        <div className="notice-box" role="status">
          <strong>시스템 상태 안내:</strong> {noticeMessage}
        </div>

        {/* Top Summary Stats */}
        <div className="stats-summary-grid" style={{ marginTop: '16px' }}>
          <div className="stat-box">
            <div className="stat-box-label">장비 / 챔버</div>
            <div className="stat-box-value">{summary.equipment_id} · {summary.chamber_id}</div>
            <div className="stat-box-hint">Recipe: {summary.recipe_id}</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-label">진행 Run / Lot</div>
            <div className="stat-box-value">{summary.lot_id}</div>
            <div className="stat-box-hint">Run ID: {summary.active_run_id}</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-label">현재 스텝 계측값 ({currentSample?.sensor_id || 'SENSOR'})</div>
            <div className="stat-box-value" style={{ color: currentSample?.quality_flag === 'MISSING' ? '#94A3B8' : (currentStep === 7 ? '#DC2626' : '#0F172A') }}>
              {currentSample?.quality_flag === 'MISSING' ? 'MISSING (결측)' : `${currentSample?.measured_value ?? '-'} ${currentSample?.unit || ''}`}
            </div>
            <div className="stat-box-hint">품질 플래그: {currentSample?.quality_flag || 'NORMAL'}</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-label">웨이퍼 처리 현황</div>
            <div className="stat-box-value">{summary.exposed_wafers} / {summary.total_wafers} EA</div>
            <div className="stat-box-hint">노출 확정 7매 · 잠재 영향 5매</div>
          </div>
        </div>

        {/* Main 2-Column Dashboard Grid */}
        <div className="dashboard-grid" style={{ marginTop: '20px' }}>
          {/* Left Column: Chart, Table, and Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Sensor Trend Chart Card */}
            <section className="dash-card" aria-label="센서 시계열 트렌드">
              <div className="card-header-row">
                <div>
                  <h2 className="card-title">Chamber Sensor Trend (합성 시계열)</h2>
                  <p className="card-subtitle">
                    T0~T7 시점 계측값 · {selectedSensor === 'RELATIVE_SIGNAL' ? '광학 센서 결측 구간(T4, T5) 분절 시각화' : '격막 게이지 전구간 연속 계측'} 및 UCL 스파이크 탐지
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn-secondary ${selectedSensor === 'RELATIVE_SIGNAL' ? 'active' : ''}`}
                    style={{
                      background: selectedSensor === 'RELATIVE_SIGNAL' ? '#EFF6FF' : '#FFFFFF',
                      borderColor: selectedSensor === 'RELATIVE_SIGNAL' ? '#93C5FD' : '#E2E8F0',
                      color: selectedSensor === 'RELATIVE_SIGNAL' ? '#1D4ED8' : '#475569',
                      fontSize: '11px',
                      padding: '4px 10px'
                    }}
                    onClick={() => setSelectedSensor('RELATIVE_SIGNAL')}
                  >
                    상대 신호 [a.u.]
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary ${selectedSensor === 'CHAMBER_PRESSURE' ? 'active' : ''}`}
                    style={{
                      background: selectedSensor === 'CHAMBER_PRESSURE' ? '#EFF6FF' : '#FFFFFF',
                      borderColor: selectedSensor === 'CHAMBER_PRESSURE' ? '#93C5FD' : '#E2E8F0',
                      color: selectedSensor === 'CHAMBER_PRESSURE' ? '#1D4ED8' : '#475569',
                      fontSize: '11px',
                      padding: '4px 10px'
                    }}
                    onClick={() => setSelectedSensor('CHAMBER_PRESSURE')}
                  >
                    챔버 압력 [mTorr]
                  </button>
                </div>
              </div>

              {/* SVG Trend Chart */}
              <div className="chart-container">
                <svg
                  viewBox="0 0 600 240"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  role="img"
                  aria-label="식각 챔버 센서 트렌드 차트"
                >
                  {/* Grid Lines */}
                  <g stroke="#F1F5F9" strokeWidth="1">
                    <line x1="50" y1="30" x2="580" y2="30" />
                    <line x1="50" y1="75" x2="580" y2="75" />
                    <line x1="50" y1="120" x2="580" y2="120" />
                    <line x1="50" y1="165" x2="580" y2="165" />
                    <line x1="50" y1="210" x2="580" y2="210" />
                  </g>

                  {/* Y Axis Labels */}
                  <g fontSize="10" fill="#64748B" textAnchor="end">
                    {selectedSensor === 'RELATIVE_SIGNAL' ? (
                      <>
                        <text x="42" y="34">100</text>
                        <text x="42" y="79">75</text>
                        <text x="42" y="124">50</text>
                        <text x="42" y="169">25</text>
                        <text x="42" y="214">0</text>
                      </>
                    ) : (
                      <>
                        <text x="42" y="34">200</text>
                        <text x="42" y="79">175</text>
                        <text x="42" y="124">150</text>
                        <text x="42" y="169">125</text>
                        <text x="42" y="214">100</text>
                      </>
                    )}
                  </g>

                  {/* Target & UCL lines */}
                  <line
                    x1="50"
                    y1={uclY}
                    x2="580"
                    y2={uclY}
                    stroke="#D97706"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text x="575" y={uclY - 4} fontSize="9" fill="#D97706" textAnchor="end" fontWeight="700">
                    UCL 관리한계 기준 ({selectedSensor === 'RELATIVE_SIGNAL' ? '65.0 a.u.' : '140 mTorr'})
                  </text>

                  <line
                    x1="50"
                    y1={targetY}
                    x2="580"
                    y2={targetY}
                    stroke="#94A3B8"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                  <text x="575" y={targetY - 4} fontSize="9" fill="#64748B" textAnchor="end">
                    Target 공정 목표 ({selectedSensor === 'RELATIVE_SIGNAL' ? '50.0 a.u.' : '120 mTorr'})
                  </text>

                  {/* Missing Gap Shading (Dynamic per sensor: only if missing points exist) */}
                  {missingRange && (
                    <g>
                      <rect
                        x={missingRange.minX}
                        y="30"
                        width={missingRange.width}
                        height="180"
                        fill="#F8FAFC"
                        stroke="#CBD5E1"
                        strokeDasharray="3 3"
                        opacity="0.9"
                      />
                      <text
                        x={missingRange.minX + missingRange.width / 2}
                        y="125"
                        fontSize="10"
                        fill="#94A3B8"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        데이터 결측 구간 ({missingRange.labels})
                      </text>
                    </g>
                  )}

                  {/* Sensor Curves (Dynamic segments: Never connects across missing points, but keeps continuous points intact) */}
                  {dynamicSegments.map((dStr, idx) => (
                    <path
                      key={idx}
                      d={dStr}
                      fill="none"
                      stroke="#0B9F78"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  ))}

                  {/* Points */}
                  {chartCoordinates.map(pt => {
                    const isSelected = pt.step_index === currentStep;
                    const isMissing = pt.quality_flag === 'MISSING';
                    const isAnomaly = pt.step_index === 7;

                    if (isMissing) {
                      return (
                        <g key={pt.step_index}>
                          {/* Cross icon for missing */}
                          <line x1={pt.x - 4} y1="120" x2={pt.x + 4} y2="128" stroke="#94A3B8" strokeWidth="2" />
                          <line x1={pt.x + 4} y1="120" x2={pt.x - 4} y2="128" stroke="#94A3B8" strokeWidth="2" />
                          <text x={pt.x} y="228" fontSize="10" fill="#94A3B8" textAnchor="middle">
                            {pt.time_label}
                          </text>
                        </g>
                      );
                    }

                    return (
                      <g key={pt.step_index} style={{ cursor: 'pointer' }} onClick={() => setCurrentStep(pt.step_index)}>
                        {/* Point circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y!}
                          r={isSelected ? 6 : 4}
                          fill={isAnomaly ? '#DC2626' : '#0B9F78'}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        {/* Current playback highlight ring */}
                        {isSelected && (
                          <circle
                            cx={pt.x}
                            cy={pt.y!}
                            r="11"
                            fill="none"
                            stroke={isAnomaly ? '#DC2626' : '#10B981'}
                            strokeWidth="1.5"
                            opacity="0.6"
                          />
                        )}
                        {/* Value label */}
                        <text
                          x={pt.x}
                          y={pt.y! - 9}
                          fontSize="10"
                          fontWeight={isSelected || isAnomaly ? "800" : "500"}
                          fill={isAnomaly ? '#DC2626' : '#1E293B'}
                          textAnchor="middle"
                        >
                          {pt.measured_value}
                        </text>
                        {/* X-axis tick */}
                        <text
                          x={pt.x}
                          y="228"
                          fontSize="10"
                          fontWeight={isSelected ? "800" : "500"}
                          fill={isSelected ? '#155BC1' : '#64748B'}
                          textAnchor="middle"
                        >
                          {pt.time_label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="chart-legend">
                  <span className="legend-item">
                    <span className="legend-swatch-solid"></span> 합성 계측선 (연속 구간)
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch-missing"></span> {selectedSensor === 'RELATIVE_SIGNAL' ? '광학 결측 분절 (T4, T5는 0이 아님)' : '센서 연속 측정 (결측 없음)'}
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch-ucl"></span> 가상 관리한계 UCL ({selectedSensor === 'RELATIVE_SIGNAL' ? '65.0 a.u.' : '140 mTorr'})
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch-target"></span> 기준 목표치 Target ({selectedSensor === 'RELATIVE_SIGNAL' ? '50.0 a.u.' : '120 mTorr'})
                  </span>
                </div>
              </div>

              {/* Data Table View */}
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>시점</th>
                      <th>상대 신호 [a.u.]</th>
                      <th>챔버 압력 [mTorr]</th>
                      <th>선택 센서 품질 ({selectedSensor === 'RELATIVE_SIGNAL' ? '상대 신호' : '챔버 압력'})</th>
                      <th>출처</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(step => {
                      const sig = samples.find(s => s.sensor_id === 'RELATIVE_SIGNAL' && s.step_index === step);
                      const prs = samples.find(s => s.sensor_id === 'CHAMBER_PRESSURE' && s.step_index === step);
                      const activeSample = selectedSensor === 'RELATIVE_SIGNAL' ? sig : prs;
                      const isCurrent = currentStep === step;
                      const isAnomaly = step === 7;

                      return (
                        <tr
                          key={step}
                          className={`${isCurrent ? 'active-row' : ''} ${isAnomaly ? 'anomaly-row' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setCurrentStep(step)}
                        >
                          <td style={{ fontWeight: 700 }}>T{step}</td>
                          <td>
                            {sig?.measured_value !== null ? (
                              <span style={{ fontWeight: isAnomaly ? 800 : 500, color: isAnomaly ? '#DC2626' : 'inherit' }}>
                                {sig?.measured_value} a.u.
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>NULL (결측)</span>
                            )}
                          </td>
                          <td>
                            {prs?.measured_value !== null ? (
                              <span style={{ fontWeight: isAnomaly ? 800 : 500, color: isAnomaly ? '#DC2626' : 'inherit' }}>
                                {prs?.measured_value} mTorr
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>NULL (결측)</span>
                            )}
                          </td>
                          <td>
                            <span
                              className="pill"
                              style={{
                                padding: '2px 8px',
                                fontSize: '10px',
                                background: activeSample?.quality_flag === 'MISSING' ? '#F1F5F9' : (isAnomaly ? '#FEE2E2' : '#ECFDF5'),
                                color: activeSample?.quality_flag === 'MISSING' ? '#64748B' : (isAnomaly ? '#B91C1C' : '#047857'),
                                borderColor: activeSample?.quality_flag === 'MISSING' ? '#CBD5E1' : (isAnomaly ? '#FECACA' : '#A7F3D0')
                              }}
                            >
                              {activeSample?.quality_flag || 'GOOD'}
                            </span>
                          </td>
                          <td style={{ color: '#64748B', fontSize: '11px' }}>{activeSample?.data_origin || 'synthetic'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Active Anomaly Alert Section */}
            <section className="dash-card" aria-label="이상 감지 알람">
              <div className="card-header-row">
                <div>
                  <h2 className="card-title">FDC 이상 감지 알람 (Alerts)</h2>
                  <p className="card-subtitle">발생한 이상 징후 및 잠재 영향 웨이퍼 추적 목록 (클릭하여 엔지니어링 조사 연동)</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="pill pill-danger">
                    활성 알람 {alerts.length}건
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => setIsInvestigationOpen(!isInvestigationOpen)}
                  >
                    {isInvestigationOpen ? "조사 패널 접기 ▲" : "조사 패널 열기 ▼"}
                  </button>
                </div>
              </div>

              {alerts.map(alert => {
                const isSelected = selectedAlert?.alert_id === alert.alert_id;
                return (
                  <div
                    key={alert.alert_id}
                    id={`alert-card-${alert.alert_id}`}
                    className={`alert-card-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectAlert(alert)}
                    style={{ cursor: 'pointer' }}
                    title="클릭 시 해당 알람을 기반으로 엔지니어링 조사를 시작하고 T7 이상 시점으로 이동합니다"
                  >
                    <div className="alert-header">
                      <span className="alert-title">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        [{alert.severity}] {alert.alert_id} · {alert.rule_code}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-danger-outline"
                          style={{ padding: '3px 10px', fontSize: '11px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSeekAnomaly();
                          }}
                        >
                          T7 시점으로 이동 →
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '3px 10px', fontSize: '11px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAlert(alert);
                          }}
                        >
                          조사 상세 {isSelected && isInvestigationOpen ? "닫기" : "보기"} ↓
                        </button>
                      </div>
                    </div>
                    <div className="alert-desc">{alert.message}</div>
                    <div className="alert-meta">
                      <span>장비: <strong>{alert.equipment_id} / {alert.chamber_id}</strong></span>
                      <span>시각: {alert.event_time_utc}</span>
                      <span>영향 Lot: <strong>{alert.candidate_lot || 'N/A'}</strong></span>
                    </div>
                    {alert.candidate_wafers && alert.candidate_wafers.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#6B7280', marginRight: '6px' }}>
                          잠재 노출 후보 웨이퍼 ({alert.candidate_wafers.length}매):
                        </span>
                        <div className="affected-tag-list">
                          {alert.candidate_wafers.map(wId => (
                            <span
                              key={wId}
                              className="affected-tag"
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const found = wafers.find(w => w.wafer_id === wId);
                                if (found) setSelectedWafer(found);
                              }}
                            >
                              {wId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Engineering Investigation Panel (BUILD-02) */}
              {isInvestigationOpen && investigationData && (
                <div id="engineering-investigation-panel" className="investigation-panel">
                  <div className="investigation-header-row">
                    <div className="investigation-title-wrap">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B9F78" strokeWidth="2.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      <div>
                        <h3 className="investigation-title">엔지니어링 공정 이상 조사 (Engineering Investigation)</h3>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          대상 알람: <strong>{investigationData.alert_id}</strong> ({investigationData.rule_code}) · 관리 시점 T{investigationData.anomaly_step}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="pill" style={{ background: '#FEF3C7', color: '#B45309', borderColor: '#FCD34D' }}>
                        {investigationData.status === 'UNDER_INVESTIGATION' ? '조사 진행 중 (Under Investigation)' : investigationData.status}
                      </span>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => setIsInvestigationOpen(false)}
                      >
                        닫기 ✕
                      </button>
                    </div>
                  </div>

                  {/* Domain Disclaimer Banner (Explicit requirement: Do not describe sensor anomaly as confirmed defect) */}
                  <div className="investigation-disclaimer">
                    <strong>품질 분석 가이드라인:</strong> {investigationData.disclaimer}
                  </div>

                  {/* Context Meta Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '8px', fontSize: '11px' }}>
                    <div>장비/챔버: <strong>{investigationData.equipment_id} / {investigationData.chamber_id}</strong></div>
                    <div>공정 Run: <strong>{investigationData.run_id}</strong></div>
                    <div>소속 Lot: <strong>{investigationData.lot_id}</strong></div>
                    <div>적용 Recipe: <strong>{investigationData.recipe_id}</strong></div>
                  </div>

                  {/* 3 Metric Evidence Cards */}
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      이상 시점(T{investigationData.anomaly_step}) 센서 계측 근거 (클릭 시 차트 연동 전환):
                    </div>
                    <div className="metric-evidence-grid">
                      {investigationData.evidence_sensors.map(ev => {
                        const isSensorSelected = selectedSensor === ev.sensor_id;
                        return (
                          <div
                            key={ev.sensor_id}
                            className="evidence-card"
                            style={{
                              borderColor: isSensorSelected ? '#0B9F78' : '#E2E8F0',
                              borderWidth: isSensorSelected ? '2px' : '1px',
                              cursor: (ev.sensor_id === 'RELATIVE_SIGNAL' || ev.sensor_id === 'CHAMBER_PRESSURE') ? 'pointer' : 'default',
                              background: isSensorSelected ? '#F0FDF4' : '#F8FAFC'
                            }}
                            onClick={() => {
                              if (ev.sensor_id === 'RELATIVE_SIGNAL' || ev.sensor_id === 'CHAMBER_PRESSURE') {
                                setSelectedSensor(ev.sensor_id);
                                setCurrentStep(7);
                              }
                            }}
                            title="클릭 시 좌측 시계열 트렌드 차트에 해당 센서를 표시합니다"
                          >
                            <div className="evidence-label">{ev.sensor_name}</div>
                            <div className="evidence-val-row">
                              <span className="evidence-val">{ev.measured_value} {ev.unit}</span>
                              <span className="evidence-delta-pill">+{ev.deviation_percent}%</span>
                            </div>
                            <div className="evidence-sub">
                              UCL 한계: {ev.ucl_threshold} {ev.unit} · Target: {ev.target_value} {ev.unit}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                              <span>품질 플래그: <strong>{ev.quality_flag}</strong></span>
                              {isSensorSelected && <span style={{ color: '#0B9F78', fontWeight: 700 }}>✓ 차트 표시 중</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Impact Wafer Breakdown */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                        카세트 웨이퍼 영향 구간 구분 (총 {investigationData.total_wafers}매):
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        노출 확정 {investigationData.confirmed_exposed_wafers.length}매 · 잠재 후보 {investigationData.candidate_exposed_wafers.length}매 · 미노출 {investigationData.unexposed_wafers_count}매
                      </span>
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                        잠재 영향 후보군 (Candidate Exposed - 클릭 시 우측 카세트 슬롯 상세 확인):
                      </div>
                      <div className="candidate-wafers-strip">
                        {investigationData.candidate_exposed_wafers.map(wId => {
                          const isWaferActive = selectedWafer?.wafer_id === wId;
                          return (
                            <button
                              key={wId}
                              type="button"
                              id={`investigation-wafer-btn-${wId}`}
                              className={`candidate-wafer-btn ${isWaferActive ? 'active' : ''}`}
                              onClick={() => {
                                const found = wafers.find(w => w.wafer_id === wId);
                                if (found) setSelectedWafer(found);
                              }}
                            >
                              <span>{wId}</span>
                              <span style={{ fontSize: '9px', opacity: 0.8 }}>
                                #{wafers.find(w => w.wafer_id === wId)?.slot_number}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Recommended Dispositions */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      엔지니어 권고 조치 (Recommended Engineering Dispositions):
                    </div>
                    <div className="disposition-list">
                      {investigationData.recommended_dispositions.map((disp, idx) => (
                        <div key={idx} className="disposition-item">
                          <span>{disp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Etch Chamber Graphic & Wafer Cassette */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Chamber Illustration & Telemetry Card */}
            <aside className="chamber-card" aria-label="챔버 현황 및 개념도">
              <div className="card-header-row" style={{ marginBottom: '8px' }}>
                <div>
                  <h3 className="card-title" style={{ fontSize: '15px' }}>식각 챔버 개념도 (Etch Chamber)</h3>
                  <p className="card-subtitle">ETCH-02 · CH-B (에메랄드 화이트 UI)</p>
                </div>
                <span className="pill" style={{ color: '#047857', background: '#ECFDF5', borderColor: '#A7F3D0' }}>
                  CH-B ACTIVE
                </span>
              </div>

              {/* Vector Artwork from A03 PR #11 */}
              <div className="chamber-art-wrap">
                <svg className="chamber-svg" viewBox="0 0 200 160" aria-label="식각 챔버 에메랄드 구조도">
                  <defs>
                    <linearGradient id="emeraldChamberGrad" x1="0" x2="1" y1="0" y2="1">
                      <stop stopColor="#DDF8EC" />
                      <stop offset="0.55" stopColor="#16B88A" />
                      <stop offset="1" stopColor="#076F5B" />
                    </linearGradient>
                  </defs>
                  {/* Shadow / Base */}
                  <ellipse cx="100" cy="147" rx="83" ry="9" fill="#DDF8EC" />
                  {/* Top Valve */}
                  <rect x="53" y="17" width="95" height="23" rx="10" fill="#076F5B" />
                  {/* Main Chamber Body */}
                  <path
                    d="M34 53 Q36 31 65 33 H137 Q164 31 166 53 L173 117 Q176 136 153 137 H47 Q24 137 27 117Z"
                    fill="url(#emeraldChamberGrad)"
                    stroke="#076F5B"
                    strokeWidth="3"
                  />
                  {/* Internal Glow / Plasma field */}
                  <path d="M46 70 Q97 94 153 70" stroke="#DDF8EC" fill="none" strokeWidth="4" opacity="0.75" />
                  {/* Wafer Chuck / Pedestal */}
                  <rect x="55" y="86" width="90" height="29" rx="14" fill="#0B9F78" stroke="#DDF8EC" strokeWidth="3" />
                  <ellipse cx="99" cy="100" rx="37" ry="8" fill={isAnomalyActive ? "#FECACA" : "#A4E9C8"} />
                  {/* Gas Inlet & Exhaust Ports */}
                  <path
                    d="M83 14 V4 H117 V14 M39 62 H12 V82 H27 M166 62 H187 V82 H172"
                    fill="none"
                    stroke="#076F5B"
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                  <path d="M57 46 H145" stroke="#EFFFF5" strokeWidth="4" opacity="0.65" />
                </svg>
              </div>

              {/* Real-time Telemetry KV */}
              <table className="kv-table">
                <tbody>
                  <tr>
                    <td>현재 시점 (Cursor)</td>
                    <td>T{currentStep} ({currentSample?.sim_time_utc?.split('T')[1]?.replace('Z', ' UTC') || 'T0'})</td>
                  </tr>
                  <tr>
                    <td>상대 센서 신호</td>
                    <td style={{ color: currentStep === 7 ? '#DC2626' : 'inherit' }}>
                      {samples.find(s => s.sensor_id === 'RELATIVE_SIGNAL' && s.step_index === currentStep)?.measured_value ?? 'NULL (결측)'} a.u.
                    </td>
                  </tr>
                  <tr>
                    <td>챔버 진공 압력</td>
                    <td style={{ color: currentStep === 7 ? '#DC2626' : 'inherit' }}>
                      {samples.find(s => s.sensor_id === 'CHAMBER_PRESSURE' && s.step_index === currentStep)?.measured_value ?? 'NULL'} mTorr
                    </td>
                  </tr>
                  <tr>
                    <td>RF Generator 출력</td>
                    <td style={{ color: currentStep === 7 ? '#DC2626' : 'inherit' }}>
                      {currentStep === 7 ? '895.0 W (과출력)' : '750.0 W (정상)'}
                    </td>
                  </tr>
                  <tr>
                    <td>공정 Recipe</td>
                    <td>{summary.recipe_id}</td>
                  </tr>
                </tbody>
              </table>
            </aside>

            {/* Wafer Lot Cassette Grid */}
            <section className="dash-card" aria-label="웨이퍼 카세트 현황">
              <div className="card-header-row" style={{ marginBottom: '8px' }}>
                <div>
                  <h3 className="card-title" style={{ fontSize: '15px' }}>FOUP 카세트 웨이퍼 (25매)</h3>
                  <p className="card-subtitle">Lot: {summary.lot_id} · 노출 상태별 구분</p>
                </div>
              </div>

              {/* 5x5 Grid */}
              <div className="wafer-matrix-grid">
                {wafers.map(w => {
                  let statusClass = "unexposed";
                  let statusLabel = "미노출";
                  if (w.exposure_status === 'CONFIRMED_EXPOSED') {
                    statusClass = "confirmed";
                    statusLabel = "노출";
                  } else if (w.exposure_status === 'CANDIDATE_EXPOSED') {
                    statusClass = "candidate";
                    statusLabel = "후보군";
                  }

                  const isSelected = selectedWafer?.wafer_id === w.wafer_id;

                  return (
                    <div
                      key={w.wafer_id}
                      id={`wafer-slot-${w.slot_number}`}
                      className={`wafer-slot-box ${statusClass} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedWafer(w)}
                      title={`Slot #${w.slot_number} - ${w.wafer_id} (${w.exposure_status})`}
                    >
                      <div className="wafer-slot-num">#{w.slot_number}</div>
                      <div className="wafer-slot-id">{w.wafer_id}</div>
                      <div className="wafer-status-tag">{statusLabel}</div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Wafer Detail Box */}
              {selectedWafer && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: 750, fontSize: '13px', color: '#1E293B', marginBottom: '6px' }}>
                    웨이퍼 상세: {selectedWafer.wafer_id} (Slot #{selectedWafer.slot_number})
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>소속 Lot: <strong>{selectedWafer.lot_id}</strong></div>
                    <div>처리 순서: <strong>{selectedWafer.sequence}번째</strong></div>
                    <div>노출 상태: <strong style={{ color: selectedWafer.exposure_status === 'CANDIDATE_EXPOSED' ? '#DC2626' : (selectedWafer.exposure_status === 'CONFIRMED_EXPOSED' ? '#047857' : '#64748B') }}>{selectedWafer.exposure_status}</strong></div>
                    <div>판정 근거: {selectedWafer.exposure_status === 'CANDIDATE_EXPOSED' ? 'T7 알람 전후 노출 후보군' : (selectedWafer.exposure_status === 'CONFIRMED_EXPOSED' ? '정상 식각 완료' : '미착수 대기')}</div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
