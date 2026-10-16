import { test, expect } from '@playwright/test';
import { getModeAT7ExcursionValues } from '../src/components/guided-demo/guided-demo-contract';

test.describe('BUILD-11 Guided Demo E2E Browser Smoke & Invariants', () => {
  test('Complete 8-step Guided Tour user journey with target screen navigation and context return', async ({ page }) => {
    // 1. Start from Homepage (/)
    await page.goto('/');
    await expect(page).toHaveTitle(/FAB ONE/i);

    // Verify Guided Tour CTA button on home
    const startTourBtn = page.locator('#btn-start-guided-tour');
    await expect(startTourBtn).toBeVisible();
    await startTourBtn.click();

    // 2. Step 1 (INTRO)
    await expect(page).toHaveURL(/\/demo-tour\?step=INTRO&seed=20261015/);
    await expect(page.locator('#active-step-showcase')).toBeVisible();
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'INTRO');
    await expect(page.locator('#tour-progress-bar')).toBeVisible();

    // 3. Step 2 (SIMULATE)
    await page.locator('#tour-btn-next').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=SIMULATE&seed=20261015/);
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'SIMULATE');
    await expect(page.locator('#tour-btn-open-target')).toBeVisible();

    // Click to open target screen (FAB Simulation)
    await page.locator('#tour-btn-open-target').click();
    await expect(page).toHaveURL(/\/fab-simulation\?seed=20261015&tourStep=SIMULATE/);
    await expect(page.locator('#tour-return-banner')).toBeVisible();
    await expect(page.locator('#btn-return-to-tour')).toBeVisible();

    // Return to tour
    await page.locator('#btn-return-to-tour').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=SIMULATE&seed=20261015/);

    // 4. Step 3 (EXCURSION)
    await page.locator('#tour-btn-next').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=EXCURSION&seed=20261015/);
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'EXCURSION');
    // Verify benchmark excursion scenario targets (~80.0, ~168.5, ~1820) and UCL 65.0
    await expect(page.locator('#active-step-showcase')).toContainText('80.0');
    await expect(page.locator('#active-step-showcase')).toContainText('168.5');
    await expect(page.locator('#active-step-showcase')).toContainText('1820');
    await expect(page.locator('#active-step-showcase')).toContainText('65.0');

    // 5. Step 4 (ALARM)
    await page.locator('#tour-btn-next').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=ALARM&seed=20261015/);
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'ALARM');
    await page.locator('#tour-btn-open-target').click();
    await expect(page).toHaveURL(/\/command-center\?seed=20261015&alert=AL-DEMO-015&tourStep=ALARM/);
    await expect(page.locator('#tour-return-banner')).toBeVisible();
    await page.locator('#btn-return-to-tour').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=ALARM&seed=20261015/);

    // 6. Step 5 (SENSOR)
    await page.locator('#tour-btn-next').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=SENSOR&seed=20261015/);
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'SENSOR');
    await page.locator('#tour-btn-open-target').click();
    await expect(page).toHaveURL(/\/equipment-intelligence\?sensor=RELATIVE_SIGNAL&seed=20261015&tourStep=SENSOR/);
    await expect(page.locator('#tour-return-banner')).toBeVisible();
    await page.locator('#btn-return-to-tour').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=SENSOR&seed=20261015/);

    // 7. Step 6 (TRACE)
    await page.locator('#tour-btn-next').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=TRACE&seed=20261015/);
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'TRACE');
    await page.locator('#tour-btn-open-target').click();
    await expect(page).toHaveURL(/\/traceability\?wafer=W-08&seed=20261015&tourStep=TRACE/);
    await expect(page.locator('#tour-return-banner')).toBeVisible();
    await page.locator('#btn-return-to-tour').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=TRACE&seed=20261015/);

    // 8. Step 7 (WORKSPACE)
    await page.locator('#tour-btn-next').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=WORKSPACE&seed=20261015/);
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'WORKSPACE');
    await page.locator('#tour-btn-open-target').click();
    await expect(page).toHaveURL(/\/engineering-workspace\?seed=20261015&alert=AL-DEMO-015&tourStep=WORKSPACE/);
    await expect(page.locator('#tour-return-banner')).toBeVisible();
    await expect(page.locator('#ws-investigation-board')).toBeVisible();

    // Test interactive hypothesis status cycle button (HYPO-01) unconditionally
    const cycleBtn = page.locator('#btn-cycle-status-HYPO-01');
    const statusBadge = page.locator('#status-badge-HYPO-01');
    await expect(cycleBtn).toBeVisible();
    await expect(statusBadge).toContainText('UNVERIFIED');
    await cycleBtn.click();
    await expect(statusBadge).toContainText('SUPPORTED_FOR_REVIEW');

    // Test interactive action item checkbox (ACTION-01) unconditionally
    const actionChk = page.locator('#chk-ACTION-01');
    await expect(actionChk).toBeVisible();
    await expect(actionChk).not.toBeChecked();
    await actionChk.click();
    await expect(actionChk).toBeChecked();

    await page.locator('#btn-return-to-tour').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=WORKSPACE&seed=20261015/);

    // 9. Step 8 (FINISH)
    await page.locator('#tour-btn-next').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=FINISH&seed=20261015/);
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'FINISH');
    await expect(page.locator('#tour-completion-summary-panel')).toBeVisible();

    // Verify 5-point engineering judgment summary
    await expect(page.locator('#tour-completion-summary-panel')).toContainText('1. FDC 실시간 경보 감지');
    await expect(page.locator('#tour-completion-summary-panel')).toContainText('2. 센서 계측 근거');
    await expect(page.locator('#tour-completion-summary-panel')).toContainText('3. 웨이퍼 단위 이력 추적성 격리');
    await expect(page.locator('#tour-completion-summary-panel')).toContainText('4. 엔지니어링 백보드 기반 가설 검증');
    await expect(page.locator('#tour-completion-summary-panel')).toContainText('5. 반도체 공학 도메인 지식');

    // Backward navigation check
    await page.locator('#tour-btn-prev').click();
    await expect(page).toHaveURL(/\/demo-tour\?step=WORKSPACE&seed=20261015/);
  });

  test('Counterexample 1: Seed 20261016 preservation across target screen navigation and tour return', async ({ page }) => {
    // Navigate with non-default seed 20261016 to TRACE step
    await page.goto('/demo-tour?step=TRACE&seed=20261016');
    await expect(page.locator('#active-step-showcase')).toBeVisible();
    await expect(page.locator('#active-step-showcase')).toHaveAttribute('data-step-id', 'TRACE');

    // Target link must retain seed=20261016
    const targetLink = page.locator('#tour-btn-open-target');
    await expect(targetLink).toBeVisible();
    await targetLink.click();

    // Verify target screen URL retains seed=20261016
    await expect(page).toHaveURL(/\/traceability\?wafer=W-08&seed=20261016&tourStep=TRACE/);

    // Verify tour return banner retains seed=20261016
    const returnBtn = page.locator('#btn-return-to-tour');
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // Verify back to demo-tour with seed=20261016 and step=TRACE
    await expect(page).toHaveURL(/\/demo-tour\?step=TRACE&seed=20261016/);
  });

  test('Counterexample 2: Unsupported alert isolation lock in Engineering Workspace with recovery action', async ({ page }) => {
    // Navigate to engineering workspace with unsupported standby alert AL-STANDBY-001
    await page.goto('/engineering-workspace?alert=AL-STANDBY-001&seed=20261015');

    // Unsupported alert lock panel must be displayed
    const lockPanel = page.locator('#ws-unsupported-lock-panel');
    await expect(lockPanel).toBeVisible();
    await expect(lockPanel).toContainText('엔지니어링 보드 비활성화 및 데이터 격리');
    await expect(lockPanel).toContainText('AL-STANDBY-001');

    // Investigation board must be hidden/not rendered
    const investigationBoard = page.locator('#ws-investigation-board');
    await expect(investigationBoard).toHaveCount(0);

    // Click recovery button to switch to active alert
    const switchBtn = page.locator('#ws-btn-switch-active-alert-lock');
    await expect(switchBtn).toBeVisible();
    await switchBtn.click();

    // Lock panel disappears and active board is restored
    await expect(lockPanel).toHaveCount(0);
    await expect(page.locator('#ws-investigation-board')).toBeVisible();
    await expect(page).toHaveURL(/\/engineering-workspace\?alert=AL-DEMO-015&seed=20261015/);
  });

  test('Domain Invariants: Disclaimer presence and T7 telemetry consistency across screens', async ({ page }) => {
    const seed = 20261015;
    const expectedT7 = getModeAT7ExcursionValues(seed);

    // 1. Fab Simulation Domain Disclaimers and T7 Excursion Telemetry
    await page.goto(`/fab-simulation?seed=${seed}`);
    await expect(page.locator('body')).toContainText('Excursion ≠ Defect');
    await expect(page.locator('body')).toContainText('MISSING ≠ 0');
    await expect(page.locator('body')).toContainText('CANDIDATE_EXPOSED');

    // Advance simulation step-by-step through 4 real clicks unconditionally
    // Sequence: READY -> FOUP_LOADED -> TRANSFER -> ETCH_RUNNING -> T7_EXCURSION
    const nextStepBtn = page.locator('#sim-btn-next');
    await expect(nextStepBtn).toBeVisible();

    // 1. READY -> FOUP_LOADED
    await nextStepBtn.click();
    await expect(page.locator('#sim-step-badge')).toContainText('Step 2/7');

    // 2. FOUP_LOADED -> TRANSFER
    await nextStepBtn.click();
    await expect(page.locator('#sim-step-badge')).toContainText('Step 3/7');

    // 3. TRANSFER -> ETCH_RUNNING (T4/T5 null/missing optical gap)
    await nextStepBtn.click();
    await expect(page.locator('#sim-step-badge')).toContainText('Step 4/7');
    await expect(page.locator('#sim-telemetry-oes')).toContainText('null (결측 / MISSING)');
    await expect(page.locator('body')).toContainText('T4/T5 광학 신호 결측 (MISSING ≠ 0)');

    // 4. ETCH_RUNNING -> T7_EXCURSION (multi-sensor excursion spike)
    await nextStepBtn.click();
    await expect(page.locator('#sim-step-badge')).toContainText('Step 5/7');
    await expect(page.locator('#sim-step-heading')).toContainText('T7 공정 일탈');

    // Verify T7 simulation DOM telemetry values match getModeAT7ExcursionValues
    await expect(page.locator('#sim-telemetry-oes')).toContainText(`${expectedT7.oesSignal} a.u.`);
    await expect(page.locator('#sim-telemetry-pressure')).toContainText(`${expectedT7.chamberPressure} mTorr`);
    await expect(page.locator('#sim-telemetry-rf')).toContainText(`${expectedT7.rfPower} W`);

    // 2. Engineering Workspace EVI-02 T7 sensor consistency
    await page.goto(`/engineering-workspace?seed=${seed}`);
    await expect(page.locator('body')).toContainText('Excursion ≠ Defect');
    await expect(page.locator('body')).toContainText('MISSING ≠ 0');

    // EVI-02 card check - values must match getModeAT7ExcursionValues exactly
    const evi02Card = page.locator('#evidence-card-EVI-02');
    await expect(evi02Card).toBeVisible();
    await expect(evi02Card).toContainText(String(expectedT7.chamberPressure));
    await expect(evi02Card).toContainText(String(expectedT7.rfPower));
    await expect(evi02Card).toContainText(String(expectedT7.oesSignal));

    // 3. Counter-verification with non-default seed 20261016 for EVI-02 consistency
    const seed2 = 20261016;
    const expectedT7Seed2 = getModeAT7ExcursionValues(seed2);
    await page.goto(`/engineering-workspace?seed=${seed2}`);
    const evi02CardSeed2 = page.locator('#evidence-card-EVI-02');
    await expect(evi02CardSeed2).toBeVisible();
    await expect(evi02CardSeed2).toContainText(String(expectedT7Seed2.chamberPressure));
    await expect(evi02CardSeed2).toContainText(String(expectedT7Seed2.rfPower));
    await expect(evi02CardSeed2).toContainText(String(expectedT7Seed2.oesSignal));
  });
});
