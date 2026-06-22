// tests/06-registration.spec.js
// Регистрация нового пользователя — ЭТАП 1: email + пароль.
//
// UI-флоу (после фикса ID в форме):
//   Вступить → таб «Регистрация» → шаг1 (#rs1-first/last/email/pwd) → Далее
//   → шаг2 (#rs2-canton/#rs2-plz) → Далее → шаг3 → «Создать аккаунт»
//   → sbSignUp → _supabase.auth.signUp(...) → письмо с подтверждением (alert).
//
// Часть проверок (создан ли юзер, авто-подтверждение, профиль, очистка) ходит
// в admin-API Supabase с ключом service_role из env SUPABASE_SERVICE_KEY
// (в CI — секрет). Без ключа эти тесты пропускаются (skip), чтобы локальный
// прогон без секрета не падал.

const { test, expect } = require('@playwright/test');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwcmiommviauwzkhkbki.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const hasAdmin = !!SERVICE_KEY;
const PWD = 'TestPass123!';

const uniqueEmail = () =>
  `reg_${Date.now()}_${Math.floor(Math.random() * 1000)}@slswiss-test.com`;

// ── admin-хелперы (GoTrue admin + REST) через APIRequestContext ──
const adminHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
});
async function adminFindUser(request, email) {
  const res = await request.get(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: adminHeaders() });
  if (!res.ok()) return null;
  const body = await res.json();
  const users = body.users || body;
  return (users || []).find((u) => u.email === email) || null;
}
async function adminConfirmUser(request, id) {
  return request.put(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: adminHeaders(), data: { email_confirm: true } });
}
async function adminDeleteUser(request, id) {
  return request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: adminHeaders() });
}
async function adminGetProfile(request, id) {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=*`, { headers: adminHeaders() });
  if (!res.ok()) return null;
  const rows = await res.json();
  return rows[0] || null;
}

// ── UI-хелперы ──
async function openRegistration(page) {
  await page.goto('');
  await page.click('button.btn-join:has-text("Вступить")');
  // Внутри модалки логина — ссылка «Зарегистрироваться» переключает на таб регистрации.
  await page.locator('#m-login a:has-text("Зарегистрироваться")').click();
  await expect(page.locator('#rs1')).toBeVisible();
}
async function fillStepsAndSubmit(page, { first, last, email, pwd, canton, plz }) {
  await page.fill('#rs1-first', first);
  await page.fill('#rs1-last', last);
  await page.fill('#rs1-email', email);
  await page.fill('#rs1-pwd', pwd);
  await page.locator('#rs1 button:has-text("Далее")').click();
  await expect(page.locator('#rs2')).toBeVisible();
  await page.selectOption('#rs2-canton', { label: canton });
  await page.fill('#rs2-plz', plz);
  await page.locator('#rs2 button:has-text("Далее")').click();
  await expect(page.locator('#rs3')).toBeVisible();
  await page.click('button:has-text("Создать аккаунт")');
}

// ─────────────────────────────────────────────────────────────
// БЛОК 1 — Форма и шаги
// ─────────────────────────────────────────────────────────────
test.describe('Регистрация — форма и шаги', () => {
  test('1.1 — открывается форма регистрации (шаг 1)', async ({ page }) => {
    await openRegistration(page);
    await expect(page.getByText('Шаг 1')).toBeVisible();
    await expect(page.locator('#rs1-email')).toBeVisible();
    await expect(page.locator('#rs1-pwd')).toBeVisible();
  });

  test('1.2 — переходы 1→2→3 и кнопка «Назад»', async ({ page }) => {
    await openRegistration(page);
    await page.fill('#rs1-first', 'Test');
    await page.fill('#rs1-last', 'User');
    await page.fill('#rs1-email', uniqueEmail());
    await page.fill('#rs1-pwd', PWD);
    await page.locator('#rs1 button:has-text("Далее")').click();
    await expect(page.getByText('Шаг 2')).toBeVisible();
    // назад на шаг 1
    await page.locator('#rs2 button:has-text("Назад")').click();
    await expect(page.getByText('Шаг 1')).toBeVisible();
    // снова вперёд до шага 3
    await page.locator('#rs1 button:has-text("Далее")').click();
    await page.selectOption('#rs2-canton', { label: 'Zürich' });
    await page.fill('#rs2-plz', '8001');
    await page.locator('#rs2 button:has-text("Далее")').click();
    await expect(page.getByText('Шаг 3')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// БЛОК 2 — Валидация (без service_role)
// ─────────────────────────────────────────────────────────────
test.describe('Регистрация — валидация', () => {
  // Валидация теперь клиентская (контракт registration-fix): кнопка «Далее»
  // заблокирована, пока поля невалидны, ошибки показываются под полями.
  test('2.1 — пустые поля: «Далее» заблокирована, signUp не уходит', async ({ page }) => {
    await openRegistration(page);
    let signupCalled = false;
    page.on('request', (r) => { if (r.url().includes('/auth/v1/signup')) signupCalled = true; });
    await expect(page.locator('#rs1-next')).toBeDisabled();
    await page.waitForTimeout(300);
    expect(signupCalled).toBe(false);
  });

  test('2.2 — невалидный email: ошибка под полем, «Далее» заблокирована', async ({ page }) => {
    await openRegistration(page);
    await page.fill('#rs1-first', 'T');
    await page.fill('#rs1-last', 'U');
    await page.fill('#rs1-email', 'not-an-email');
    await page.fill('#rs1-pwd', PWD);
    await expect(page.locator('#rs1-email-err')).toBeVisible();
    await expect(page.locator('#rs1-next')).toBeDisabled();
  });

  test('2.3 — короткий пароль (<8): ошибка под полем, «Далее» заблокирована', async ({ page }) => {
    await openRegistration(page);
    await page.fill('#rs1-first', 'T');
    await page.fill('#rs1-last', 'U');
    await page.fill('#rs1-email', uniqueEmail());
    await page.fill('#rs1-pwd', '123');
    await expect(page.locator('#rs1-pwd-err')).toBeVisible();
    await expect(page.locator('#rs1-next')).toBeDisabled();
  });

  test('2.4 — PLZ не 4 цифры: ошибка под полем, «Далее» (шаг 2) заблокирована', async ({ page }) => {
    await openRegistration(page);
    await page.fill('#rs1-first', 'T');
    await page.fill('#rs1-last', 'U');
    await page.fill('#rs1-email', uniqueEmail());
    await page.fill('#rs1-pwd', PWD);
    await page.locator('#rs1 button:has-text("Далее")').click();
    await expect(page.locator('#rs2')).toBeVisible();
    await page.selectOption('#rs2-canton', { label: 'Zürich' });
    await page.fill('#rs2-plz', 'ABC');
    await expect(page.locator('#rs2-plz-err')).toBeVisible();
    await expect(page.locator('#rs2-next')).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────
// БЛОК 3 — Успешная регистрация (требует service_role)
// ─────────────────────────────────────────────────────────────
test.describe('Регистрация — успех', () => {
  test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY (admin-API)');

  let createdUserId = null;
  test.afterEach(async ({ request }) => {
    if (createdUserId) { await adminDeleteUser(request, createdUserId); createdUserId = null; }
  });

  test('3.1 — регистрация создаёт аккаунт с верными метаданными', async ({ page, request }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    const email = uniqueEmail();
    await openRegistration(page);
    await fillStepsAndSubmit(page, { first: 'Рега', last: 'Тестова', email, pwd: PWD, canton: 'Bern', plz: '3000' });
    // Ждём, пока signUp создаст пользователя. Не зависит от состояния подтверждения:
    // выключено → авто-логин, включено → экран «Проверь почту». Юзер создаётся в обоих.
    let user = null;
    await expect.poll(async () => { user = await adminFindUser(request, email); return !!user; }, { timeout: 15000 }).toBe(true);
    createdUserId = user.id;
    expect(user.user_metadata.first_name).toBe('Рега');
    expect(user.user_metadata.last_name).toBe('Тестова');
    expect(user.user_metadata.canton).toBe('Bern');
    expect(user.user_metadata.plz).toBe('3000');
  });

  test('3.2 — после авто-подтверждения вход новыми данными работает', async ({ page, request }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    const email = uniqueEmail();
    await openRegistration(page);
    await fillStepsAndSubmit(page, { first: 'Вход', last: 'Тест', email, pwd: PWD, canton: 'Zürich', plz: '8001' });
    let user = null;
    await expect.poll(async () => { user = await adminFindUser(request, email); return !!user; }, { timeout: 15000 }).toBe(true);
    createdUserId = user.id;
    await adminConfirmUser(request, user.id);

    // При отключённом подтверждении signUp сразу создаёт сессию — выйдем,
    // чтобы протестировать именно ВХОД новыми данными (иначе кнопки «Войти» нет).
    await page.evaluate(async () => { if (window._supabase) { await window._supabase.auth.signOut(); } });
    await page.goto('');
    await expect(page.locator('#nav-right')).toContainText('Войти');
    await page.click('button.btn-login');
    await page.fill('#login-email-input', email);
    await page.fill('#login-pwd-input', PWD);
    await page.getByRole('button', { name: 'Войти', exact: true }).last().click();
    await expect(page.locator('#nav-right')).toContainText('Выйти', { timeout: 10000 });
  });

  // ВНИМАНИЕ: если этот тест упадёт — это НЕ баг теста, а отсутствие триггера
  // на auth.users, создающего строку в profiles при регистрации. Тогда это
  // доработка сайта/БД (см. триаж). Профиль нужен, чтобы у нового юзера
  // работала функция «Редактировать профиль».
  test('3.3 — при регистрации создаётся строка в profiles', async ({ page, request }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    const email = uniqueEmail();
    await openRegistration(page);
    await fillStepsAndSubmit(page, { first: 'Проф', last: 'Иль', email, pwd: PWD, canton: 'Vaud', plz: '1000' });
    let user = null;
    await expect.poll(async () => { user = await adminFindUser(request, email); return !!user; }, { timeout: 15000 }).toBe(true);
    createdUserId = user.id;
    // даём триггеру мгновение
    await page.waitForTimeout(1500);
    const profile = await adminGetProfile(request, user.id);
    expect(profile, 'ожидается строка в profiles (триггер на регистрацию)').toBeTruthy();
  });
});
