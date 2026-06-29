// tests/08-forms.spec.js
// forms-mvp-backend: формы «Добавить в каталог» (services) и «Добавить событие» (events)
// пишут заявки в Supabase со status='pending_moderation' (статус-модель модерации).
// Контракт: docs/contracts/forms-mvp-backend.md
//
// Что проверяем:
//   - форма открывается у залогиненного юзера;
//   - валидация (пустые обязательные / дата события в прошлом) → инлайн-ошибка, БЕЗ вставки;
//   - happy path → заявка реально легла в БД со status='pending_moderation' (через service_role);
//   - RLS: pending-заявка НЕ видна анонимной роли (только approved).
//
// Логин — подтверждённым тестовым юзером (CI: секреты TEST_USER_EMAIL / TEST_USER_PWD).
// Проверка/чистка БД — service_role (CI: секрет SUPABASE_SERVICE_KEY); без него такие тесты skip.

const { test, expect } = require('@playwright/test');
const { loginUser } = require('./helpers');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwcmiommviauwzkhkbki.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
// anon publishable key — он и так публичный (зашит в index.html). Нужен для проверки RLS.
const ANON_KEY = 'sb_publishable_8yyhkkUNIel1LqlwG0vreQ_4Y8Mu3pq';
const hasAdmin = !!SERVICE_KEY;
const email = process.env.TEST_USER_EMAIL || 'test@slswiss-test.com';
const pwd = process.env.TEST_USER_PWD || 'TestPass123!';

const adminHeaders = () => ({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' });
const anonHeaders = () => ({ apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY });

async function sbGet(request, table, params, headers) {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
  return res.ok() ? res.json() : [];
}
async function sbDelete(request, table, id) {
  return request.delete(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { headers: adminHeaders() });
}

// Юзер залогинен → форма открывается напрямую (минуя баннерные кнопки).
async function openCatalogForm(page) {
  await page.evaluate(() => window.addBusiness());
  await expect(page.locator('#biz-add-overlay')).toBeVisible();
}
async function openEventForm(page) {
  await page.evaluate(() => window.openEventForm());
  await expect(page.locator('#event-form-overlay')).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// БЛОК 10 — Каталог (services)
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 10 — Каталог: заявка в Supabase', () => {
  test.beforeEach(async ({ page }) => { await loginUser(page, email, pwd); });

  test('10.1 — форма «Добавить в каталог» открывается у залогиненного', async ({ page }) => {
    await openCatalogForm(page);
    await expect(page.locator('#biz-name')).toBeVisible();
    await expect(page.locator('#biz-desc')).toBeVisible();
  });

  test('10.2 — пустые обязательные: инлайн-ошибка, вставки нет, форма открыта', async ({ page }) => {
    await openCatalogForm(page);
    let posted = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/rest/v1/services')) posted = true; });
    await page.click('#biz-submit');
    await expect(page.locator('#biz-form-err')).toBeVisible();
    await page.waitForTimeout(300);
    expect(posted).toBe(false);
    await expect(page.locator('#biz-add-overlay')).toBeVisible(); // не закрылась
  });

  test('10.3 — happy path: заявка сохраняется со status=pending_moderation', async ({ page, request }) => {
    test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY');
    const name = `E2E-CAT-${Date.now()}`;
    await openCatalogForm(page);
    await page.fill('#biz-name', name);
    await page.fill('#biz-desc', 'Автотест: заявка каталога');
    await page.click('#biz-submit');
    // overlay закрывается ТОЛЬКО после реального ответа Supabase (не ложный success)
    await expect(page.locator('#biz-add-overlay')).toHaveCount(0, { timeout: 15000 });
    const rows = await sbGet(request, 'services', `name=eq.${name}&select=id,status,owner_id`, adminHeaders());
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('pending_moderation');
    expect(rows[0].owner_id).toBeTruthy(); // привязка к автору
    await sbDelete(request, 'services', rows[0].id);
  });

  test('10.4 — RLS: pending-заявка НЕ видна анонимной роли', async ({ request }) => {
    test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY');
    const name = `E2E-CAT-RLS-${Date.now()}`;
    const ins = await request.post(`${SUPABASE_URL}/rest/v1/services`, {
      headers: { ...adminHeaders(), Prefer: 'return=representation' },
      data: { name, description: 'rls-test', status: 'pending_moderation' },
    });
    const created = ins.ok() ? await ins.json() : [];
    const id = created[0] && created[0].id;
    try {
      const anon = await sbGet(request, 'services', `name=eq.${name}&select=id`, anonHeaders());
      expect(anon.length).toBe(0); // аноним видит только approved
    } finally {
      if (id) await sbDelete(request, 'services', id);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// БЛОК 11 — События (events)
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 11 — События: заявка в Supabase', () => {
  test.beforeEach(async ({ page }) => { await loginUser(page, email, pwd); });

  test('11.1 — форма «Добавить событие» открывается у залогиненного', async ({ page }) => {
    await openEventForm(page);
    await expect(page.locator('#event-title')).toBeVisible();
  });

  test('11.2 — пустое название: инлайн-ошибка, вставки нет', async ({ page }) => {
    await openEventForm(page);
    let posted = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/rest/v1/events')) posted = true; });
    await page.click('#event-submit');
    await expect(page.locator('#event-form-err')).toBeVisible();
    await page.waitForTimeout(300);
    expect(posted).toBe(false);
  });

  test('11.3 — дата события в прошлом: ошибка «в будущем», вставки нет', async ({ page }) => {
    await openEventForm(page);
    let posted = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/rest/v1/events')) posted = true; });
    await page.fill('#event-title', 'E2E прошлое событие');
    await page.fill('#event-date', '2020-01-01T10:00');
    await page.click('#event-submit');
    await expect(page.locator('#event-form-err')).toContainText('будущем');
    await page.waitForTimeout(300);
    expect(posted).toBe(false);
  });

  test('11.4 — happy path: событие сохраняется со status=pending_moderation', async ({ page, request }) => {
    test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY');
    const title = `E2E-EVT-${Date.now()}`;
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    await openEventForm(page);
    await page.fill('#event-title', title);
    await page.fill('#event-date', future);
    await page.click('#event-submit');
    await expect(page.locator('#event-form-overlay')).toHaveCount(0, { timeout: 15000 });
    const rows = await sbGet(request, 'events', `title=eq.${title}&select=id,status,created_by`, adminHeaders());
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('pending_moderation');
    expect(rows[0].created_by).toBeTruthy();
    await sbDelete(request, 'events', rows[0].id);
  });
});
