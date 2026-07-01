// tests/09-moderation.spec.js
// moderation: модератор (profiles.is_admin) одобряет/отклоняет заявки services/events.
// Контракт: docs/contracts/moderation.md
//
// Проверяем:
//   - админ видит кнопку «Модерация», гость — нет (UX-гейт);
//   - approve → status='approved' в БД + запись становится видна анонимно;
//   - reject  → status='rejected';
//   - RLS: анонимная роль НЕ может сменить статус (безопасность на уровне БД).
//
// Требуется: TEST_USER_EMAIL помечен is_admin=true (см. docs/moderation-migration.sql).
// Сидинг/проверка/чистка — service_role (SUPABASE_SERVICE_KEY); без него — skip.

const { test, expect } = require('@playwright/test');
const { loginUser } = require('./helpers');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwcmiommviauwzkhkbki.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ANON_KEY = 'sb_publishable_8yyhkkUNIel1LqlwG0vreQ_4Y8Mu3pq';
const hasAdmin = !!SERVICE_KEY;
const email = process.env.TEST_USER_EMAIL || 'test@slswiss-test.com';
const pwd = process.env.TEST_USER_PWD || 'TestPass123!';

const adminHeaders = () => ({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' });
const anonHeaders = () => ({ apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' });

async function seedPending(request, table, data) {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    data: { ...data, status: 'pending_moderation' },
  });
  const rows = res.ok() ? await res.json() : [];
  return rows[0] && rows[0].id;
}
async function sbStatus(request, table, id) {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=status`, { headers: adminHeaders() });
  const rows = res.ok() ? await res.json() : [];
  return rows[0] && rows[0].status;
}
async function sbDelete(request, table, id) {
  return request.delete(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { headers: adminHeaders() });
}

// ─────────────────────────────────────────────────────────────
// БЛОК 12 — Модерация: доступ к UI
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 12 — Модерация: доступ', () => {
  test('12.1 — админ видит кнопку «Модерация»', async ({ page }) => {
    test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY + TEST_USER помечен is_admin');
    await loginUser(page, email, pwd);
    await expect(page.locator('#mod-btn')).toBeVisible({ timeout: 15000 });
  });

  test('12.2 — гость НЕ видит кнопку «Модерация»', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#mod-btn')).toHaveCount(0);
  });

  test('12.3 — не-админ: кнопки нет, openModeration отказывает (A4)', async ({ page, request }) => {
    test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY');
    const naEmail = `nonadmin_${Date.now()}@slswiss-test.com`;
    const res = await request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: adminHeaders(),
      data: { email: naEmail, password: 'TestPass123!', email_confirm: true, user_metadata: { first_name: 'No', last_name: 'Admin', canton: 'Zürich', plz: '8001' } },
    });
    const user = res.ok() ? await res.json() : null;
    const uid = user && user.id;
    expect(uid).toBeTruthy();
    try {
      await loginUser(page, naEmail, 'TestPass123!');
      await expect(page.locator('#mod-btn')).toHaveCount(0);            // кнопки нет
      await page.evaluate(() => window.openModeration());
      await expect(page.locator('#moderation-overlay')).toHaveCount(0); // оверлей не создался
    } finally {
      await request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, { headers: adminHeaders() });
    }
  });

  test('12.4 — бейдж-счётчик заявок на кнопке (B6)', async ({ page, request }) => {
    test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY + TEST_USER is_admin');
    const id = await seedPending(request, 'services', { name: `E2E-BADGE-${Date.now()}`, description: 'badge' });
    try {
      await loginUser(page, email, pwd);
      await expect(page.locator('#mod-btn')).toHaveText(/Модерация \(\d+\)/, { timeout: 15000 });
    } finally {
      await sbDelete(request, 'services', id);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// БЛОК 13 — Модерация: approve / reject
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 13 — Модерация: решения', () => {
  test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY + TEST_USER помечен is_admin');
  test.beforeEach(async ({ page }) => { await loginUser(page, email, pwd); });

  test('13.1 — approve каталога: status=approved + видно анонимно', async ({ page, request }) => {
    const name = `E2E-MOD-CAT-${Date.now()}`;
    const id = await seedPending(request, 'services', { name, description: 'mod-test' });
    expect(id).toBeTruthy();
    try {
      await page.evaluate(() => window.openModeration());
      const row = page.locator(`.mod-row[data-id="${id}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.locator('.mod-approve').click();
      await expect(row).toHaveCount(0, { timeout: 15000 }); // ушла из списка только после реального update
      expect(await sbStatus(request, 'services', id)).toBe('approved');
      // approved → видно анонимной роли
      const anon = await request.get(`${SUPABASE_URL}/rest/v1/services?id=eq.${id}&select=id`, { headers: anonHeaders() });
      expect((await anon.json()).length).toBe(1);
    } finally {
      await sbDelete(request, 'services', id);
    }
  });

  test('13.2 — reject события: status=rejected', async ({ page, request }) => {
    const title = `E2E-MOD-EVT-${Date.now()}`;
    const id = await seedPending(request, 'events', { title, description: 'mod-test' });
    expect(id).toBeTruthy();
    try {
      await page.evaluate(() => window.openModeration());
      const row = page.locator(`.mod-row[data-id="${id}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.locator('.mod-reject').click();
      await expect(row).toHaveCount(0, { timeout: 15000 });
      expect(await sbStatus(request, 'events', id)).toBe('rejected');
    } finally {
      await sbDelete(request, 'events', id);
    }
  });

  test('13.3 — снять с публикации: approved → rejected, исчезает из каталога', async ({ page, request }) => {
    const name = `E2E-MOD-UNPUB-${Date.now()}`;
    const ins = await request.post(`${SUPABASE_URL}/rest/v1/services`, {
      headers: { ...adminHeaders(), Prefer: 'return=representation' },
      data: { name, description: 'published biz', status: 'approved' },
    });
    const created = ins.ok() ? await ins.json() : [];
    const id = created[0] && created[0].id;
    expect(id).toBeTruthy();
    try {
      await page.evaluate(() => window.openModeration());
      const row = page.locator(`.mod-row[data-id="${id}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });          // в секции «Опубликовано»
      await row.locator('.mod-unpublish').click();
      await expect(row).toHaveCount(0, { timeout: 15000 });
      expect(await sbStatus(request, 'services', id)).toBe('rejected');
      // из публичного каталога исчез (публичны только approved)
      await page.evaluate(() => window.goPage('catalog'));
      await expect(page.locator(`.biz-card[data-id="${id}"]`)).toHaveCount(0);
    } finally {
      await sbDelete(request, 'services', id);
    }
  });

  test('13.4 — снять событие с публикации: approved → rejected, исчезает из афиши', async ({ page, request }) => {
    const title = `E2E-MOD-UNPUB-EVT-${Date.now()}`;
    const future = new Date(Date.now() + 10 * 86400000).toISOString();
    const ins = await request.post(`${SUPABASE_URL}/rest/v1/events`, {
      headers: { ...adminHeaders(), Prefer: 'return=representation' },
      data: { title, description: 'published event', canton: 'Zug', event_date: future, status: 'approved' },
    });
    const created = ins.ok() ? await ins.json() : [];
    const id = created[0] && created[0].id;
    expect(id).toBeTruthy();
    try {
      await page.evaluate(() => window.openModeration());
      const row = page.locator(`.mod-row[data-id="${id}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });          // в секции «Опубликовано»
      await row.locator('.mod-unpublish').click();
      await expect(row).toHaveCount(0, { timeout: 15000 });
      expect(await sbStatus(request, 'events', id)).toBe('rejected');
      // из афиши исчез (публичны только approved)
      await page.evaluate(() => window.goPage('afisha'));
      await expect(page.locator(`.event-card[data-id="${id}"]`)).toHaveCount(0);
    } finally {
      await sbDelete(request, 'events', id);
    }
  });

  test('13.5 — двойной клик по «Одобрить» шлёт один update (D5)', async ({ page, request }) => {
    const name = `E2E-MOD-DBL-${Date.now()}`;
    const id = await seedPending(request, 'services', { name, description: 'dbl' });
    let patchCount = 0;
    page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().includes('/rest/v1/services')) patchCount++; });
    try {
      await page.evaluate(() => window.openModeration());
      const row = page.locator(`.mod-row[data-id="${id}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });
      // два синхронных клика: второй попадает на уже disabled-кнопку (гвард) → один update
      await row.locator('.mod-approve').evaluate((el) => { el.click(); el.click(); });
      await expect(row).toHaveCount(0, { timeout: 15000 });
      await page.waitForTimeout(500);
      expect(patchCount).toBe(1);
      expect(await sbStatus(request, 'services', id)).toBe('approved');
    } finally {
      await sbDelete(request, 'services', id);
    }
  });

  test('13.6 — ошибка сети при решении: не ложный success, строка остаётся (D6)', async ({ page, request }) => {
    const name = `E2E-MOD-NETERR-${Date.now()}`;
    const id = await seedPending(request, 'services', { name, description: 'neterr' });
    try {
      await page.evaluate(() => window.openModeration());
      const row = page.locator(`.mod-row[data-id="${id}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });
      await page.route('**/rest/v1/services*', (route) => (route.request().method() === 'PATCH' ? route.abort() : route.continue()));
      await row.locator('.mod-approve').click();
      await expect(row).toBeVisible({ timeout: 8000 });                 // не исчезла (нет ложного success)
      await expect(row.locator('.mod-approve')).toBeEnabled();          // кнопка снова активна
      expect(await sbStatus(request, 'services', id)).toBe('pending_moderation'); // статус не изменился
      await page.unroute('**/rest/v1/services*');
    } finally {
      await sbDelete(request, 'services', id);
    }
  });

  test('13.7 — вернуть из скрытых: rejected → approved, появляется в каталоге (D9)', async ({ page, request }) => {
    const name = `E2E-MOD-REPUB-${Date.now()}`;
    const ins = await request.post(`${SUPABASE_URL}/rest/v1/services`, {
      headers: { ...adminHeaders(), Prefer: 'return=representation' },
      data: { name, description: 'repub', status: 'rejected' },
    });
    const created = ins.ok() ? await ins.json() : [];
    const id = created[0] && created[0].id;
    expect(id).toBeTruthy();
    try {
      await page.evaluate(() => window.openModeration());
      const row = page.locator(`.mod-row[data-id="${id}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });                // в секции «Скрытые»
      await row.locator('.mod-republish').click();
      await expect(row).toHaveCount(0, { timeout: 15000 });
      expect(await sbStatus(request, 'services', id)).toBe('approved');
      await page.evaluate(() => window.goPage('catalog'));
      await expect(page.locator(`.biz-card[data-id="${id}"]`)).toBeVisible({ timeout: 15000 });
    } finally {
      await sbDelete(request, 'services', id);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// БЛОК 14 — Модерация: RLS (безопасность)
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 14 — Модерация: RLS', () => {
  test('14.1 — анонимная роль НЕ может сменить статус', async ({ request }) => {
    test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY для сидинга');
    const name = `E2E-MOD-RLS-${Date.now()}`;
    const id = await seedPending(request, 'services', { name, description: 'rls-mod' });
    expect(id).toBeTruthy();
    try {
      // попытка одобрить анонимным ключом
      await request.patch(`${SUPABASE_URL}/rest/v1/services?id=eq.${id}`, {
        headers: { ...anonHeaders(), Prefer: 'return=representation' },
        data: { status: 'approved' },
      });
      // статус не изменился — RLS не дал
      expect(await sbStatus(request, 'services', id)).toBe('pending_moderation');
    } finally {
      await sbDelete(request, 'services', id);
    }
  });
});
