import { test, expect } from '@playwright/test';

test.describe('BUILD-13 Mode B Integrated Investigation & Casebook E2E', () => {
  // Test 1: Full Mode B connected flow & Case Report Truth Contract
  test('Mode B connected flow: Summary-first discovery, live investigation, Truth Contract, and Case Report export', async ({ page }) => {
    // 1. Verify backend API is reachable and fetch active run summary
    const summaryResponse = await page.request.get('http://localhost:8000/api/v1/demo/summary');
    expect(summaryResponse.ok()).toBeTruthy();
    const summary = await summaryResponse.json();
    const activeRunId = summary.active_run_id;
    expect(activeRunId).toBeTruthy();

    // 2. Navigate to Command Center in Mode B
    await page.goto(`/command-center?mode=B&run_id=${activeRunId}`);
    await expect(page.locator('#cc-run-id-badge')).toContainText(activeRunId);

    // Click Continue Investigation button to go to Workspace
    const goWorkspaceBtn = page.locator('#cc-btn-go-workspace');
    await expect(goWorkspaceBtn).toBeVisible();
    await goWorkspaceBtn.click();

    // 3. In Engineering Workspace
    await expect(page).toHaveURL(new RegExp(`/engineering-workspace\\?.*run_id=${activeRunId}`));
    await expect(page.locator('#ws-mode-b-badge')).toBeVisible();

    // Verify Truth Contract on evidence board
    // Physical sensor evidences exist, but FDC alert and wafer exposure are separate cards
    await expect(page.locator('#evidence-card-EVI-01')).toBeVisible();
    await expect(page.locator('#evidence-card-EVI-02')).toBeVisible();
    await expect(page.locator('#evidence-card-EVI-03')).toBeVisible(); // Alert record
    await expect(page.locator('#evidence-card-EVI-04')).toBeVisible(); // Wafer exposure

    // Check Case Report Export button is enabled and export works
    const exportBtn = page.locator('#ws-btn-export-case-report');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();

    // Setup download event listener (or verify export notice banner)
    const downloadPromise = page.waitForEvent('download').catch(() => null);
    await exportBtn.click();

    // Verify export notice banner is displayed
    await expect(page.locator('#ws-export-notice-banner')).toBeVisible();
    await expect(page.locator('#ws-export-notice-banner')).toContainText(activeRunId);
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
});
