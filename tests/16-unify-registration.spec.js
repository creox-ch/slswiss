// tests/16-unify-registration.spec.js
// Спринт unify-registration: общий экран дозаполнения профиля после любого входа.
// Реальный Google OAuth в CI не прогнать (нужен живой аккаунт + консент-экран),
// поэтому логику гейта проверяем через программный вызов openProfileCompletion()
// на тест-профиле без кантона/PLZ, а «полный юзер не гейтится» — реальным входом.
const { test, expect } = require('@playwright/test');
const { loginUser } = require('./helpers');

// Открыть гейт на синтетическом профиле без кантона/PLZ (эмуляция возврата с OAuth).
async function openGate(page, profile) {
  await page.goto('');
  await page.waitForFunction(() => typeof window.openProfileCompletion === 'function');
  await page.evaluate((p) => { window._profile = p; window.openProfileCompletion(); },
    profile || { id: 'test-user-id', first_name: 'Test', last_name: 'User', canton: '', plz: '' });
  await expect(page.locator('#m-complete')).toBeVisible();
}

test.describe('БЛОК 16 — Unify registration (экран дозаполнения)', () => {

  test('16.1 — Модалка дозаполнения есть в DOM со своими id (без дублей rs2-*)', async ({ page }) => {
    await page.goto('');
    for (const id of ['#m-complete', '#pc-canton', '#pc-plz', '#pc-consent', '#pc-finish', '#pc-exit']) {
      await expect(page.locator(id)).toHaveCount(1);
    }
    // id не должны конфликтовать с формой регистрации
    await expect(page.locator('#pc-canton')).not.toHaveAttribute('id', 'rs2-canton');
  });

  test('16.2 — Полный профиль (email-юзер) НЕ видит экран дозаполнения', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@slswiss-test.com';
    const pwd = process.env.TEST_USER_PWD || 'TestPass123!';
    await loginUser(page, email, pwd);
    await expect(page.locator('button:has-text("Выйти")')).toBeVisible({ timeout: 8000 });
    // Гейт не показан — у существующего юзера есть кантон/PLZ
    await expect(page.locator('#m-complete')).toBeHidden();
  });

  test('16.3 — Гейт открывается для профиля без кантона; select наполнен кантонами', async ({ page }) => {
    await openGate(page);
    // 26 кантонов + плейсхолдер
    const opts = await page.locator('#pc-canton option').count();
    expect(opts).toBeGreaterThanOrEqual(27);
    await expect(page.locator('#pc-canton option', { hasText: 'Zürich' })).toHaveCount(1);
  });

  test('16.4 — Валидация: кантон и PLZ обязательны для кнопки «Готово»', async ({ page }) => {
    await openGate(page);
    // Пусто → disabled
    await expect(page.locator('#pc-finish')).toBeDisabled();
    // Кантон есть, PLZ невалиден → ошибка + disabled
    await page.selectOption('#pc-canton', 'Zürich');
    await page.fill('#pc-plz', '80');
    await expect(page.locator('#pc-plz-err')).toBeVisible();
    await expect(page.locator('#pc-finish')).toBeDisabled();
    // Валидный PLZ → enabled
    await page.fill('#pc-plz', '8001');
    await expect(page.locator('#pc-plz-err')).toBeHidden();
    await expect(page.locator('#pc-finish')).toBeEnabled();
  });

  test('16.5 — Согласие обязательно: без чекбокса «Готово» не проходит', async ({ page }) => {
    await openGate(page);
    await page.selectOption('#pc-canton', 'Bern');
    await page.fill('#pc-plz', '3011');
    await expect(page.locator('#pc-finish')).toBeEnabled();
    // Клик без согласия → ошибка, гейт не закрылся
    await page.click('#pc-finish');
    await expect(page.locator('#pc-consent-err')).toBeVisible();
    await expect(page.locator('#m-complete')).toBeVisible();
  });

  test('16.6 — Escape hatch «Выйти» закрывает гейт', async ({ page }) => {
    await openGate(page);
    await page.click('#pc-exit');
    await expect(page.locator('#m-complete')).toBeHidden();
    // Флаг гейта снят
    const active = await page.evaluate(() => window._gateActive);
    expect(active).toBeFalsy();
  });

  test('16.7 — Apple и Telegram — честные заглушки «скоро», без входа', async ({ page }) => {
    await page.goto('');
    await page.click('button.btn-login');
    // Telegram (в модалке входа)
    await page.click('button:has-text("Войти через Telegram")');
    await expect(page.locator('text=скоро будет доступен').first()).toBeVisible();
    await expect(page.locator('#m-complete')).toBeHidden();
    await expect(page.locator('button:has-text("Выйти")')).toHaveCount(0);
    // Apple (в форме регистрации)
    await page.locator('.modal-tab:has-text("Регистрация")').click();
    await page.locator('.oauth-btn:has-text("Apple")').click();
    await expect(page.locator('text=скоро будет доступен').first()).toBeVisible();
    await expect(page.locator('button:has-text("Выйти")')).toHaveCount(0);
  });
});
