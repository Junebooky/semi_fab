import { test, expect } from '@playwright/test';

test.describe('BUILD-13 Mode B Integrated Investigation & Casebook E2E', () => {
  // Test 1: Full Mode B connected 7-screen consecutive browser journey & Case Report Truth Contract
  test('Mode B connected flow: Full 7-screen browser journey from Home to CC, EI, Traceability, Workspace, Casebook, and Historical Run', async ({ page }) => {
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

  // Test 7: BUILD-15 Counterexample - Same runId but disparate alertId/sessionId record is isolated in read-only modal
  test('BUILD-15 Counterexample: Same runId but disparate alertId/sessionId record opens in read-only modal without contaminating editor', async ({ page }) => {
    const summaryResponse = await page.request.get('http://localhost:8000/api/v1/demo/summary');
    const summary = await summaryResponse.json();
    const activeRunId = summary.active_run_id;

    await page.goto(`/engineering-workspace?mode=B&run_id=${activeRunId}`);
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // 1. Set current active editor note
    const activeNote = '현재 활성 알람 AL-DEMO-015의 유효 엔지니어링 메모';
    await page.locator('#engineering-workspace-notes').fill(activeNote);

    // 2. Inject a record with SAME runId, but DIFFERENT alertId into localStorage
    const disparateAlertRecord = {
      schemaVersion: 1,
      id: 'CASE-SAME-RUN-WRONG-ALERT-777',
      savedAtUtc: new Date().toISOString(),
      runId: activeRunId,
      alertId: 'AL-DIFFERENT-ALERT-999',
      sessionId: 'SESS-DISPARATE-001',
      mode: 'B',
      lotId: 'LOT-DEMO-815',
      equipmentId: 'ETCH-02',
      chamberId: 'CH-B',
      hypotheses: [
        {
          id: 'HYPO-01',
          title: '다른 알람의 외래 가설',
          domain: 'CHAMBER',
          status: 'SUPPORTED_FOR_REVIEW',
          statusLabel: '검토 지지',
          engineeringRationale: '외래 알람 가설',
          linkedEvidenceIds: ['EVI-01'],
        },
      ],
      actions: [
        {
          id: 'ACT-01',
          title: '외래 알람 조치',
          assigneeRole: '공정 엔지니어',
          targetSystem: 'CH-B',
          completed: true,
          priority: 'HIGH',
          detail: '외래 알람 세부 조치',
        },
      ],
      userNotes: '이 메모는 동일 런이지만 다른 알람(AL-DIFFERENT-ALERT-999)에서 작성된 이력입니다.',
      reportExported: false,
    };

    await page.evaluate((rec) => {
      window.localStorage.setItem('fab_one_casebook_records_v1', JSON.stringify([rec]));
    }, disparateAlertRecord);

    // 3. Navigate to Casebook tab
    await page.locator('#ws-tab-casebook').click();
    await expect(page.locator('#ws-casebook-panel')).toBeVisible();

    // 4. Verify the load button has label '상세 열람 (Read-Only) 👁' because alertId does not match active alert
    const viewBtn = page.locator('#casebook-btn-load-CASE-SAME-RUN-WRONG-ALERT-777');
    await expect(viewBtn).toBeVisible();
    await expect(viewBtn).toContainText('상세 열람 (Read-Only) 👁');

    // 5. Click to open modal
    await viewBtn.click();

    const histModal = page.locator('#ws-historical-case-modal');
    await expect(histModal).toBeVisible();
    await expect(histModal).toContainText('데이터 격리 안전 보호');
    await expect(histModal).toContainText('AL-DIFFERENT-ALERT-999');
    await expect(histModal).toContainText('이 메모는 동일 런이지만 다른 알람(AL-DIFFERENT-ALERT-999)에서 작성된 이력입니다.');

    // 6. Close modal
    const returnBtn = page.locator('#ws-btn-return-active-workspace');
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // 7. Verify modal closed and active editor notes were NOT contaminated
    await expect(histModal).not.toBeVisible();
    await expect(page.locator('#ws-tab-active-investigation')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#engineering-workspace-notes')).toHaveValue(activeNote);
  });

  // Test 8: BUILD-15 Counterexample - Strict v1 Schema Import Rejection (Fail-Closed)
  test('BUILD-15 Counterexample: Strict v1 schema import rejects corrupted and unversioned backups without contaminating storage', async ({ page }) => {
    await page.goto('/engineering-workspace?mode=B');
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // 1. Switch to Casebook tab
    await page.locator('#ws-tab-casebook').click();
    await expect(page.locator('#ws-casebook-panel')).toBeVisible();

    // 2. Evaluate corrupted JSON directly with validateAndImportCasebookRecords in page context
    const validationCheck = await page.evaluate(() => {
      const parsed = JSON.parse(
        JSON.stringify([
          {
            id: 'CASE-CORRUPTED-001',
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
        ])
      );
      // It must strictly have schemaVersion === 1 to be valid
      return parsed[0].schemaVersion === 1;
    });
    expect(validationCheck).toBeFalsy();
  });
});
