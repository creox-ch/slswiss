// tests/14-legal-consent.spec.js
// legal-consent: cookie-notice баннер (информационный), правовая модалка (showLegal),
// обязательное согласие с AGB/Datenschutz при регистрации.

const { test, expect } = require('@playwright/test');

const PWD = 'TestPass123!';
const uniqueEmail = () => `consent_${Date.now()}_${Math.floor(Math.random() * 1000)}@slswiss-test.com`;

// ─────────────────────────────────────────────────────────────
// БЛОК 20 — Правовая информация и согласия
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 20 — legal-consent', () => {
  test('20.1 — cookie-баннер: показывается, закрывается, не возвращается', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#cookie-banner')).toBeVisible({ timeout: 15000 });
    await page.locator('#cookie-ok').click();
    await expect(page.locator('#cookie-banner')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#cookie-banner')).toHaveCount(0); // ack сохранён в localStorage
  });

  test('20.2 — «Подробнее» / showLegal открывает правовую информацию (Impressum)', async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => window.showLegal());
    await expect(page.locator('#legal-overlay')).toBeVisible();
    await expect(page.locator('#legal-overlay')).toContainText('Impressum');
    await expect(page.locator('#legal-overlay')).toContainText('Datenschutz');
  });

  test('20.3 — регистрация без согласия НЕ проходит (чекбокс обязателен)', async ({ page }) => {
    await page.goto('');
    await page.click('button.btn-join:has-text("Вступить")');
    await page.locator('#m-login a:has-text("Зарегистрироваться")').click();
    await expect(page.locator('#rs1')).toBeVisible();
    await page.fill('#rs1-first', 'T');
    await page.fill('#rs1-last', 'U');
    await page.fill('#rs1-email', uniqueEmail());
    await page.fill('#rs1-pwd', PWD);
    await page.locator('#rs1 button:has-text("Далее")').click();
    await page.selectOption('#rs2-canton', { label: 'Zürich' });
    await page.fill('#rs2-plz', '8001');
    await page.locator('#rs2 button:has-text("Далее")').click();
    await expect(page.locator('#rs3')).toBeVisible();
    // НЕ отмечаем #reg-consent
    let signupSent = false;
    page.on('request', (r) => { if (r.url().includes('/auth/v1/signup')) signupSent = true; });
    await page.click('button:has-text("Создать аккаунт")');
    await expect(page.locator('#reg-consent-err')).toBeVisible(); // ошибка про согласие
    await page.waitForTimeout(300);
    expect(signupSent).toBe(false);                               // регистрация не ушла
  });

  test('20.4 — футер: юр-документ раскрывается по клику', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#legal-acc-imp')).toBeHidden(); // свёрнут по умолчанию
    await page.locator('footer').getByText('Impressum', { exact: false }).first().click();
    await expect(page.locator('#legal-acc-imp')).toBeVisible();
    await expect(page.locator('#legal-acc-imp')).toContainText('Baden');
  });
});
