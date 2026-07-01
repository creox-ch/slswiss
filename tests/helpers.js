// tests/helpers.js
const { expect } = require('@playwright/test');

const TEST_EMAIL = `test_${Date.now()}@slswiss-test.com`;
const TEST_PASSWORD = 'TestPass123!';

async function registerUser(page, email = TEST_EMAIL, pwd = TEST_PASSWORD) {
  await page.goto('');
  await page.click('button:has-text("Вступить")');
  // Step 1: email + password
  await page.fill('#rs1-email', email);
  await page.fill('#rs1-pwd', pwd);
  await page.fill('#rs1-first', 'Test');
  await page.fill('#rs1-last', 'User');
  await page.click('button:has-text("Далее")');
  // Step 2: canton + plz
  await page.selectOption('#rs2-canton', 'Zürich');
  await page.fill('#rs2-plz', '8001');
  await page.click('button:has-text("Далее")');
  // Step 3: interests + consent + create
  await page.check('#reg-consent'); // legal-consent: обязательное согласие
  await page.click('button:has-text("Создать аккаунт")');
  return { email, pwd };
}

async function loginUser(page, email, pwd) {
  await page.goto('');
  await page.click('button.btn-login');
  await page.fill('#login-email-input', email);
  await page.fill('#login-pwd-input', pwd);
  // Submit-кнопка "Войти" — последняя на странице (в модалке после тэгов/соц-логинов)
  await page.getByRole('button', { name: 'Войти', exact: true }).last().click();
  await page.waitForTimeout(2000);
}

/**
 * Открыть Профиль → вкладку «⚙️ Настройки» с формой редактирования.
 * Предполагает, что пользователь уже залогинен (см. loginUser в beforeEach).
 * После клика по аватару goPage('profile') запускает loadProfileForm() через 50мс,
 * поэтому ждём, что поле «Имя» реально появилось во вкладке настроек.
 */
async function openProfileSettings(page) {
  // Аватар-обёртка = первый div в #nav-right (renderNav: wrap, затем кнопка «Выйти»).
  // Клик по ней вызывает goPage('profile').
  await page.locator('#nav-right > div').first().click();
  await expect(page.locator('#page-profile')).toBeVisible();
  // Пункт меню «⚙️ Настройки» (showPTab('settings')). Скоупим только по .pmenu-item,
  // чтобы не зацепить заголовок «Настройки профиля» внутри самой вкладки.
  await page.locator('.pmenu-item', { hasText: 'Настройки' }).click();
  await expect(page.locator('#ptab-settings')).toHaveClass(/active/);
  await expect(page.locator('#prof-first')).toBeVisible();
  // КЛЮЧЕВОЕ против гонки: при входе loadProfileForm() срабатывает дважды —
  // сразу из сессии (email уже есть), и позже из БД (DB-fetch в sbSignIn/getSession).
  // Если тест впишет значение между ними, поздняя загрузка из БД его затрёт.
  // Поэтому ждём, пока профиль реально подгружен из БД (updated_at есть только
  // в строке БД, в объекте из сессии его нет), затем синхронизируем форму сами —
  // после этого отложенных loadProfileForm уже не будет, и наш ввод не затрётся.
  await page.waitForFunction(
    () => window._profile && window._profile.id && ('updated_at' in window._profile),
    null, { timeout: 15000 }
  );
  await page.evaluate(() => window.loadProfileForm && window.loadProfileForm());
  await expect(page.locator('#prof-email')).not.toHaveValue('');
}

module.exports = { registerUser, loginUser, openProfileSettings, TEST_EMAIL, TEST_PASSWORD };
