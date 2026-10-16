import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('BUILD-12 Connected Investigation & Case Report Export E2E Tests', () => {
  test('Case Report Export: Generates sanitized markdown with full investigation decision record', async ({ page }) => {
    // 1. Navigate to Engineering Workspace
    await page.goto('/engineering-workspace?seed=20261015');
    await expect(page).toHaveTitle(/FAB ONE/i);

    // Verify investigation board and export button
    await expect(page.locator('#ws-investigation-board')).toBeVisible();
    const exportBtn = page.locator('#ws-btn-export-case-report');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();

    // 2. Modify in-memory state: cycle hypothesis, check action, write notes
    const cycleBtn = page.locator('#btn-cycle-status-HYPO-01');
    await cycleBtn.click();
    await expect(page.locator('#status-badge-HYPO-01')).toContainText('SUPPORTED_FOR_REVIEW');

    const actionChk = page.locator('#chk-ACTION-01');
    await actionChk.click();
    await expect(actionChk).toBeChecked();

    const notesInput = page.locator('#engineering-workspace-notes');
    await notesInput.fill('BUILD-12 E2E verified in-memory engineering notes');

    // 3. Trigger Case Report Download
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    // Verify filename format: case-report-RUN-DEMO-015-YYYYMMDD.md
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^case-report-RUN-DEMO-015-\d{8}\.md$/);

    // Save and inspect download content
    const filePath = await download.path();
    expect(filePath).not.toBeNull();
    if (filePath) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('# FAB ONE Engineering Case Report');
      expect(content).toContain('Excursion ≠ Defect');
      expect(content).toContain('MISSING ≠ 0');
      expect(content).toContain('RUN-DEMO-015');
      expect(content).toContain('AL-DEMO-015');
      expect(content).toContain('SUPPORTED_FOR_REVIEW');
      expect(content).toContain('[x] **ACTION-01**');
      expect(content).toContain('BUILD-12 E2E verified in-memory engineering notes');
      expect(content).toContain('In-memory Volatile');
    }

    // Verify export success banner in UI
    const noticeBanner = page.locator('#ws-export-notice-banner');
    await expect(noticeBanner).toBeVisible();
    await expect(noticeBanner).toContainText('성공적으로 다운로드되었습니다');
  });

  test('Counterexample: Standby alert locks Engineering Case Report export and boards', async ({ page }) => {
    // Navigate with unsupported standby alert AL-STANDBY-001
    await page.goto('/engineering-workspace?alert=AL-STANDBY-001&seed=20261015');

    // Lock panel must be displayed
    const lockPanel = page.locator('#ws-unsupported-lock-panel');
    await expect(lockPanel).toBeVisible();

    // Export button must be disabled/locked
    const exportBtn = page.locator('#ws-btn-export-case-report');
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeDisabled();
    await expect(exportBtn).toHaveAttribute('aria-disabled', 'true');
  });

  test('Cross-Screen Deep Link: Command Center to Engineering Workspace', async ({ page }) => {
    // Navigate to Command Center
    await page.goto('/command-center?seed=20261015');
    await expect(page.locator('#cc-alarm-item-AL-DEMO-015')).toBeVisible();

    // Click "엔지니어링 워크스페이스에서 사건 분석 ↗"
    const ctaBtn = page.locator('#cc-btn-go-workspace');
    await expect(ctaBtn).toBeVisible();
    await ctaBtn.click();

    // Verify landing on engineering-workspace with correct alert
    await expect(page).toHaveURL(/\/engineering-workspace\?alert=AL-DEMO-015/);
    await expect(page.locator('#ws-investigation-board')).toBeVisible();
  });

  test('Cross-Screen Deep Link: Equipment Intelligence to Engineering Workspace', async ({ page }) => {
    // Navigate to Equipment Intelligence
    await page.goto('/equipment-intelligence?sensor=RELATIVE_SIGNAL&seed=20261015');
    await expect(page.locator('#ei-tab-RELATIVE_SIGNAL')).toBeVisible();

    // Click "엔지니어링 워크스페이스에서 사건 분석 ↗"
    const ctaBtn = page.locator('#ei-btn-go-workspace');
    await expect(ctaBtn).toBeVisible();
    await ctaBtn.click();

    // Verify landing on engineering-workspace with correct alert
    await expect(page).toHaveURL(/\/engineering-workspace\?alert=AL-DEMO-015/);
    await expect(page.locator('#ws-investigation-board')).toBeVisible();
  });

  test('Cross-Screen Deep Link: Wafer Traceability to Engineering Workspace', async ({ page }) => {
    // Navigate to Traceability for candidate wafer W-08
    await page.goto('/traceability?wafer=W-08&seed=20261015');
    await expect(page.locator('#wafer-list-item-W-08')).toBeVisible();

    // Click "엔지니어링 워크스페이스에서 사건 분석 ↗"
    const ctaBtn = page.locator('#trace-btn-go-workspace');
    await expect(ctaBtn).toBeVisible();
    await ctaBtn.click();

    // Verify landing on engineering-workspace with correct alert
    await expect(page).toHaveURL(/\/engineering-workspace\?alert=AL-DEMO-015/);
    await expect(page.locator('#ws-investigation-board')).toBeVisible();
  });
});
