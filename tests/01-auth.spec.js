// tests/01-auth.spec.js
const { test, expect } = require('@playwright/test');
const { registerUser, loginUser } = require('./helpers');

test.describe('БЛОК 1 — Авторизация', () => {

  test('1.1 — Главная открывается без логина', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('text=Свои люди')).toBeVisible();
    await expect(page.locator('button:has-text("Вступить")').first()).toBeVisible();
  });

  test('1.2-1.4 — Полная регистрация через 3 шага', async ({ page }) => {
    const email = `test_${Date.now()}@slswiss-test.com`;
    await page.goto('');
    await page.click('button.btn-join:has-text("Вступить")');

    // Внутри модалки #m-login есть ссылка "Зарегистрироваться" → переключает на форму регистрации
    await page.locator('#m-login a:has-text("Зарегистрироваться")').click();

    // Шаг 1
    await expect(page.locator('text=Шаг 1')).toBeVisible();
    await page.fill('#rs1-email', email);
    await page.fill('#rs1-pwd', 'TestPass123!');
    await page.fill('#rs1-first', 'Test');
    await page.fill('#rs1-last', 'User');
    await page.click('button:has-text("Далее")');

    // Шаг 2
    await expect(page.locator('text=Шаг 2')).toBeVisible();
    await page.selectOption('#rs2-canton', { label: 'Zürich' });
    await page.fill('#rs2-plz', '8001');
    await page.click('button:has-text("Далее")');

    // Шаг 3
    await expect(page.locator('text=Шаг 3')).toBeVisible();
    await page.click('button:has-text("Создать аккаунт")');

    await page.waitForTimeout(3000);
  });

  test('1.6 — Вход существующего пользователя', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@slswiss-test.com';
    const pwd = process.env.TEST_USER_PWD || 'TestPass123!';

    await page.goto('');
    await page.click('button.btn-login');
    await page.fill('#login-email-input', email);
    await page.fill('#login-pwd-input', pwd);
    await page.getByRole('button', { name: 'Войти', exact: true }).last().click();
    await page.waitForTimeout(2000);

    await expect(page.locator('button:has-text("Выйти")')).toBeVisible({ timeout: 5000 });
  });

  test('1.7 — Выход', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@slswiss-test.com';
    const pwd = process.env.TEST_USER_PWD || 'TestPass123!';
    await loginUser(page, email, pwd);
    await page.click('button:has-text("Выйти")');
    await page.waitForTimeout(1000);
    await expect(page.locator('button.btn-join:has-text("Вступить")')).toBeVisible();
  });
});
