// tests/13-forms-polish.spec.js
// cantons-fix: единый список 26 кантонов (сортировка) в регистрации и всех формах.
// draft-persistence: ввод формы сохраняется в localStorage и переживает закрытие/переоткрытие.
// Тесты чисто UI (без бэкенда) — формы строим напрямую window.showEventForm/showBusinessForm.

const { test, expect } = require('@playwright/test');

// ─────────────────────────────────────────────────────────────
// БЛОК 18 — cantons-fix
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 18 — Кантоны: единый полный список', () => {
  test('18.1 — форма события: 26 кантонов + «Онлайн», включая ранее пропущенные', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => window.showEventForm());
    const sel = page.locator('#event-canton');
    await expect(sel).toBeVisible({ timeout: 15000 });
    expect(await sel.locator('option').count()).toBeGreaterThanOrEqual(27); // 26 + Онлайн
    for (const c of ['Jura', 'Uri', 'Glarus', 'Basel-Land', 'Basel-Stadt', 'Zürich']) {
      expect(await sel.locator(`option:has-text("${c}")`).count()).toBeGreaterThan(0);
    }
  });

  test('18.2 — форма бизнеса: 26 кантонов + спец-опции', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => window.showBusinessForm());
    const sel = page.locator('#biz-canton');
    await expect(sel).toBeVisible({ timeout: 15000 });
    expect(await sel.locator('option').count()).toBeGreaterThanOrEqual(28); // 26 + Онлайн + Вся Швейцария
    expect(await sel.locator('option:has-text("Jura")').count()).toBeGreaterThan(0);
  });

  test('18.3 — регистрация #rs2-canton: 26 кантонов (единый источник)', async ({ page }) => {
    await page.goto('');
    // initCantonSelects заполняет из CANTONS на DOMContentLoaded
    await expect.poll(async () => page.locator('#rs2-canton option').count(), { timeout: 15000 }).toBeGreaterThanOrEqual(27);
    expect(await page.locator('#rs2-canton option:has-text("Jura")').count()).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// БЛОК 19 — draft-persistence
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 19 — Черновик формы переживает переоткрытие', () => {
  test('19.1 — событие: закрыл без отправки → переоткрыл → поля восстановлены', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => { try { localStorage.removeItem('slsdraft:event'); } catch (e) {} });
    await page.evaluate(() => window.showEventForm());
    await page.fill('#event-title', 'Черновик встречи');
    await page.fill('#event-desc', 'Описание черновика');
    // закрыть форму, НЕ отправляя (как уход на другую вкладку и возврат)
    await page.evaluate(() => { const o = document.getElementById('event-form-overlay'); if (o) o.remove(); });
    await page.evaluate(() => window.showEventForm());
    await expect(page.locator('#event-title')).toHaveValue('Черновик встречи');
    await expect(page.locator('#event-desc')).toHaveValue('Описание черновика');
    await page.evaluate(() => { try { localStorage.removeItem('slsdraft:event'); } catch (e) {} });
  });

  test('19.2 — бизнес: черновик восстанавливается при переоткрытии', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => { try { localStorage.removeItem('slsdraft:biz'); } catch (e) {} });
    await page.evaluate(() => window.showBusinessForm());
    await page.fill('#biz-name', 'Черновик бизнеса');
    await page.fill('#biz-desc', 'Что предлагаю');
    await page.evaluate(() => { const o = document.getElementById('biz-add-overlay'); if (o) o.remove(); });
    await page.evaluate(() => window.showBusinessForm());
    await expect(page.locator('#biz-name')).toHaveValue('Черновик бизнеса');
    await expect(page.locator('#biz-desc')).toHaveValue('Что предлагаю');
    await page.evaluate(() => { try { localStorage.removeItem('slsdraft:biz'); } catch (e) {} });
  });
});
