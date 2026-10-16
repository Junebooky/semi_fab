import { test, expect } from '@playwright/test';

test.describe('BUILD-13 Mode B Integrated Investigation & Casebook E2E', () => {
  // Test 1: Full Mode B connected 7-screen consecutive browser journey & Case Report Truth Contract
  test('Mode B connected flow: Full 7-screen browser journey from Home to CC, EI, Traceability, Workspace, Casebook, and Historical Run', async ({ page }) => {
    // Ensure at least one previous run exists so it can be viewed in the historical run snapshot viewer
    await page.request.post('http://localhost:8000/api/v1/demo/runs', {
      data: {
        seed: 1010,
        scenario_id: 'ETH-SYN-01',
        equipment_id: 'ETCH-02',
        chamber_id: 'CH-B',
      },
    });

    // 1. Fetch active run summary from backend API
    const summaryResponse = await page.request.get('http://localhost:8000/api/v1/demo/summary');
    expect(summaryResponse.ok()).toBeTruthy();
    const summary = await summaryResponse.json();
    const activeRunId = summary.active_run_id;
    expect(activeRunId).toBeTruthy();

    // 2. Start at Home (/)
    await page.goto('/');
    await expect(page.locator('#hero-live-connected-card')).toBeVisible();
    const startConnectedBtn = page.locator('#btn-start-live-connected-case');
    await expect(startConnectedBtn).toBeVisible();
    await startConnectedBtn.click();

    // 3. Lands on Command Center (/command-center)
    await expect(page).toHaveURL(new RegExp(`/command-center\\?mode=B&run_id=${activeRunId}`));
    await expect(page.locator('#cc-run-id-badge')).toContainText(activeRunId);

    // Click navigation tab link to Equipment Intelligence
    const eiNavLink = page.locator('nav[aria-label="화면 탭"] a[href*="/equipment-intelligence"]');
    await expect(eiNavLink).toBeVisible();
    await eiNavLink.click();

    // 4. Lands on Equipment Intelligence (/equipment-intelligence)
    await expect(page).toHaveURL(new RegExp(`/equipment-intelligence\\?mode=B&run_id=${activeRunId}`));
    await expect(page.locator('#ei-run-id-badge')).toContainText(activeRunId);

    // Click navigation tab link to Wafer Traceability
    const traceNavLink = page.locator('nav[aria-label="화면 탭"] a[href*="/traceability"]');
    await expect(traceNavLink).toBeVisible();
    await traceNavLink.click();

    // 5. Lands on Wafer Traceability (/traceability)
    await expect(page).toHaveURL(new RegExp(`/traceability\\?mode=B&run_id=${activeRunId}`));
    const waferItemW08 = page.locator('#wafer-list-item-W-08');
    await expect(waferItemW08).toBeVisible();
    await waferItemW08.click();

    // Verify candidate exposed status and click CTA to Engineering Workspace
    const goWorkspaceBtn = page.locator('#trace-btn-go-workspace');
    await expect(goWorkspaceBtn).toBeVisible();
    await goWorkspaceBtn.click();

    // 6. Lands on Engineering Workspace (/engineering-workspace)
    await expect(page).toHaveURL(new RegExp(`/engineering-workspace\\?.*run_id=${activeRunId}`));
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // Verify Truth Contract on evidence board
    await expect(page.locator('#evidence-card-EVI-01')).toBeVisible();
    await expect(page.locator('#evidence-card-EVI-02')).toBeVisible();
    await expect(page.locator('#evidence-card-EVI-03')).toBeVisible();
    await expect(page.locator('#evidence-card-EVI-04')).toBeVisible();

    // Fill notes and export report
    await page.locator('#engineering-workspace-notes').fill('Mode B 7화면 연속 완주 검증 노트');
    const exportBtn = page.locator('#ws-btn-export-case-report');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
    await exportBtn.click();
    await expect(page.locator('#ws-export-notice-banner')).toBeVisible();
    await expect(page.locator('#ws-export-notice-banner')).toContainText(activeRunId);

    // Save active case to Casebook
    await page.locator('#ws-btn-save-casebook').click();
    await expect(page.locator('#ws-casebook-notice-banner')).toBeVisible();

    // Switch to Casebook tab
    await page.locator('#ws-tab-casebook').click();
    await expect(page.locator('#ws-casebook-panel')).toBeVisible();
    await expect(page.locator('#ws-casebook-records-list')).toContainText(activeRunId);

    // 7. Verify Historical Server Run Snapshot Viewer (7th screen panel in consecutive flow)
    const historicalRunBtn = page.locator('button[id^="casebook-btn-view-run-"]:has-text("스냅샷 열람")').first();
    await expect(historicalRunBtn).toBeVisible();
    await historicalRunBtn.click();

    const runPanel = page.locator('#ws-historical-run-panel');
    await expect(runPanel).toBeVisible();
    await expect(runPanel).toContainText('HISTORICAL SERVER RUN SNAPSHOT (READ-ONLY)');
    await expect(runPanel).toContainText('물리 센서 계측치 스냅샷 (Evidence Sensors)');

    // Return to active run from historical run panel and confirm safe return to workspace active tab
    const returnActiveBtn = page.locator('#ws-btn-return-active-run');
    await expect(returnActiveBtn).toBeVisible();
    await returnActiveBtn.click();
    await expect(runPanel).not.toBeVisible();
    await expect(page.locator('#ws-tab-active-investigation')).toHaveAttribute('aria-selected', 'true');
  });

  // Test 2: Casebook Save, Reload, and Persistence flow
  test('Investigation Casebook: Save active investigation state to localStorage and reload into workspace', async ({ page }) => {
    const summaryResponse = await page.request.get('http://localhost:8000/api/v1/demo/summary');
    const summary = await summaryResponse.json();
    const activeRunId = summary.active_run_id;

    await page.goto(`/engineering-workspace?mode=B&run_id=${activeRunId}`);
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // 1. Enter custom engineering note
    const testNote = `E2E Casebook 검증 메모 - ${Date.now()}`;
    const notesInput = page.locator('#engineering-workspace-notes');
    await notesInput.fill(testNote);

    // 2. Click Save to Casebook button
    const saveBtn = page.locator('#ws-btn-save-casebook');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify notice banner
    await expect(page.locator('#ws-casebook-notice-banner')).toBeVisible();
    await expect(page.locator('#ws-casebook-notice-banner')).toContainText('Casebook에 성공적으로 저장되었습니다');

    // 3. Switch to Casebook tab
    const casebookTab = page.locator('#ws-tab-casebook');
    await casebookTab.click();
    await expect(page.locator('#ws-casebook-panel')).toBeVisible();

    // Verify the saved record appears in the list
    const recordsList = page.locator('#ws-casebook-records-list');
    await expect(recordsList).toContainText(testNote);
    await expect(recordsList).toContainText(activeRunId);

    // 4. Switch back to Active Investigation tab and change the notes
    await page.locator('#ws-tab-active-investigation').click();
    await notesInput.fill('임시 변경된 다른 메모');

    // 5. Switch to Casebook tab and click reload button
    await casebookTab.click();
    const loadBtn = page.locator(`button[id^="casebook-btn-load-"]`).first();
    await expect(loadBtn).toBeVisible();
    await loadBtn.click();

    // Verify workspace active tab is restored and note is restored
    await expect(page.locator('#ws-tab-active-investigation')).toHaveAttribute('aria-selected', 'true');
    await expect(notesInput).toHaveValue(testNote);
  });

  // Test 3: Counterexample - Run Lineage Mismatch (409 Fail-Closed)
  test('Counterexample: Run Lineage Mismatch between requested run_id and active_run_id fails closed (409)', async ({ page }) => {
    const mismatchedRunId = 'RUN-MISMATCH-999';
    await page.goto(`/engineering-workspace?mode=B&run_id=${mismatchedRunId}`);

    // Verify 409 error banner
    const errorBanner = page.locator('#ws-mode-b-error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('공정 Run 불일치 (Run Lineage Mismatch)');
    await expect(errorBanner).toContainText(mismatchedRunId);

    // Verify export button is disabled
    const exportBtn = page.locator('#ws-btn-export-case-report');
    await expect(exportBtn).toBeDisabled();
  });

  // Test 4: Counterexample - Disconnected or Unsupported Standby Alert (Fail-Closed)
  test('Counterexample: Standby alert isolates data, disables report export, and recovers to active alert', async ({ page }) => {
    await page.goto('/engineering-workspace?mode=B&alert=AL-STANDBY-001');

    // Verify unsupported alert lock panel
    await expect(page.locator('#ws-unsupported-lock-panel')).toBeVisible();
    await expect(page.locator('body')).toContainText('엔지니어링 보드 비활성화 및 데이터 격리');

    // Export button must be disabled
    const exportBtn = page.locator('#ws-btn-export-case-report');
    await expect(exportBtn).toBeDisabled();

    // Active alert recovery button must be visible
    const recoverBtn = page.locator('#ws-btn-switch-active-alert-lock');
    await expect(recoverBtn).toBeVisible();

    // Click to recover
    await recoverBtn.click();

    // Verify restored to unlocked active alert
    await expect(page.locator('#ws-unsupported-lock-panel')).not.toBeVisible();
    await expect(exportBtn).toBeEnabled();
  });

  // Test 5: BUILD-14 Historical Casebook Record Isolation (Read-only modal, active editor preservation)
  test('BUILD-14 Cross-Run Isolation: Historical Casebook record opens in read-only modal without contaminating active editor', async ({ page }) => {
    const summaryResponse = await page.request.get('http://localhost:8000/api/v1/demo/summary');
    const summary = await summaryResponse.json();
    const activeRunId = summary.active_run_id;

    await page.goto(`/engineering-workspace?mode=B&run_id=${activeRunId}`);
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // 1. Set active editor note
    const activeNote = '현재 활성 Run의 최신 엔지니어링 메모';
    await page.locator('#engineering-workspace-notes').fill(activeNote);

    // 2. Inject an older historical record with different runId into localStorage
    const oldRecord = {
      schemaVersion: 1,
      id: 'CASE-HISTORICAL-999',
      savedAtUtc: new Date().toISOString(),
      runId: 'RUN-HISTORICAL-OLD',
      alertId: 'AL-HISTORICAL-OLD',
      mode: 'B',
      lotId: 'LOT-HISTORICAL-OLD',
      equipmentId: 'ETCH-01',
      chamberId: 'CH-A',
      hypotheses: [
        {
          id: 'HYPO-01',
          title: '과거 챔버 리크 가설',
          domain: 'CHAMBER',
          status: 'SUPPORTED_FOR_REVIEW',
          statusLabel: '검토 지지',
          engineeringRationale: '과거 런 이력 근거',
          linkedEvidenceIds: ['EVI-01'],
        },
      ],
      actions: [
        {
          id: 'ACT-01',
          title: '과거 O-링 교체 조치',
          assigneeRole: '장비 엔지니어',
          targetSystem: 'CH-A',
          completed: true,
          priority: 'HIGH',
          detail: '과거 이행 완료',
        },
      ],
      userNotes: '과거 Run 완료 후 작성된 아카이브 메모입니다.',
    };

    await page.evaluate((rec) => {
      window.localStorage.setItem('fab_one_casebook_records_v1', JSON.stringify([rec]));
    }, oldRecord);

    // 3. Navigate to Casebook tab
    await page.locator('#ws-tab-casebook').click();
    await expect(page.locator('#ws-casebook-panel')).toBeVisible();

    // 4. Verify the load button has label '상세 열람 (Read-Only) 👁'
    const viewBtn = page.locator('#casebook-btn-load-CASE-HISTORICAL-999');
    await expect(viewBtn).toBeVisible();
    await expect(viewBtn).toContainText('상세 열람 (Read-Only) 👁');

    // 5. Click to open historical modal
    await viewBtn.click();

    const histModal = page.locator('#ws-historical-case-modal');
    await expect(histModal).toBeVisible();
    await expect(histModal).toContainText('과거 조사 사례 열람 (Run: RUN-HISTORICAL-OLD)');
    await expect(histModal).toContainText('데이터 격리 안전 보호');
    await expect(histModal).toContainText('과거 Run 완료 후 작성된 아카이브 메모입니다.');

    // 6. Click return to active workspace
    const returnBtn = page.locator('#ws-btn-return-active-workspace');
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // 7. Verify modal closed, active tab returned, and active editor notes are preserved
    await expect(histModal).not.toBeVisible();
    await expect(page.locator('#ws-tab-active-investigation')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#engineering-workspace-notes')).toHaveValue(activeNote);
  });

  // Test 6: BUILD-14 Historical Server Run Snapshot Viewer (GET /api/v1/demo/runs/{run_id})
  test('BUILD-14 Historical Server Run: Viewing previous run fetches GET /api/v1/demo/runs/{run_id} and opens read-only snapshot panel without 409 mismatch error', async ({ page }) => {
    // 1. Create a 2nd run to ensure the 1st run becomes historical
    const createRunRes = await page.request.post('http://localhost:8000/api/v1/demo/runs', {
      data: {
        seed: 9999,
        scenario_id: 'ETH-SYN-01',
        equipment_id: 'ETCH-02',
        chamber_id: 'CH-B',
      },
    });
    expect(createRunRes.ok()).toBeTruthy();

    const summaryResponse = await page.request.get('http://localhost:8000/api/v1/demo/summary');
    const summary = await summaryResponse.json();
    const activeRunId = summary.active_run_id;

    // 2. Go to workspace with active run
    await page.goto(`/engineering-workspace?mode=B&run_id=${activeRunId}`);
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // 3. Switch to Casebook tab
    await page.locator('#ws-tab-casebook').click();
    await expect(page.locator('#ws-casebook-panel')).toBeVisible();

    // 4. Find historical run in server runs list
    const historicalRunBtn = page.locator('button[id^="casebook-btn-view-run-"]:has-text("스냅샷 열람")').first();
    await expect(historicalRunBtn).toBeVisible();
    await historicalRunBtn.click();

    // 5. Verify Historical Run Panel opened
    const runPanel = page.locator('#ws-historical-run-panel');
    await expect(runPanel).toBeVisible();
    await expect(runPanel).toContainText('HISTORICAL SERVER RUN SNAPSHOT (READ-ONLY)');
    await expect(runPanel).toContainText('물리 센서 계측치 스냅샷 (Evidence Sensors)');

    // Verify no 409 error banner is visible
    await expect(page.locator('#ws-mode-b-error-banner')).not.toBeVisible();

    // 6. Return to active run
    const returnActiveBtn = page.locator('#ws-btn-return-active-run');
    await expect(returnActiveBtn).toBeVisible();
    await returnActiveBtn.click();

    await expect(runPanel).not.toBeVisible();
    await expect(page.locator('#ws-tab-active-investigation')).toHaveAttribute('aria-selected', 'true');
  });

  // Test 7: BUILD-15 Counterexample - Same runId but disparate alertId/sessionId/dataOrigin is isolated in read-only modal
  test('BUILD-15 Counterexample: Same runId but disparate alertId/sessionId record opens in read-only modal without contaminating editor', async ({ page }) => {
    const summaryResponse = await page.request.get('http://localhost:8000/api/v1/demo/summary');
    const summary = await summaryResponse.json();
    const activeRunId = summary.active_run_id;

    await page.goto(`/engineering-workspace?mode=B&run_id=${activeRunId}`);
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // 1. Set current active editor note
    const activeNote = '현재 활성 알람 AL-DEMO-015의 유효 엔지니어링 메모';
    await page.locator('#engineering-workspace-notes').fill(activeNote);

    // 2. Inject records:
    // (a) Same runId, but DIFFERENT alertId
    // (b) Same runId, SAME alertId, but MISSING sessionId
    // (c) Same runId, SAME alertId, same sessionId, but DISPARATE dataOrigin ('mock_catalog')
    const records = [
      {
        schemaVersion: 1,
        id: 'CASE-SAME-RUN-WRONG-ALERT-777',
        savedAtUtc: new Date().toISOString(),
        runId: activeRunId,
        alertId: 'AL-DIFFERENT-ALERT-999',
        sessionId: 'SESS-DISPARATE-001',
        mode: 'B',
        dataOrigin: 'live_api',
        seed: 20261016,
        status: 'REVIEWED',
        lotId: 'LOT-DEMO-815',
        equipmentId: 'ETCH-02',
        chamberId: 'CH-B',
        hypotheses: [],
        actions: [],
        userNotes: '이 메모는 동일 런이지만 다른 알람(AL-DIFFERENT-ALERT-999)에서 작성된 이력입니다.',
        reportExported: false,
      },
      {
        schemaVersion: 1,
        id: 'CASE-SAME-RUN-MISSING-SESSION-888',
        savedAtUtc: new Date().toISOString(),
        runId: activeRunId,
        alertId: 'AL-DEMO-015',
        // sessionId is deliberately missing / undefined
        mode: 'B',
        dataOrigin: 'live_api',
        seed: 20261016,
        status: 'REVIEWED',
        lotId: 'LOT-DEMO-815',
        equipmentId: 'ETCH-02',
        chamberId: 'CH-B',
        hypotheses: [],
        actions: [],
        userNotes: '이 메모는 동일 런/동일 알람이지만 sessionId가 누락된 과거 비호환 레코드입니다.',
        reportExported: false,
      },
      {
        schemaVersion: 1,
        id: 'CASE-SAME-RUN-WRONG-ORIGIN-999',
        savedAtUtc: new Date().toISOString(),
        runId: activeRunId,
        alertId: 'AL-DEMO-015',
        sessionId: 'SES-SYN-01',
        mode: 'B',
        dataOrigin: 'mock_catalog', // disparate origin
        seed: 20261016,
        status: 'REVIEWED',
        lotId: 'LOT-DEMO-815',
        equipmentId: 'ETCH-02',
        chamberId: 'CH-B',
        hypotheses: [],
        actions: [],
        userNotes: '이 메모는 서로 다른 데이터 출처(mock_catalog)에서 생성된 레코드입니다.',
        reportExported: false,
      },
    ];

    await page.evaluate((recs) => {
      window.localStorage.setItem('fab_one_casebook_records_v1', JSON.stringify(recs));
    }, records);

    // 3. Navigate to Casebook tab
    await page.locator('#ws-tab-casebook').click();
    await expect(page.locator('#ws-casebook-panel')).toBeVisible();

    // 4. Case (a): Different alertId -> verify read-only modal opens and editor unchanged
    const viewBtnAlert = page.locator('#casebook-btn-load-CASE-SAME-RUN-WRONG-ALERT-777');
    await expect(viewBtnAlert).toBeVisible();
    await expect(viewBtnAlert).toContainText('상세 열람 (Read-Only) 👁');
    await viewBtnAlert.click();

    const histModal = page.locator('#ws-historical-case-modal');
    await expect(histModal).toBeVisible();
    await expect(histModal).toContainText('데이터 격리 안전 보호');
    await expect(histModal).toContainText('AL-DIFFERENT-ALERT-999');
    await page.locator('#ws-btn-return-active-workspace').click();
    await expect(histModal).not.toBeVisible();
    await expect(page.locator('#engineering-workspace-notes')).toHaveValue(activeNote);

    // 5. Case (b): Missing sessionId on same runId/alertId -> must also show read-only button
    await page.locator('#ws-tab-casebook').click();
    const viewBtnSession = page.locator('#casebook-btn-load-CASE-SAME-RUN-MISSING-SESSION-888');
    await expect(viewBtnSession).toBeVisible();
    await expect(viewBtnSession).toContainText('상세 열람 (Read-Only) 👁');
    await viewBtnSession.click();

    await expect(histModal).toBeVisible();
    await expect(histModal).toContainText('데이터 격리 안전 보호');
    await page.locator('#ws-btn-return-active-workspace').click();
    await expect(histModal).not.toBeVisible();
    await expect(page.locator('#engineering-workspace-notes')).toHaveValue(activeNote);

    // 6. Case (c): Disparate dataOrigin -> must also show read-only button
    await page.locator('#ws-tab-casebook').click();
    const viewBtnOrigin = page.locator('#casebook-btn-load-CASE-SAME-RUN-WRONG-ORIGIN-999');
    await expect(viewBtnOrigin).toBeVisible();
    await expect(viewBtnOrigin).toContainText('상세 열람 (Read-Only) 👁');
    await viewBtnOrigin.click();

    await expect(histModal).toBeVisible();
    await expect(histModal).toContainText('데이터 격리 안전 보호');
    await page.locator('#ws-btn-return-active-workspace').click();
    await expect(histModal).not.toBeVisible();
    await expect(page.locator('#engineering-workspace-notes')).toHaveValue(activeNote);
  });

  // Test 8: BUILD-15 Counterexample - Strict v1 Schema Import Rejection via Real UI File Input (Fail-Closed)
  test('BUILD-15 Counterexample: Strict v1 schema import rejects corrupted and unversioned backups without contaminating storage', async ({ page }) => {
    await page.goto('/engineering-workspace?mode=B');
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // 1. Switch to Casebook tab
    await page.locator('#ws-tab-casebook').click();
    await expect(page.locator('#ws-casebook-panel')).toBeVisible();

    // 2. Real Path 8a: Import corrupted JSON lacking schemaVersion via UI file input
    const corruptedJson = JSON.stringify([
      {
        id: 'CASE-CORRUPTED-NO-VERSION-001',
        runId: 'RUN-CORRUPT',
        alertId: 'AL-CORRUPT',
        mode: 'B',
        lotId: 'LOT-CORRUPT',
        equipmentId: 'ETCH-01',
        chamberId: 'CH-A',
        savedAtUtc: new Date().toISOString(),
        hypotheses: [],
        actions: [],
        userNotes: '오염된 레코드',
      },
    ]);

    await page.setInputFiles('#ws-input-import-casebook-json', {
      name: 'corrupted-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(corruptedJson),
    });

    // Verify error notification banner appears
    const noticeBanner = page.locator('#ws-casebook-notice-banner');
    await expect(noticeBanner).toBeVisible();
    await expect(noticeBanner).toContainText('가져오기 실패');

    // Verify storage and list were not contaminated
    await expect(page.locator('#casebook-item-CASE-CORRUPTED-NO-VERSION-001')).not.toBeVisible();

    // 3. Real Path 8b: Import oversized JSON exceeding 500KB limit via UI file input
    const hugePayload = JSON.stringify([
      {
        schemaVersion: 1,
        id: 'CASE-OVERSIZED-500K-001',
        runId: 'RUN-OVERSIZED',
        alertId: 'AL-OVERSIZED',
        sessionId: 'SESS-OVERSIZED',
        mode: 'B',
        dataOrigin: 'live_api',
        seed: 20261016,
        status: 'DRAFT',
        lotId: 'LOT-OVERSIZED',
        equipmentId: 'ETCH-01',
        chamberId: 'CH-A',
        savedAtUtc: new Date().toISOString(),
        hypotheses: [],
        actions: [],
        userNotes: 'X'.repeat(550000), // exceeds 500KB limit
      },
    ]);

    await page.setInputFiles('#ws-input-import-casebook-json', {
      name: 'oversized-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(hugePayload),
    });

    await expect(noticeBanner).toBeVisible();
    await expect(noticeBanner).toContainText('PAYLOAD_TOO_LARGE');
    await expect(page.locator('#casebook-item-CASE-OVERSIZED-500K-001')).not.toBeVisible();

    // 4. Real Path 8c: Import JSON with invalid nested hypotheses status enum via UI file input
    const invalidNestedJson = JSON.stringify([
      {
        schemaVersion: 1,
        id: 'CASE-INVALID-NESTED-001',
        runId: 'RUN-INVALID-NESTED',
        alertId: 'AL-INVALID-NESTED',
        sessionId: 'SESS-001',
        mode: 'B',
        dataOrigin: 'live_api',
        seed: 20261016,
        status: 'DRAFT',
        lotId: 'LOT-001',
        equipmentId: 'ETCH-01',
        chamberId: 'CH-A',
        savedAtUtc: new Date().toISOString(),
        hypotheses: [
          {
            id: 'HYPO-INVALID',
            title: '잘못된 가설 상태값',
            domain: 'CHAMBER',
            status: 'INVALID_ENUM_VALUE_DO_NOT_COMMIT',
            statusLabel: '이상상태',
            engineeringRationale: '무효한 가설 enum 테스트',
            linkedEvidenceIds: [],
          },
        ],
        actions: [],
        userNotes: '유효하지 않은 중첩 가설을 가진 레코드',
      },
    ]);

    await page.setInputFiles('#ws-input-import-casebook-json', {
      name: 'invalid-nested.json',
      mimeType: 'application/json',
      buffer: Buffer.from(invalidNestedJson),
    });

    await expect(noticeBanner).toBeVisible();
    await expect(noticeBanner).toContainText('가져오기 실패');
    await expect(page.locator('#casebook-item-CASE-INVALID-NESTED-001')).not.toBeVisible();
  });
});
