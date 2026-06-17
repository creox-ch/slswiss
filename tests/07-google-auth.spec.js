// tests/07-google-auth.spec.js
// Вход/регистрация через Google — ЭТАП 2, уровень «инициация».
// Проверяем, что кнопки Google запускают OAuth-редирект на авторизацию Google
// (через Supabase /auth/v1/authorize → accounts.google.com). Реальный вход в
// Google НЕ доводим (в CI нет Google-сессии; это и не нужно для инициации).
//
// Если провайдер Google не включён в Supabase — authorize вернёт на сайт с
// ошибкой вместо редиректа на Google, и тест упадёт. Так что этот тест заодно
// подтверждает, что провайдер реально настроен.

const { test, expect } = require('@playwright/test');

// Куда должен увести клик: либо уже на Google, либо на промежуточный authorize Supabase.
const AUTH_REDIRECT = /accounts\.google\.com|\/auth\/v1\/authorize/;

test.describe('Google OAuth — инициация', () => {
  test('G.1 — кнопка «Войти через Google» (логин) уводит на авторизацию Google', async ({ page }) => {
    await page.goto('');
    await page.click('button.btn-login');
    await page.click('button:has-text("Войти через Google")');
    await page.waitForURL(AUTH_REDIRECT, { timeout: 15000 });
    expect(page.url()).toMatch(AUTH_REDIRECT);
  });

  test('G.2 — кнопка «Google» в регистрации уводит на авторизацию Google', async ({ page }) => {
    await page.goto('');
    await page.click('button.btn-join:has-text("Вступить")');
    await page.locator('#m-login a:has-text("Зарегистрироваться")').click();
    await expect(page.locator('#rs1')).toBeVisible();
    await page.click('button.oauth-btn:has-text("Google")');
    await page.waitForURL(AUTH_REDIRECT, { timeout: 15000 });
    expect(page.url()).toMatch(AUTH_REDIRECT);
  });
});
