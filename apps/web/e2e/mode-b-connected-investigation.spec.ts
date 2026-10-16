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
});
