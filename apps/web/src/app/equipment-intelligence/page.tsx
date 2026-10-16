'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  SensorId,
  VALID_SENSORS,
  SensorSample,
  parseSensorQuery,
  getSensorMetadata,
  filterSamplesBySensor,
  findSampleForStep,
  calculateChartCoordinates,
  calculateDynamicSegments,
  calculateMissingRange,
  getThresholdPositions,
  generateModeAEquipmentSamples,
} from '../../components/equipment-intelligence/equipment-intelligence-contract';
import {
  FdcAlert,
  isInvestigationSupported,
} from '../../components/command-center/command-center-contract';
import {
  EngineeringTermTrigger,
  EngineeringDeepDivePanel,
} from '../../components/ekl';

function EquipmentIntelligenceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Mode and Data State
  const [mode, setMode] = useState<'A' | 'B'>('B');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lotId, setLotId] = useState<string | null>(null);
  const [samples, setSamples] = useState<SensorSample[]>([]);
  const [alerts, setAlerts] = useState<FdcAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [seed, setSeed] = useState<number>(42);

  // User Interactive Selection State
  const initialSensor = parseSensorQuery(searchParams.get('sensor'));
  const [selectedSensor, setSelectedSensor] = useState<SensorId>(initialSensor);
  const [selectedStep, setSelectedStep] = useState<number>(7); // Default to T7 excursion step

  // Async request sequence counter to eliminate race conditions
  const requestTokenRef = useRef<number>(0);

  // Synchronize sensor from query parameter
  useEffect(() => {
    const querySensor = parseSensorQuery(searchParams.get('sensor'));
    if (querySensor !== selectedSensor) {
      setSelectedSensor(querySensor);
    }
  }, [searchParams]);

  // Handle sensor tab click and URL sync
  const handleSelectSensor = (sensorId: SensorId) => {
    setSelectedSensor(sensorId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('sensor', sensorId);
    router.replace(`/equipment-intelligence?${params.toString()}`, { scroll: false });
  };

  // Primary Data Loading Routine (Summary-first with run-locked query)
  const loadData = async (forceSeed?: number) => {
    const currentToken = ++requestTokenRef.current;
    setLoading(true);
    setErrorMessage(null);

    const activeSeed = forceSeed !== undefined ? forceSeed : seed;

    try {
      // 1. Fetch Summary to establish authoritative active_run_id
      const summaryRes = await fetch('/api/v1/demo/summary');

      // Check if request was superseded during network flight
      if (currentToken !== requestTokenRef.current) return;

      if (!summaryRes.ok) {
        throw new Error(`HTTP ${summaryRes.status}: 공정 요약 정보를 불러올 수 없습니다 (Fail-closed).`);
      }

      const summaryData = await summaryRes.json();
      if (currentToken !== requestTokenRef.current) return;

      const discoveredRunId = summaryData?.active_run_id;
      if (!discoveredRunId || typeof discoveredRunId !== 'string' || discoveredRunId.trim().length === 0) {
        throw new Error('활성화된 공정 Run이 존재하지 않아 설비 계측 데이터를 조회할 수 없습니다 (Fail-closed).');
      }

      // 2. Fetch Run Samples and Alerts in parallel using the exact discovered Run ID
      const [samplesRes, alertsRes] = await Promise.all([
        fetch(`/api/v1/demo/runs/${encodeURIComponent(discoveredRunId)}/samples`),
        fetch(`/api/v1/demo/alerts?run_id=${encodeURIComponent(discoveredRunId)}`),
      ]);

      if (currentToken !== requestTokenRef.current) return;

      if (!samplesRes.ok) {
        throw new Error(`HTTP ${samplesRes.status}: 설비 센서 시계열 데이터를 불러올 수 없습니다 (Fail-closed).`);
      }

      const rawSamples = await samplesRes.json();
      const rawAlerts = alertsRes.ok ? await alertsRes.json() : [];

      if (currentToken !== requestTokenRef.current) return;

      // 3. Schema validation: Must be an array of samples
      if (!Array.isArray(rawSamples) || rawSamples.length < 8) {
        throw new Error('수신된 센서 계측 데이터 구조가 유효하지 않거나 샘플 수가 부족합니다 (Fail-closed).');
      }

      // Atomic state commit
      setMode('B');
      setActiveRunId(discoveredRunId);
      setLotId(summaryData.lot_id || 'LOT-20261015-001');
      setSamples(rawSamples);
      setAlerts(Array.isArray(rawAlerts) ? rawAlerts : []);
      setNoticeMessage(`Mode B (FastAPI 연동): 활성 Run ${discoveredRunId}의 ETCH-02 / CH-B 원자적 센서 텔레메트리 연동 완료.`);
      setLoading(false);
    } catch (err: any) {
      if (currentToken !== requestTokenRef.current) return;

      // Offline Network Fallback to Mode A
      const isOffline =
        err instanceof TypeError ||
        err.name === 'TypeError' ||
        (err.message && err.message.includes('fetch'));

      if (isOffline) {
        const fixture = generateModeAEquipmentSamples(activeSeed);
        setMode('A');
        setActiveRunId(fixture.summary.run_id);
        setLotId(fixture.summary.lot_id);
        setSamples(fixture.samples);
        setAlerts(fixture.alerts);
        setNoticeMessage(
          `Mode A (오프라인 합성 시뮬레이션): API 서버 미연결 상태로 난수 시드(Seed: ${activeSeed}) 기반 결정론적 합성 데이터를 표출합니다.`
        );
        setLoading(false);
      } else {
        // Mode B Server Error (Fail-Closed)
        setErrorMessage(err.message || '데이터 로드 실패 (Fail-closed)');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [seed]);

  // Derived Sensor and Step Data
  const metadata = getSensorMetadata(selectedSensor);
  const sensorSamples = useMemo(() => {
    return filterSamplesBySensor(samples, selectedSensor);
  }, [samples, selectedSensor]);

  const currentStepSample = useMemo(() => {
    return findSampleForStep(samples, selectedSensor, selectedStep);
  }, [samples, selectedSensor, selectedStep]);

  // SVG Chart Geometry Calculations
  const chartCoordinates = useMemo(() => {
    return calculateChartCoordinates(samples, selectedSensor);
  }, [samples, selectedSensor]);

  const dynamicSegments = useMemo(() => {
    return calculateDynamicSegments(chartCoordinates);
  }, [chartCoordinates]);

  const missingRange = useMemo(() => {
    return calculateMissingRange(chartCoordinates);
  }, [chartCoordinates]);

  const thresholds = useMemo(() => {
    return getThresholdPositions(selectedSensor);
  }, [selectedSensor]);

  // Relevant Alert for ETCH-02 / CH-B in the active run
  const activeAlert = useMemo(() => {
    return (
      alerts.find(
        (a) =>
          a.equipment_id === 'ETCH-02' &&
          a.chamber_id === 'CH-B' &&
          a.run_id === activeRunId &&
          a.severity === 'CRITICAL'
      ) || alerts[0] || null
    );
  }, [alerts, activeRunId]);

  const invSupport = useMemo(() => {
    return isInvestigationSupported(activeAlert, activeRunId);
  }, [activeAlert, activeRunId]);

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="logo-badge" aria-hidden="true">F1</div>
          <div>
            <span className="brand-title">FAB ONE</span>
            <span className="brand-subtitle">· Equipment Intelligence</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '8px' }} aria-label="화면 탭">
          <Link href="/" className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            홈 (FDC 모니터링)
          </Link>
          <Link href="/traceability" className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            웨이퍼 이력 추적성 (Traceability)
          </Link>
          <Link href="/command-center" className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            FDC 커맨드 센터 (Command Center)
          </Link>
          <Link href="/equipment-intelligence" className="nav-tab-link active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            설비 인텔리전스 (Equipment)
          </Link>
        </nav>

        {/* Status Pills */}
        <div className="top-status-pills">
          <span
            className="pill"
            style={{
              background: mode === 'A' ? '#FEF3C7' : '#ECFDF5',
              color: mode === 'A' ? '#92400E' : '#047857',
              borderColor: mode === 'A' ? '#FCD34D' : '#A7F3D0',
            }}
          >
            {mode === 'A' ? 'Mode A (오프라인 합성 시뮬레이션)' : 'Mode B (FastAPI 연동)'}
          </span>
          <span className="pill" style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
            Run: {activeRunId || '미가동'}
          </span>
          <span className="pill" style={{ background: '#F8FAFC', color: '#475569', borderColor: '#CBD5E1' }}>
            설비: ETCH-02 · CH-B
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Notice Banner */}
        {noticeMessage && (
          <div
            className="alert-banner"
            style={{
              background: mode === 'A' ? '#FFFBEB' : '#ECFDF5',
              borderColor: mode === 'A' ? '#FDE68A' : '#A7F3D0',
              color: mode === 'A' ? '#92400E' : '#065F46',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>{noticeMessage}</span>
              {mode === 'A' && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '11px', background: '#FFFFFF' }}
                  onClick={() => setSeed((s) => s + 1)}
                  title="난수 시드를 변경하여 새로운 합성 계측값을 생성합니다"
                >
                  시드 변경 재합성 (Seed: {seed})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Engineering Standards & Product Boundaries Notice */}
        <div
          style={{
            padding: '12px 16px',
            background: '#F8FAFC',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            marginBottom: '20px',
            fontSize: '12px',
            lineHeight: 1.5,
            color: '#475569',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#1E293B', marginBottom: '4px' }}>
            <span>📐 공학적 기준 및 제품 경계 고지 (Engineering Standards Notice):</span>
          </div>
          <div>
            본 화면의 <strong>UCL(상한 관리한계 65.0 a.u. / 140 mTorr / 1650 W)</strong> 및 Target은 통계적 공정 관리(SPC) 설명용 가상 기준값이며, 소자 고객의 <strong>물리적 제품 규격한계(USL/LSL)</strong>와 엄격히 구별됩니다.
            <br />
            <strong>결측치(MISSING ≠ 0)</strong>는 수치 0이 아니며(광학 셔터 물리적 차단), <strong>공정 일탈(Excursion ≠ Defect)</strong>은 즉각적인 웨이퍼 불량 확정을 의미하지 않습니다.
          </div>
        </div>

        {/* Fail-Closed Error State */}
        {errorMessage ? (
          <div className="ei-card" style={{ borderLeft: '4px solid #DC2626' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <strong style={{ fontSize: '16px' }}>설비 계측 텔레메트리 로드 실패 (Fail-closed)</strong>
            </div>
            <p style={{ color: '#64748B', fontSize: '13px', lineHeight: 1.6 }}>{errorMessage}</p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button type="button" className="btn-primary" onClick={() => loadData()}>
                다시 시도
              </button>
              <Link href="/command-center" className="btn-secondary" style={{ textDecoration: 'none' }}>
                FDC 커맨드 센터로 복귀
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Sensor Selection Tabs */}
            <div className="ei-sensor-tabs" role="tablist" aria-label="계측 센서 탭">
              {VALID_SENSORS.map((sensorId) => {
                const sMeta = getSensorMetadata(sensorId);
                const isActive = selectedSensor === sensorId;
                return (
                  <button
                    key={sensorId}
                    type="button"
                    role="tab"
                    id={`ei-tab-${sensorId}`}
                    aria-selected={isActive}
                    aria-controls={`ei-panel-${sensorId}`}
                    tabIndex={0}
                    className={`ei-sensor-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectSensor(sensorId)}
                  >
                    <span>
                      {sensorId === 'RELATIVE_SIGNAL' ? '🔬' : sensorId === 'CHAMBER_PRESSURE' ? '🌪️' : '⚡'}
                    </span>
                    <span>{sMeta.name.split(' (')[0]}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: isActive ? '#DCFCE7' : '#F1F5F9',
                        color: isActive ? '#15803D' : '#64748B',
                      }}
                    >
                      [{sMeta.unit}]
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Main Interactive Grid */}
            <div className="ei-layout-grid">
              {/* Left Column: Interactive Chart and Step Timeline */}
              <div>
                <div className="ei-card" id={`ei-panel-${selectedSensor}`} role="tabpanel" aria-labelledby={`ei-tab-${selectedSensor}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#17263B', marginBottom: '4px' }}>
                        {metadata.name}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>
                        {metadata.description}
                      </p>
                    </div>
                    <span className="pill" style={{ background: '#F8FAFC', color: '#475569' }}>
                      {metadata.measurementType === 'DISCONTINUOUS' ? '비연속 계측 (결측 구간 존재)' : '연속 계측 (결측 없음)'}
                    </span>
                  </div>

                  {/* SVG Chart Container */}
                  <div style={{ position: 'relative', width: '100%', height: '260px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '10px' }}>
                    <svg viewBox="0 0 600 240" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      {/* Grid Lines */}
                      <line x1="50" y1="30" x2="570" y2="30" stroke="#E2E8F0" strokeDasharray="3 3" />
                      <line x1="50" y1="120" x2="570" y2="120" stroke="#E2E8F0" strokeDasharray="3 3" />
                      <line x1="50" y1="210" x2="570" y2="210" stroke="#CBD5E1" />

                      {/* Y-Axis Labels */}
                      <text x="45" y="35" textAnchor="end" fontSize="10" fill="#94A3B8">
                        {selectedSensor === 'RELATIVE_SIGNAL' ? '100' : selectedSensor === 'CHAMBER_PRESSURE' ? '200' : '2000'}
                      </text>
                      <text x="45" y="125" textAnchor="end" fontSize="10" fill="#94A3B8">
                        {selectedSensor === 'RELATIVE_SIGNAL' ? '50' : selectedSensor === 'CHAMBER_PRESSURE' ? '150' : '1500'}
                      </text>
                      <text x="45" y="214" textAnchor="end" fontSize="10" fill="#94A3B8">
                        {selectedSensor === 'RELATIVE_SIGNAL' ? '0' : selectedSensor === 'CHAMBER_PRESSURE' ? '100' : '1000'}
                      </text>

                      {/* Target Reference Line (Blue Dashed) */}
                      <line x1="50" y1={thresholds.targetY} x2="570" y2={thresholds.targetY} stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="4 4" />
                      <text x="568" y={thresholds.targetY - 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#2563EB">
                        Target ({metadata.target} {metadata.unit})
                      </text>

                      {/* UCL Reference Line (Red Dashed) */}
                      <line x1="50" y1={thresholds.uclY} x2="570" y2={thresholds.uclY} stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4 4" />
                      <text x="568" y={thresholds.uclY - 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#DC2626">
                        UCL ({metadata.ucl} {metadata.unit})
                      </text>

                      {/* Missing Range Overlay (Dynamic Segmentation Invariant: Rendered only when missing points exist) */}
                      {missingRange && (
                        <g>
                          <rect
                            x={missingRange.minX}
                            y="20"
                            width={missingRange.width}
                            height="195"
                            fill="#F1F5F9"
                            stroke="#CBD5E1"
                            strokeDasharray="2 2"
                            rx="4"
                            opacity="0.85"
                          />
                          <text
                            x={missingRange.minX + missingRange.width / 2}
                            y="110"
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="700"
                            fill="#64748B"
                          >
                            셔터 차단 결측 구간 ({missingRange.labels})
                          </text>
                          <text
                            x={missingRange.minX + missingRange.width / 2}
                            y="126"
                            textAnchor="middle"
                            fontSize="10"
                            fill="#94A3B8"
                          >
                            MISSING (0으로 보간 금지)
                          </text>
                        </g>
                      )}

                      {/* Dynamic Segmented Polyline Paths */}
                      {dynamicSegments.map((dPath, pIdx) => (
                        <path
                          key={pIdx}
                          d={dPath}
                          fill="none"
                          stroke={selectedSensor === 'RELATIVE_SIGNAL' ? '#0B9F78' : selectedSensor === 'CHAMBER_PRESSURE' ? '#D97706' : '#2563EB'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}

                      {/* Step Points */}
                      {chartCoordinates.map((pt) => {
                        const isSelected = pt.step_index === selectedStep;
                        const isMissing = pt.quality_flag === 'MISSING' || pt.measured_value === null;
                        const isExcursion = pt.measured_value !== null && pt.measured_value > metadata.ucl;

                        if (isMissing) {
                          return (
                            <g key={pt.step_index}>
                              <circle cx={pt.x} cy="210" r="4" fill="#CBD5E1" />
                              <text x={pt.x} y="225" textAnchor="middle" fontSize="10" fill="#94A3B8">
                                {pt.time_label}
                              </text>
                            </g>
                          );
                        }

                        return (
                          <g
                            key={pt.step_index}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedStep(pt.step_index)}
                          >
                            {isSelected && (
                              <circle cx={pt.x} cy={pt.y!} r="9" fill="none" stroke="#0B9F78" strokeWidth="2" strokeDasharray="2 2" />
                            )}
                            <circle
                              cx={pt.x}
                              cy={pt.y!}
                              r={isSelected ? '6' : '4.5'}
                              fill={isExcursion ? '#DC2626' : isSelected ? '#0B9F78' : '#17263B'}
                              stroke="#FFFFFF"
                              strokeWidth="1.5"
                            />
                            <text
                              x={pt.x}
                              y="225"
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight={isSelected ? '800' : '500'}
                              fill={isSelected ? '#0B9F78' : '#64748B'}
                            >
                              {pt.time_label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Step Timeline Selection Buttons */}
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                      공정 단계별 계측 선택 (T0 ~ T7 Time Step Timeline):
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {chartCoordinates.map((pt) => {
                        const isSelected = pt.step_index === selectedStep;
                        const isExcursion = pt.measured_value !== null && pt.measured_value > metadata.ucl;
                        const isMissing = pt.quality_flag === 'MISSING';

                        return (
                          <button
                            key={pt.step_index}
                            type="button"
                            id={`ei-step-btn-${pt.step_index}`}
                            aria-pressed={isSelected}
                            className={`ei-step-btn ${isSelected ? 'selected' : ''} ${isExcursion ? 'excursion' : ''}`}
                            onClick={() => setSelectedStep(pt.step_index)}
                          >
                            <span style={{ fontWeight: 800, color: isExcursion ? '#DC2626' : isSelected ? '#0B9F78' : '#1E293B' }}>
                              {pt.time_label}
                            </span>
                            <span style={{ fontSize: '10px', color: isMissing ? '#94A3B8' : isExcursion ? '#B91C1C' : '#475569', marginTop: '2px' }}>
                              {isMissing ? 'NULL' : pt.measured_value}
                            </span>
                            <span
                              style={{
                                fontSize: '8px',
                                padding: '1px 3px',
                                borderRadius: '2px',
                                marginTop: '3px',
                                background: isMissing ? '#F1F5F9' : isExcursion ? '#FEF2F2' : '#ECFDF5',
                                color: isMissing ? '#64748B' : isExcursion ? '#DC2626' : '#047857',
                              }}
                            >
                              {pt.quality_flag}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Table View of Samples */}
                <div className="ei-card">
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#17263B', marginBottom: '8px' }}>
                    📋 {metadata.name.split(' (')[0]} 단계별 계측 데이터 테이블
                  </h4>
                  <table className="ei-table">
                    <thead>
                      <tr>
                        <th>단계</th>
                        <th>센서 ID</th>
                        <th>계측값</th>
                        <th>단위</th>
                        <th>품질 플래그 (Quality)</th>
                        <th>SPC 상태</th>
                        <th>수집 시각 (UTC)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sensorSamples.map((s) => {
                        const isSelected = s.step_index === selectedStep;
                        const isExcursion = s.measured_value !== null && s.measured_value > metadata.ucl;
                        const isMissing = s.quality_flag === 'MISSING';

                        return (
                          <tr
                            key={s.step_index}
                            className={`${isSelected ? 'selected' : ''} ${isExcursion ? 'excursion' : ''}`}
                            onClick={() => setSelectedStep(s.step_index)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <strong>{s.time_label}</strong>
                            </td>
                            <td>{s.sensor_id}</td>
                            <td>
                              <strong style={{ color: isExcursion ? '#DC2626' : isMissing ? '#94A3B8' : '#1E293B' }}>
                                {isMissing ? 'NULL (결측)' : s.measured_value}
                              </strong>
                            </td>
                            <td>{s.unit}</td>
                            <td>
                              <span
                                className="pill"
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  background: isMissing ? '#F1F5F9' : isExcursion ? '#FEF2F2' : '#ECFDF5',
                                  color: isMissing ? '#64748B' : isExcursion ? '#DC2626' : '#047857',
                                  borderColor: isMissing ? '#E2E8F0' : isExcursion ? '#FECACA' : '#A7F3D0',
                                }}
                              >
                                {s.quality_flag}
                              </span>
                            </td>
                            <td>
                              {isExcursion ? (
                                <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '11px' }}>
                                  🚨 UCL 초과 일탈 ({s.measured_value} &gt; {metadata.ucl})
                                </span>
                              ) : isMissing ? (
                                <span style={{ color: '#64748B', fontSize: '11px' }}>차단 구간 (정상 결측)</span>
                              ) : (
                                <span style={{ color: '#047857', fontSize: '11px' }}>정상 관리 범위</span>
                              )}
                            </td>
                            <td style={{ fontSize: '11px', color: '#64748B' }}>
                              {s.sim_time_utc ? new Date(s.sim_time_utc).toISOString().substring(11, 19) + ' UTC' : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Step Inspection, Limits, Alert Binding & EKL */}
              <div>
                {/* Step Detail Card */}
                <div className="ei-card" style={{ borderTop: '4px solid #0B9F78' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#047857' }}>
                      🎯 선택 단계 상세 계측 카드
                    </span>
                    <span className="pill" style={{ background: '#ECFDF5', color: '#047857' }}>
                      {currentStepSample?.time_label || `T${selectedStep}`}
                    </span>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>선택 센서 및 단위:</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B' }}>
                      {metadata.name.split(' (')[0]} ({metadata.unit})
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF1F5' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>계측 결과값:</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '24px',
                          fontWeight: 800,
                          color:
                            currentStepSample?.measured_value !== null && currentStepSample?.measured_value! > metadata.ucl
                              ? '#DC2626'
                              : currentStepSample?.quality_flag === 'MISSING'
                              ? '#94A3B8'
                              : '#17263B',
                        }}
                      >
                        {currentStepSample?.quality_flag === 'MISSING' ? 'NULL' : currentStepSample?.measured_value ?? '-'}
                      </span>
                      <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>{metadata.unit}</span>
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>품질 플래그:</span>
                      <span
                        className="pill"
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: currentStepSample?.quality_flag === 'GOOD' ? '#ECFDF5' : currentStepSample?.quality_flag === 'MISSING' ? '#F1F5F9' : '#FEF2F2',
                          color: currentStepSample?.quality_flag === 'GOOD' ? '#047857' : currentStepSample?.quality_flag === 'MISSING' ? '#64748B' : '#DC2626',
                          borderColor: currentStepSample?.quality_flag === 'GOOD' ? '#A7F3D0' : currentStepSample?.quality_flag === 'MISSING' ? '#E2E8F0' : '#FECACA',
                        }}
                      >
                        {currentStepSample?.quality_flag}
                      </span>
                    </div>
                  </div>

                  {/* Control Limits vs Specification Limits Distinction Card */}
                  <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginBottom: '14px' }}>
                    <div style={{ fontWeight: 700, color: '#17263B', marginBottom: '4px' }}>
                      통계적 관리한계 (SPC):
                    </div>
                    <div>• Target (공정 목표): {metadata.target} {metadata.unit}</div>
                    <div>• UCL (상한 관리한계): {metadata.ucl} {metadata.unit}</div>
                    {metadata.lcl !== null && <div>• LCL (하한 관리한계): {metadata.lcl} {metadata.unit}</div>}
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                      {metadata.controlLimitNotice}
                    </div>
                  </div>
                </div>

                {/* FDC Alert & Investigation Link Card */}
                <div className="ei-card" style={{ borderLeft: '4px solid #DC2626' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🚨</span>
                    <strong style={{ fontSize: '14px', color: '#B91C1C' }}>
                      연계 FDC 경보 및 이상 조사 (Investigation)
                    </strong>
                  </div>

                  {invSupport.supported && activeAlert ? (
                    <div>
                      <div style={{ fontSize: '12px', color: '#7F1D1D', marginBottom: '10px', lineHeight: 1.5 }}>
                        선택 Run <strong>{activeAlert.run_id}</strong> (ETCH-02 / CH-B)의 스텝 T7 센서 이상 계측 근거가 등록된 유효 알람입니다.
                      </div>

                      <div style={{ padding: '10px', background: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA', marginBottom: '12px', fontSize: '11px' }}>
                        <div><strong>경보 ID:</strong> {activeAlert.alert_id}</div>
                        <div><strong>규칙 코드:</strong> {activeAlert.rule_code}</div>
                        <div><strong>심각도:</strong> {activeAlert.severity}</div>
                      </div>

                      {/* Candidate Wafers Preview */}
                      {activeAlert.candidate_wafers && activeAlert.candidate_wafers.length > 0 && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', marginBottom: '6px' }}>
                            잠재 노출 영향군 웨이퍼 ({activeAlert.candidate_wafers.length}매):
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {activeAlert.candidate_wafers.map((wId) => (
                              <Link
                                key={wId}
                                href={`/traceability?wafer=${wId}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: '#FFFFFF',
                                  border: '1px solid #FECACA',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#B91C1C',
                                  textDecoration: 'none',
                                }}
                                title={`웨이퍼 ${wId} 이력 추적성 보기`}
                              >
                                {wId} ↗
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Links */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Link
                          id="ei-btn-go-investigation"
                          href={`/?alert=${encodeURIComponent(activeAlert.alert_id)}&investigation=true&sensor=${encodeURIComponent(selectedSensor)}`}
                          className="btn-danger-outline"
                          style={{
                            textDecoration: 'none',
                            padding: '10px 14px',
                            fontSize: '13px',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        >
                          엔지니어링 이상 조사 상세 보기 →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.6 }}>
                      <div>{invSupport.reason}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                        계측 이상 근거가 부재한 설비/경보는 허위 조사 연결을 차단합니다 (Fail-closed).
                      </div>
                    </div>
                  )}

                  {/* Return to Command Center Link */}
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
                    <Link
                      id="ei-btn-back-command-center"
                      href="/command-center"
                      className="btn-secondary"
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        padding: '8px 12px',
                        fontSize: '12px',
                        textAlign: 'center',
                        color: '#047857',
                        borderColor: '#A7F3D0',
                      }}
                    >
                      ← FDC 알람 커맨드 센터 복귀
                    </Link>
                  </div>
                </div>

                {/* EKL Level 1 Engineering Concepts Integration */}
                <div className="ei-card" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                      📚 설비 연계 공학 지식 (EKL L1)
                    </span>
                    <span style={{ fontSize: '10px', color: '#15803D' }}>클릭 시 계산기·심층 학습 모달</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <EngineeringTermTrigger conceptId="oes-relative-signal" label="OES 상대 신호 원리" showBadge />
                    <EngineeringTermTrigger conceptId="rf-power" label="RF Power 전력 제어" showBadge />
                    <EngineeringTermTrigger conceptId="spc-ucl-missing" label="SPC 관리한계 및 결측치" showBadge />
                    <EngineeringTermTrigger conceptId="wafer-exposure-status" label="노출 확정 vs 잠재 후보" showBadge />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Global EKL Deep Dive Modal Panel */}
      <EngineeringDeepDivePanel />
    </div>
  );
}

export default function EquipmentIntelligencePage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>설비 인텔리전스 로딩 중...</div>}>
      <EquipmentIntelligenceContent />
    </Suspense>
  );
}
