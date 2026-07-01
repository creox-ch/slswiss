// tests/12-my-submissions.spec.js
// E4 (in-app уведомление): автор видит статус своих заявок в профиле.
// Вкладка «Мой бизнес» (#my-biz-list) — свои services; «Мои события» (#my-events-list) — свои events,
// каждая со статус-бейджем (🕓 На модерации / ✅ Опубликовано / 🚫 Отклонено).
// RLS «Auth read own» пускает автора к своим строкам любого статуса.
// Требует SUPABASE_SERVICE_KEY (сид с owner_id) + TEST_USER (залогиненный автор). Без ключа — skip.

const { test, expect } = require('@playwright/test');
const { loginUser } = require('./helpers');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwcmiommviauwzkhkbki.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const hasAdmin = !!SERVICE_KEY;
const email = process.env.TEST_USER_EMAIL || 'test@slswiss-test.com';
const pwd = process.env.TEST_USER_PWD || 'TestPass123!';
const adminHeaders = () => ({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' });

async function seed(request, table, data) {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: { ...adminHeaders(), Prefer: 'return=representation' }, data,
  });
  const rows = res.ok() ? await res.json() : [];
  return rows[0] && rows[0].id;
}
async function del(request, table, id) {
  return request.delete(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { headers: adminHeaders() });
}

test.describe('БЛОК 17 — Мои заявки: in-app статус', () => {
  test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY');
  test.beforeEach(async ({ page }) => { await loginUser(page, email, pwd); });

  test('17.1 — «Мой бизнес»: свои заявки в каталог со статусами', async ({ page, request }) => {
    const uid = await page.evaluate(() => window._profile && window._profile.id);
    expect(uid).toBeTruthy();
    const pend = await seed(request, 'services', { name: `E2E-MYSUB-P-${Date.now()}`, description: 'mysub', owner_id: uid, status: 'pending_moderation' });
    const appr = await seed(request, 'services', { name: `E2E-MYSUB-A-${Date.now()}`, description: 'mysub', owner_id: uid, status: 'approved' });
    try {
      await page.evaluate(() => window.goPage('profile'));
      await page.evaluate(() => window.showPTab('biz'));
      await expect(page.locator(`.my-sub[data-id="${pend}"]`)).toBeVisible({ timeout: 15000 });
      await expect(page.locator(`.my-sub[data-id="${pend}"]`)).toContainText('модерации');
      await expect(page.locator(`.my-sub[data-id="${appr}"]`)).toContainText('Опубликовано');
    } finally {
      await del(request, 'services', pend);
      await del(request, 'services', appr);
    }
  });

  test('17.2 — «Мои события»: свои заявки на события со статусами', async ({ page, request }) => {
    const uid = await page.evaluate(() => window._profile && window._profile.id);
    expect(uid).toBeTruthy();
    const future = new Date(Date.now() + 10 * 86400000).toISOString();
    const id = await seed(request, 'events', { title: `E2E-MYSUB-EVT-${Date.now()}`, description: 'mysub', canton: 'Zug', event_date: future, created_by: uid, status: 'rejected' });
    expect(id).toBeTruthy();
    try {
      await page.evaluate(() => window.goPage('profile'));
      await page.evaluate(() => window.showPTab('events'));
      await expect(page.locator(`.my-sub[data-id="${id}"]`)).toBeVisible({ timeout: 15000 });
      await expect(page.locator(`.my-sub[data-id="${id}"]`)).toContainText('Отклонено');
    } finally {
      await del(request, 'events', id);
    }
  });
});
