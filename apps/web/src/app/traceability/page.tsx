'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { EngineeringTermTrigger } from '@/components/ekl';

// Domain Interfaces
interface WaferItem {
  wafer_id: string;
  lot_id: string;
  slot_number: number;
  sequence: number;
  exposure_status: 'CONFIRMED_EXPOSED' | 'CANDIDATE_EXPOSED' | 'NOT_EXPOSED' | 'BYPASSED' | 'UNKNOWN';
}

interface WaferTimelineEvent {
  step_index: number;
  step_name: string;
  time_label: string;
  timestamp_utc: string;
  equipment_id: string;
  chamber_id: string;
  event_type: 'LOAD' | 'ALIGN' | 'PROCESS' | 'INTERLOCK' | 'HOLD';
  status: 'COMPLETED' | 'INTERRUPTED' | 'HELD' | 'SKIPPED' | 'PENDING';
  description: string;
}

interface WaferTraceDetail {
  wafer_id: string;
  lot_id: string;
  slot_number: number;
  sequence: number;
  exposure_status: 'CONFIRMED_EXPOSED' | 'CANDIDATE_EXPOSED' | 'NOT_EXPOSED';
  equipment_id: string;
  chamber_id: string;
  run_id: string;
  recipe_id: string;
  start_time_utc: string;
  data_origin: string;
  is_synthetic: boolean;
  related_alert_id: string | null;
  related_alert_rule: string | null;
  related_alert_severity: string | null;
  investigation_id: string | null;
  timeline: WaferTimelineEvent[];
}

interface NotFoundError {
  waferId: string;
  status: number;
  message: string;
}

const VALID_WAFER_PATTERN = /^W-(0[1-9]|1[0-9]|2[0-5])$/;

function isValidWaferId(waferId: string): boolean {
  return VALID_WAFER_PATTERN.test(waferId);
}

// Built-in Mode A Synthetic Trace Fixture Generator
function generateModeAWafers(seed: number): WaferItem[] {
  const lotNum = 800 + (seed % 50);
  const lotId = `LOT-DEMO-${lotNum}`;

  return Array.from({ length: 25 }, (_, i) => {
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
      exposure_status: status,
    };
  });
}

function generateModeAWaferTrace(waferId: string, seed: number): WaferTraceDetail {
  if (!isValidWaferId(waferId)) {
    throw new Error(`Cannot generate synthetic trace for invalid wafer ID '${waferId}'`);
  }

  const lotNum = 800 + (seed % 50);
  const lotId = `LOT-DEMO-${lotNum}`;
  const runId = `RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`;
  const alertId = `AL-DEMO-${String(seed % 1000).padStart(3, '0')}`;

  const slotMatch = waferId.match(/\d+/);
  const slotNumber = slotMatch ? parseInt(slotMatch[0], 10) : 1;

  let exposure_status: WaferTraceDetail['exposure_status'] = 'NOT_EXPOSED';
  if (slotNumber <= 7) exposure_status = 'CONFIRMED_EXPOSED';
  else if (slotNumber >= 8 && slotNumber <= 12) exposure_status = 'CANDIDATE_EXPOSED';

  const isAffected = exposure_status === 'CONFIRMED_EXPOSED' || exposure_status === 'CANDIDATE_EXPOSED';
  const related_alert_id = isAffected ? alertId : null;
  const related_alert_rule = isAffected ? 'FDC-RULE-SPC-UCL-01' : null;
  const related_alert_severity = isAffected ? 'CRITICAL' : null;
  const investigation_id = isAffected ? `INV-${alertId}` : null;

  const baseTimeStr = "2026-10-15T00:00:00.000Z";

  const timeline: WaferTimelineEvent[] = [
    {
      step_index: 1,
      step_name: "FOUP 카세트 로드 및 RFID 슬롯 매핑",
      time_label: "T-60s",
      timestamp_utc: "2026-10-14T23:59:00.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "LOADPORT-01",
      event_type: "LOAD",
      status: "COMPLETED",
      description: `25매 FOUP 로트(${lotId}) 로드포트 01 안착, RFID 태그 판독 및 슬롯 #${slotNumber} 위치 매핑 완료.`
    },
    {
      step_index: 2,
      step_name: "웨이퍼 반송 및 사전 정렬 (Pre-Align)",
      time_label: "T-20s",
      timestamp_utc: "2026-10-14T23:59:40.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "ALIGNER-01",
      event_type: "ALIGN",
      status: "COMPLETED",
      description: "대기 반송 로봇(EFEM)에 의해 노치(Notch) 정렬 및 레시피(RCP-ETCH-POLY-04) 공정 파라미터 사전 매핑 완료."
    }
  ];

  if (exposure_status === 'CONFIRMED_EXPOSED') {
    timeline.push({
      step_index: 3,
      step_name: "식각 공정 진행 완료 (CH-B Main Etch)",
      time_label: "T0 ~ T6",
      timestamp_utc: "2026-10-15T00:00:00.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "CH-B",
      event_type: "PROCESS",
      status: "COMPLETED",
      description: "식각 챔버(CH-B) 정전척(ESC) 안착 및 고주파 플라즈마 방전 식각 공정 완료."
    });
  } else if (exposure_status === 'CANDIDATE_EXPOSED') {
    timeline.push({
      step_index: 3,
      step_name: "챔버 진입 대기 큐 (Loadlock Buffer Queue)",
      time_label: "T6 ~ T7",
      timestamp_utc: "2026-10-15T00:00:00.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "LOADLOCK-B",
      event_type: "PROCESS",
      status: "INTERRUPTED",
      description: "진공 로드락 버퍼에서 CH-B 진입 준비 중 T7 센서 일탈 스파이크 감지로 이송 인터록(Interrupted) 발동."
    });
  } else {
    timeline.push({
      step_index: 3,
      step_name: "FOUP 카세트 내 미노출 대기 (Cassette Stored)",
      time_label: "T0 ~ T7",
      timestamp_utc: "2026-10-15T00:00:00.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "LOADPORT-01",
      event_type: "PROCESS",
      status: "SKIPPED",
      description: "선행 웨이퍼 가공 중 챔버 일탈 발생으로 공정 시퀀스가 정지되어 FOUP 카세트 내 미가공(Not Exposed) 상태 유지."
    });
  }

  if (isAffected) {
    timeline.push({
      step_index: 4,
      step_name: "FDC 센서 공정 이상 감지 (SPC UCL Excursion)",
      time_label: "T7",
      timestamp_utc: "2026-10-15T00:00:35.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "CH-B",
      event_type: "INTERLOCK",
      status: "HELD",
      description: `식각 챔버(CH-B) 압력/RF Power 급증으로 FDC 이상 알람(${alertId}) 트리거 및 설비 인터록.`
    });
  } else {
    timeline.push({
      step_index: 4,
      step_name: "설비 안전 인터록 정지 (Safety Interlock)",
      time_label: "T7",
      timestamp_utc: "2026-10-15T00:00:35.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "ETCH-02",
      event_type: "INTERLOCK",
      status: "COMPLETED",
      description: "설비 전역 비상 인터록 정지 작동으로 추가 웨이퍼 반송 차단."
    });
  }

  if (exposure_status === 'CANDIDATE_EXPOSED') {
    timeline.push({
      step_index: 5,
      step_name: "품질 보류 판정 및 결함 검측 배정 (Quality Hold)",
      time_label: "T8+",
      timestamp_utc: "2026-10-15T00:01:00.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "QA-DISPOSITION",
      event_type: "HOLD",
      status: "HELD",
      description: `엔지니어링 조사(${investigation_id}) 연계: 잠재 노출 후보군으로 분류되어 결함 검측(Defect Review) 및 EDS 우선 검사군으로 배정됨.`
    });
  } else if (exposure_status === 'CONFIRMED_EXPOSED') {
    timeline.push({
      step_index: 5,
      step_name: "노출 완료군 품질 일치성 검증 대기 (Lot Hold)",
      time_label: "T8+",
      timestamp_utc: "2026-10-15T00:01:00.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "QA-DISPOSITION",
      event_type: "HOLD",
      status: "HELD",
      description: "노출 완료군 품질 일치성 검증 및 박막 두께 측정 대기를 위해 로트 단위 품질 보류(Hold) 등록."
    });
  } else {
    timeline.push({
      step_index: 5,
      step_name: "미노출 웨이퍼 재투입 대기 (Unexposed Disposition)",
      time_label: "T8+",
      timestamp_utc: "2026-10-15T00:01:00.000Z",
      equipment_id: "ETCH-02",
      chamber_id: "LOADPORT-01",
      event_type: "HOLD",
      status: "PENDING",
      description: "미노출 안전 웨이퍼로 확인되어 설비 점검 완료 후 다음 생산 배치로 재투입 대기."
    });
  }

  return {
    wafer_id: waferId,
    lot_id: lotId,
    slot_number: slotNumber,
    sequence: slotNumber,
    exposure_status,
    equipment_id: "ETCH-02",
    chamber_id: "CH-B",
    run_id: runId,
    recipe_id: "RCP-ETCH-POLY-04",
    start_time_utc: baseTimeStr,
    data_origin: "synthetic",
    is_synthetic: true,
    related_alert_id,
    related_alert_rule,
    related_alert_severity,
    investigation_id,
    timeline
  };
}

function TraceabilityContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryWafer = searchParams.get('wafer') || 'W-08';

  const [mode, setMode] = useState<'A' | 'B'>('A');
  const [seed, setSeed] = useState<number>(20261015);
  const [selectedWaferId, setSelectedWaferId] = useState<string>(queryWafer);
  const [filter, setFilter] = useState<'ALL' | 'CONFIRMED' | 'CANDIDATE' | 'UNEXPOSED'>('ALL');
  const [wafers, setWafers] = useState<WaferItem[]>(() => generateModeAWafers(20261015));
  const [trace, setTrace] = useState<WaferTraceDetail | null>(() => {
    return isValidWaferId(queryWafer) ? generateModeAWaferTrace(queryWafer, 20261015) : null;
  });
  const [notFoundError, setNotFoundError] = useState<NotFoundError | null>(() => {
    return !isValidWaferId(queryWafer)
      ? {
          waferId: queryWafer,
          status: 404,
          message: `카세트 규격에 존재하지 않는 웨이퍼 ID ('${queryWafer}')입니다. (유효 범위: W-01 ~ W-25)`,
        }
      : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>("웨이퍼 추적 시스템 준비 완료");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Guards for race conditions (P1-A)
  const activeTraceReqIdRef = useRef<number>(0);
  const targetWaferIdRef = useRef<string>(queryWafer);

  // Unified data loader keeping data origin consistent (Mode A vs Mode B) and preventing race conditions
  const loadData = useCallback(async (targetWafer: string) => {
    const reqId = ++activeTraceReqIdRef.current;
    targetWaferIdRef.current = targetWafer;

    // 1. Validate Wafer ID first (P1-B fail-closed guard)
    if (!isValidWaferId(targetWafer)) {
      if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;
      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: 404,
        message: `카세트 규격에 존재하지 않는 웨이퍼 ID ('${targetWafer}')입니다. (25매 카세트 유효 범위: W-01 ~ W-25)`
      });
      setIsLoading(false);
      setNotice(`오류 (404 Not Found): 카세트에 존재하지 않는 웨이퍼 ID '${targetWafer}' 입니다.`);
      return;
    }

    setIsLoading(true);
    setNotFoundError(null);

    // 2. Fetch server summary FIRST to reliably acquire active_run_id (P1-A)
    let summaryRes: Response;
    try {
      summaryRes = await fetch('http://localhost:8000/api/v1/demo/summary', { cache: 'no-store' });
    } catch {
      // Genuine network connection failure (server unreachable / port 8000 down) -> Fallback to Mode A
      if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;

      setMode('A');
      setWafers(generateModeAWafers(seed));
      setActiveRunId(`RUN-DEMO-${String(seed % 1000).padStart(3, '0')}`);

      if (isValidWaferId(targetWafer)) {
        const synTrace = generateModeAWaferTrace(targetWafer, seed);
        setTrace(synTrace);
        setNotFoundError(null);
        setNotice(`Mode A: 백엔드 미실행에 따른 로컬 합성 픽스처 웨이퍼 ${targetWafer} 이력 표시.`);
      } else {
        setTrace(null);
        setNotFoundError({
          waferId: targetWafer,
          status: 404,
          message: `카세트 규격에 존재하지 않는 웨이퍼 ID ('${targetWafer}')입니다.`
        });
        setNotice(`오류 (404 Not Found): 카세트에 존재하지 않는 웨이퍼 ID '${targetWafer}' 입니다.`);
      }
      setIsLoading(false);
      return;
    }

    // Guard after summary fetch
    if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;

    if (!summaryRes.ok) {
      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: summaryRes.status,
        message: `API 서버 요약 조회 실패 (HTTP ${summaryRes.status}): 활성 공정 요약을 조회하지 못해 데이터 출처 무결성을 위해 조회를 차단했습니다.`
      });
      setMode('B');
      setNotice(`서버 응답 오류 (HTTP ${summaryRes.status}): 활성 Run 요약 정보를 가져오지 못했습니다.`);
      setIsLoading(false);
      return;
    }

    let summaryData: any;
    try {
      summaryData = await summaryRes.json();
    } catch {
      if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;
      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: 502,
        message: '서버 응답 형식 오류 (Malformed JSON): 공정 요약 데이터 형식이 올바른 JSON이 아닙니다.'
      });
      setMode('B');
      setNotice('서버 응답 형식 오류: 공정 요약 JSON 파싱에 실패했습니다.');
      setIsLoading(false);
      return;
    }

    // Guard after summary JSON parse
    if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;

    const currentRunId = summaryData?.active_run_id;
    if (!currentRunId || typeof currentRunId !== 'string') {
      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: 500,
        message: '서버 활성 Run 부재 오류: 활성 공정 Run ID가 확인되지 않아 조회를 차단했습니다.'
      });
      setMode('B');
      setNotice('서버 데이터 오류: 유효한 활성 공정 Run ID가 존재하지 않습니다.');
      setIsLoading(false);
      return;
    }

    // 3. Concurrently fetch trace detail and 25-wafer list with explicit run_id (P1-A)
    const runQuery = `?run_id=${encodeURIComponent(currentRunId)}`;
    let traceRes: Response;
    let wafersRes: Response;
    try {
      [traceRes, wafersRes] = await Promise.all([
        fetch(`http://localhost:8000/api/v1/demo/wafers/${targetWafer}/trace${runQuery}`, { cache: 'no-store' }),
        fetch(`http://localhost:8000/api/v1/demo/wafers${runQuery}`, { cache: 'no-store' })
      ]);
    } catch {
      if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;
      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: 500,
        message: '서버 통신 실패: 웨이퍼 상세 및 목록 조회 중 네트워크 연결이 끊어졌습니다.'
      });
      setMode('B');
      setNotice('네트워크 오류: 상세 데이터 수신에 실패했습니다.');
      setIsLoading(false);
      return;
    }

    // Guard after trace & wafers fetch
    if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;

    // Handle HTTP 404 for target wafer
    if (traceRes.status === 404) {
      let errorDetail = `서버 공정 DB에서 웨이퍼 '${targetWafer}'를 찾을 수 없습니다 (404 Not Found).`;
      try {
        const errJson = await traceRes.json();
        if (errJson && errJson.detail) errorDetail = errJson.detail;
      } catch {
        // ignore malformed error body
      }
      if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;

      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: 404,
        message: errorDetail
      });
      setMode('B');
      setActiveRunId(currentRunId);
      setNotice(`HTTP 404 Not Found: 서버 공정 DB에 웨이퍼 '${targetWafer}' 이력이 등록되어 있지 않습니다.`);

      if (wafersRes.ok) {
        try {
          const wData: WaferItem[] = await wafersRes.json();
          if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;
          setWafers(wData);
        } catch {}
      }
      setIsLoading(false);
      return;
    }

    // Check if either trace or wafers failed (non-2xx)
    if (!traceRes.ok || !wafersRes.ok) {
      const failedStatus = !traceRes.ok ? traceRes.status : wafersRes.status;
      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: failedStatus,
        message: `API 서버 응답 불완전 (HTTP ${failedStatus}): 웨이퍼 상세 또는 목록 조회가 실패하여 데이터 혼합을 방지하기 위해 조회를 차단했습니다.`
      });
      setMode('B');
      setNotice(`서버 응답 오류 (HTTP ${failedStatus}): 데이터 출처 무결성을 위해 조회를 차단했습니다.`);
      setIsLoading(false);
      return;
    }

    // Parse JSON payloads for trace and wafers
    let traceData: WaferTraceDetail;
    let wafersData: WaferItem[];
    try {
      [traceData, wafersData] = await Promise.all([
        traceRes.json(),
        wafersRes.json()
      ]);
    } catch {
      if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;
      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: 502,
        message: '서버 응답 형식 오류 (Malformed JSON): 상세 또는 목록 데이터 형식이 올바른 JSON이 아닙니다.'
      });
      setMode('B');
      setNotice('서버 응답 형식 오류: 상세/목록 JSON 파싱에 실패했습니다.');
      setIsLoading(false);
      return;
    }

    // Guard after JSON parsing
    if (reqId !== activeTraceReqIdRef.current || targetWaferIdRef.current !== targetWafer) return;

    // Lineage & Coherence Validation:
    // Verify trace, wafers, and summary belong to the same active run and cassette lot
    const isRunCoherent = traceData.run_id === currentRunId;
    const isLotCoherent = wafersData.length > 0 && wafersData.some(w => w.wafer_id === targetWafer && w.lot_id === traceData.lot_id);

    if (!isRunCoherent || !isLotCoherent) {
      setTrace(null);
      setNotFoundError({
        waferId: targetWafer,
        status: 500,
        message: `데이터 계통성 불일치 오류: 웨이퍼 상세(Run: ${traceData.run_id}), 목록(Lot: ${traceData.lot_id}), 활성 Run(Run: ${currentRunId})의 출처가 일치하지 않습니다.`
      });
      setMode('B');
      setNotice('데이터 계약 오류: 동일 공정 Run 및 Lot 계통 검증에 실패하여 조회를 차단했습니다.');
      setIsLoading(false);
      return;
    }

    // ATOMIC STATE COMMIT: All 3 succeeded, parsed, verified, and request token is still active!
    setTrace(traceData);
    setWafers(wafersData);
    setActiveRunId(currentRunId);
    setMode('B');
    setNotFoundError(null);
    setNotice(`Mode B (Live API): 웨이퍼 ${targetWafer} 공정 이력, 25매 카세트 및 Run 요약(${currentRunId}) 동기화 완료.`);
    setIsLoading(false);
  }, [seed]);

  // Sync if URL search param changes
  useEffect(() => {
    if (queryWafer && queryWafer !== targetWaferIdRef.current) {
      targetWaferIdRef.current = queryWafer;
      setSelectedWaferId(queryWafer);
      loadData(queryWafer);
    }
  }, [queryWafer, loadData]);

  // Initial load
  useEffect(() => {
    loadData(selectedWaferId);
  }, []);

  const handleSelectWafer = (wId: string) => {
    targetWaferIdRef.current = wId;
    activeTraceReqIdRef.current++;
    setSelectedWaferId(wId);
    router.replace(`/traceability?wafer=${wId}`, { scroll: false });
    loadData(wId);
  };

  const filteredWafers = useMemo(() => {
    return wafers.filter(w => {
      if (filter === 'CONFIRMED') return w.exposure_status === 'CONFIRMED_EXPOSED';
      if (filter === 'CANDIDATE') return w.exposure_status === 'CANDIDATE_EXPOSED';
      if (filter === 'UNEXPOSED') return w.exposure_status === 'NOT_EXPOSED';
      return true;
    });
  }, [wafers, filter]);

  const confirmedCount = wafers.filter(w => w.exposure_status === 'CONFIRMED_EXPOSED').length;
  const candidateCount = wafers.filter(w => w.exposure_status === 'CANDIDATE_EXPOSED').length;
  const unexposedCount = wafers.filter(w => w.exposure_status === 'NOT_EXPOSED').length;

  const currentLotId = trace?.lot_id || (wafers.length > 0 ? wafers[0].lot_id : 'LOT-DEMO-815');

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="logo-badge" aria-hidden="true">F1</div>
          <div>
            <span className="brand-title">FAB ONE</span>
            <span className="brand-subtitle">· Lot & Wafer Traceability</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '8px' }} aria-label="화면 탭">
          <Link href="/" className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            식각 챔버 시뮬레이터 (Home)
          </Link>
          <Link href="/traceability" className="nav-tab-link active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
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
          <Link href="/equipment-intelligence" className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            설비 인텔리전스 (Equipment)
          </Link>
          <Link href={`/fab-simulation${mode === 'A' ? `?seed=${seed}` : ''}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            FAB 시뮬레이션 (Simulation)
          </Link>
          <Link href={`/engineering-workspace${mode === 'A' ? `?seed=${seed}` : ''}`} className="nav-tab-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            엔지니어링 워크스페이스 (Workspace)
          </Link>
        </nav>

        {/* Status Pills */}
        <div className="top-status-pills">
          <span className="badge-synthetic" title="모든 데이터는 가상 시나리오 합성(Synthetic) 계약을 준수합니다">
            🧪 data_origin: synthetic
          </span>

          {mode === 'B' ? (
            <span className="pill pill-mode-b">
              <span className="pulse-dot"></span>
              Mode B · Live API
            </span>
          ) : (
            <span className="pill pill-mode-a">
              <span className="pulse-dot"></span>
              Mode A · Synthetic Fixture
            </span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="main-wrapper">
        {/* Notice Box */}
        <div className="notice-box" role="status">
          <strong>추적 상태 안내:</strong> {notice}
        </div>

        {/* 2-Column Traceability Layout */}
        <div className="trace-layout-grid">
          {/* Left Column: Wafer Cassette & Filter */}
          <aside className="trace-cassette-card" aria-label="웨이퍼 카세트 슬롯 선택">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#17263B' }}>
                  FOUP 카세트 슬롯 (25매)
                </h2>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Lot: <strong>{currentLotId}</strong>
                </div>
              </div>
              <span className="pill" style={{ fontSize: '10px', padding: '2px 8px' }}>
                선택: {selectedWaferId}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="trace-filter-row" role="tablist" aria-label="웨이퍼 상태 필터">
              <button
                type="button"
                className={`trace-filter-chip ${filter === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilter('ALL')}
              >
                전체 ({wafers.length})
              </button>
              <button
                type="button"
                className={`trace-filter-chip confirmed ${filter === 'CONFIRMED' ? 'active confirmed' : ''}`}
                onClick={() => setFilter('CONFIRMED')}
              >
                노출 확정 ({confirmedCount})
              </button>
              <button
                type="button"
                className={`trace-filter-chip candidate ${filter === 'CANDIDATE' ? 'active candidate' : ''}`}
                onClick={() => setFilter('CANDIDATE')}
              >
                잠재 영향군 ({candidateCount})
              </button>
              <button
                type="button"
                className={`trace-filter-chip unexposed ${filter === 'UNEXPOSED' ? 'active unexposed' : ''}`}
                onClick={() => setFilter('UNEXPOSED')}
              >
                미노출 ({unexposedCount})
              </button>
            </div>

            {/* Error Notification for Cassette */}
            {notFoundError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#991B1B',
                  lineHeight: 1.4,
                }}
              >
                <strong>⚠️ 카세트 동기화 중단:</strong><br />
                서버 오류로 인해 최신 25매 카세트 목록을 반영하지 못했습니다. 아래 슬롯은 이전 데이터(비활성 상태)입니다.
              </div>
            )}

            {/* 5x5 Cassette Matrix */}
            <div
              className="wafer-matrix-grid"
              style={{
                marginBottom: '16px',
                opacity: notFoundError ? 0.45 : 1,
                pointerEvents: notFoundError ? 'none' : 'auto'
              }}
            >
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

                const isSelected = selectedWaferId === w.wafer_id;

                return (
                  <div
                    key={w.wafer_id}
                    id={`cassette-slot-${w.slot_number}`}
                    className={`wafer-slot-box ${statusClass} ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectWafer(w.wafer_id)}
                    title={`Slot #${w.slot_number} - ${w.wafer_id} (${w.exposure_status})`}
                  >
                    <div className="wafer-slot-num">#{w.slot_number}</div>
                    <div className="wafer-slot-id">{w.wafer_id}</div>
                    <div className="wafer-status-tag">{statusLabel}</div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable Wafer List */}
            <div
              className="trace-wafer-list-scroll"
              style={{
                opacity: notFoundError ? 0.45 : 1,
                pointerEvents: notFoundError ? 'none' : 'auto'
              }}
            >
              {filteredWafers.map(w => {
                const isSelected = selectedWaferId === w.wafer_id;
                let badgeColor = "#64748B";
                let badgeBg = "#F1F5F9";
                let badgeBorder = "#CBD5E1";
                let label = "미노출 (Not Exposed)";

                if (w.exposure_status === 'CONFIRMED_EXPOSED') {
                  badgeColor = "#047857";
                  badgeBg = "#ECFDF5";
                  badgeBorder = "#A7F3D0";
                  label = "노출 확정 (Confirmed)";
                } else if (w.exposure_status === 'CANDIDATE_EXPOSED') {
                  badgeColor = "#B91C1C";
                  badgeBg = "#FEE2E2";
                  badgeBorder = "#FECACA";
                  label = "잠재 영향 (Candidate)";
                }

                return (
                  <div
                    key={w.wafer_id}
                    id={`wafer-list-item-${w.wafer_id}`}
                    className={`trace-wafer-list-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectWafer(w.wafer_id)}
                  >
                    <div>
                      <div style={{ fontWeight: 750, fontSize: '12px', color: '#1E293B' }}>
                        {w.wafer_id} <span style={{ color: '#64748B', fontWeight: 500 }}>(Slot #{w.slot_number})</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                        처리 순서: {w.sequence}번째
                      </div>
                    </div>
                    <span
                      className="pill"
                      style={{
                        padding: '2px 8px',
                        fontSize: '10px',
                        color: badgeColor,
                        background: badgeBg,
                        borderColor: badgeBorder
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Right Column: Trace Detail & Chronological Timeline */}
          {isLoading ? (
            <div className="trace-loading-card" role="status">
              <div className="pulse-dot" style={{ width: '12px', height: '12px', background: '#0B9F78' }}></div>
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#17263B', marginTop: '16px' }}>
                웨이퍼 {selectedWaferId} 공정 이력 조회 중...
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                이전 웨이퍼 데이터의 잔여 표시를 방지하고 최신 타임라인을 안전하게 동기화합니다.
              </div>
            </div>
          ) : notFoundError ? (
            <div className="trace-not-found-card" role="alert">
              <div className="not-found-icon" aria-hidden="true">
                {notFoundError.status === 404 ? '🔍' : '⚠️'}
              </div>
              <h2 className="not-found-title">
                {notFoundError.status === 404
                  ? '존재하지 않는 웨이퍼 (404 Not Found)'
                  : notFoundError.status === 502
                  ? '서버 응답 형식 오류 (502 Bad Gateway / Malformed JSON)'
                  : notFoundError.status === 500 && notFoundError.message.includes('계통성')
                  ? '데이터 계통성 불일치 오류 (Data Lineage Error)'
                  : notFoundError.status === 500
                  ? '서버 내부 오류 (HTTP 500 Internal Server Error)'
                  : `서버 통신 오류 (HTTP ${notFoundError.status})`}
              </h2>
              <div className="not-found-badge">
                {notFoundError.status === 404
                  ? `요청 웨이퍼: ${notFoundError.waferId}`
                  : `오류 코드: HTTP ${notFoundError.status}`}
              </div>
              <p className="not-found-desc">{notFoundError.message}</p>
              <div className="not-found-disclaimer">
                <strong>※ FAB ONE 도메인 무결성 규약:</strong><br />
                {notFoundError.status === 404
                  ? '서버에서 HTTP 404로 응답되었거나 25매 카세트 규격(W-01 ~ W-25)에 존재하지 않는 웨이퍼에 대해서는 임의의 가상 공정 이력(Synthetic Process Timeline)을 생성하지 않고 조회를 즉시 차단(Fail-Closed)합니다.'
                  : '서버 오류(HTTP 500/502 등) 또는 데이터 계통성 위반 발생 시, 이전 데이터와 신규 데이터를 혼합하거나 임의의 합성 이력으로 대체하지 않고 안전하게 조회를 차단(Fail-Closed)합니다.'}
              </div>
              <div className="not-found-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleSelectWafer('W-08')}
                >
                  기본 웨이퍼(W-08)로 이동
                </button>
                <Link href="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
                  챔버 대시보드로 이동 ↗
                </Link>
              </div>
            </div>
          ) : trace ? (
            <section className="trace-detail-card" aria-label="웨이퍼 공정 이력 상세">
              {/* Header Banner */}
              <div className="trace-header-banner">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 850, margin: 0, color: '#17263B' }}>
                      웨이퍼 {trace.wafer_id} 이력 추적
                    </h1>
                    <span
                      className="pill"
                      style={{
                        padding: '3px 10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: trace.exposure_status === 'CANDIDATE_EXPOSED' ? '#B91C1C' : (trace.exposure_status === 'CONFIRMED_EXPOSED' ? '#047857' : '#64748B'),
                        background: trace.exposure_status === 'CANDIDATE_EXPOSED' ? '#FEE2E2' : (trace.exposure_status === 'CONFIRMED_EXPOSED' ? '#ECFDF5' : '#F1F5F9'),
                        borderColor: trace.exposure_status === 'CANDIDATE_EXPOSED' ? '#FECACA' : (trace.exposure_status === 'CONFIRMED_EXPOSED' ? '#A7F3D0' : '#CBD5E1'),
                      }}
                    >
                      {trace.exposure_status === 'CONFIRMED_EXPOSED' && '노출 확정 (CONFIRMED_EXPOSED)'}
                      {trace.exposure_status === 'CANDIDATE_EXPOSED' && '잠재 영향군 (CANDIDATE_EXPOSED)'}
                      {trace.exposure_status === 'NOT_EXPOSED' && '미노출 (NOT_EXPOSED)'}
                    </span>
                    <EngineeringTermTrigger conceptId="wafer-exposure-status" label="노출 판정 기준" showBadge />
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    FOUP 카세트 슬롯 #{trace.slot_number} · 투입 시퀀스 #{trace.sequence}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link
                    href={`/?wafer=${trace.wafer_id}`}
                    className="btn-secondary"
                    style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '11px' }}
                  >
                    챔버 대시보드 보기 ↗
                  </Link>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="trace-meta-grid">
                <div className="trace-meta-col">
                  <span className="trace-meta-label">소속 Lot ID</span>
                  <span className="trace-meta-value">{trace.lot_id}</span>
                </div>
                <div className="trace-meta-col">
                  <span className="trace-meta-label">공정 Run ID</span>
                  <span className="trace-meta-value">{trace.run_id}</span>
                </div>
                <div className="trace-meta-col">
                  <span className="trace-meta-label">가공 설비 / 챔버</span>
                  <span className="trace-meta-value">{trace.equipment_id} · {trace.chamber_id}</span>
                </div>
                <div className="trace-meta-col">
                  <span className="trace-meta-label">적용 Recipe</span>
                  <span className="trace-meta-value">{trace.recipe_id}</span>
                </div>
              </div>

              {/* Related FDC Alert & Investigation Link Card */}
              {trace.related_alert_id ? (
                <div className="trace-alert-link-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>⚠️</span>
                      <strong style={{ fontSize: '13px', color: '#B91C1C' }}>
                        관련 FDC 이상 알람: [{trace.related_alert_severity}] {trace.related_alert_id} ({trace.related_alert_rule})
                      </strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#7F1D1D', marginTop: '4px', lineHeight: '1.5' }}>
                      식각 공정 스텝 T7 센서(OES Signal, Pressure, RF Power) 급증으로 공정 인터록이 발동되었습니다.<br />
                      해당 알람의 정밀 센서 계측 근거 및 엔지니어링 조사 패널로 즉시 이동할 수 있습니다.
                    </div>
                    {activeRunId && trace.run_id !== activeRunId && (
                      <div style={{ fontSize: '11px', color: '#B45309', marginTop: '6px', fontWeight: 600 }}>
                        ※ 과거 Run ({trace.run_id}) 기록입니다. 메인 챔버 대시보드로 이동 시 현재 활성 Run ({activeRunId})의 상태가 표시됩니다.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Link
                      href={`/?alert=${trace.related_alert_id}&investigation=true`}
                      className="btn-danger-outline"
                      style={{ textDecoration: 'none', padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      엔지니어링 조사 상세 보기 →
                    </Link>
                    <Link
                      href="/command-center"
                      className="btn-secondary"
                      style={{ textDecoration: 'none', padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      커맨드 센터로 복귀 ↗
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF1F5', marginTop: '16px', fontSize: '12px', color: '#64748B' }}>
                  ℹ️ 본 웨이퍼는 식각 공정 미착수 상태로 FOUP 카세트 내에 안전하게 보관되어 직결된 FDC 챔버 이상 알람이 없습니다.
                </div>
              )}

              {/* Vertical Chronological Process Timeline */}
              <div className="timeline-section-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B9F78" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>공정 이력 시간순 타임라인 (Chronological Process Timeline)</span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                  ※ 가상 시나리오 재구성 (Synthetic Scenario Reconstruction): 아래 5단계 공정 이벤트 로그는 공학 시뮬레이션용 합성 데이터이며 실제 장비 원시 로그가 아닙니다.
                </span>
              </div>

              <div className="timeline-v-container">
                {trace.timeline.map((event, idx) => {
                  let nodeStatusClass = "completed";
                  if (event.status === 'INTERRUPTED') nodeStatusClass = "interrupted";
                  else if (event.status === 'HELD') nodeStatusClass = "held";
                  else if (event.status === 'SKIPPED' || event.status === 'PENDING') nodeStatusClass = "skipped";

                  return (
                    <div key={idx} className="timeline-v-item">
                      <div className={`timeline-v-node ${nodeStatusClass}`}>
                        {event.step_index}
                      </div>

                      <div className="timeline-v-card">
                        <div className="timeline-v-header">
                          <span className="timeline-v-title">{event.step_name}</span>
                          <span className="timeline-v-time-badge">{event.time_label}</span>
                        </div>

                        <div className="timeline-v-sub">
                          <span>설비/위치: <strong>{event.equipment_id} · {event.chamber_id}</strong></span>
                          <span>이벤트 유형: <strong>{event.event_type}</strong></span>
                          <span>진행 상태: <strong style={{ color: event.status === 'INTERRUPTED' ? '#DC2626' : (event.status === 'HELD' ? '#D97706' : '#0B9F78') }}>{event.status}</strong></span>
                          <span>기록 시각: {event.timestamp_utc}</span>
                        </div>

                        <div className="timeline-v-desc">
                          {event.description}
                        </div>

                        {/* Step-specific EKL Engineering Knowledge triggers */}
                        {event.step_index === 3 && (
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>공학 개념 (EKL):</span>
                            <EngineeringTermTrigger conceptId="rf-power" label="RF Power 전력 원리" showBadge />
                            <EngineeringTermTrigger conceptId="etch-rate" label="식각 속도 (Etch Rate) 계산 예제" showBadge />
                          </div>
                        )}
                        {event.step_index === 4 && (
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>공학 개념 (EKL):</span>
                            <EngineeringTermTrigger conceptId="spc-ucl-missing" label="UCL 관리한계 및 결측" showBadge />
                            <EngineeringTermTrigger conceptId="oes-relative-signal" label="OES 상대 신호 해석" showBadge />
                          </div>
                        )}
                        {event.step_index === 5 && (
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>공학 개념 (EKL):</span>
                            <EngineeringTermTrigger conceptId="wafer-exposure-status" label="노출 확정 vs 잠재 후보" showBadge />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Synthetic Data Disclaimer Footer */}
              <div style={{ marginTop: '24px', padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px', color: '#64748B', lineHeight: '1.6' }}>
                <strong>※ [가상 시나리오 추적성 데이터 안내]</strong><br />
                본 웨이퍼의 공정 이력과 시계열 타임라인은 {mode === 'A' ? `시뮬레이션 합성(Synthetic, Seed: ${seed})` : '시뮬레이션 합성(Synthetic Live API)'} 계약에 기반하여 생성된 데이터입니다.
                실제 공정 DB에 존재하지 않는 공정 이력은 사실로 가장하여 생성되지 않으며, 모든 레코드는 <code>data_origin: synthetic</code> 속성을 보존합니다.
              </div>
            </section>

          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function TraceabilityPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>로딩 중...</div>}>
      <TraceabilityContent />
    </Suspense>
  );
}
