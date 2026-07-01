// tests/11-catalog-display.spec.js
// catalog-display: одобренные (status='approved') заявки показываются на публичных
// страницах — каталог (#biz-grid) и афиша (#afisha-ev). Контракт: docs/contracts/catalog-display.md
//
// Проверяем: approved видно; pending НЕ видно; событие approved видно в афише.
// Публичные страницы — вход не нужен. Сидинг/чистка через service_role (SUPABASE_SERVICE_KEY).

const { test, expect } = require('@playwright/test');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwcmiommviauwzkhkbki.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const hasAdmin = !!SERVICE_KEY;
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

test.describe('БЛОК 16 — Публикация одобренного', () => {
  test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY для сидинга');

  test('16.1 — одобренный бизнес виден в каталоге, pending — нет', async ({ page, request }) => {
    const okName = `E2E-DISP-OK-${Date.now()}`;
    const okId = await seed(request, 'services', { name: okName, description: 'approved biz', category: 'IT', canton: 'Zürich', status: 'approved' });
    const pendId = await seed(request, 'services', { name: `E2E-DISP-PEND-${Date.now()}`, description: 'pending biz', status: 'pending_moderation' });
    expect(okId).toBeTruthy();
    try {
      await page.goto('');
      await page.evaluate(() => window.goPage('catalog'));
      // одобренный отрендерился
      await expect(page.locator(`.biz-card[data-id="${okId}"]`)).toBeVisible({ timeout: 15000 });
      await expect(page.locator(`.biz-card[data-id="${okId}"]`)).toContainText(okName);
      // pending НЕ показан
      await expect(page.locator(`.biz-card[data-id="${pendId}"]`)).toHaveCount(0);
    } finally {
      await del(request, 'services', okId);
      if (pendId) await del(request, 'services', pendId);
    }
  });

  test('16.2 — одобренное событие видно в афише', async ({ page, request }) => {
    const title = `E2E-DISP-EVT-${Date.now()}`;
    const future = new Date(Date.now() + 10 * 86400000).toISOString();
    const id = await seed(request, 'events', { title, description: 'approved event', canton: 'Zug', event_date: future, status: 'approved' });
    expect(id).toBeTruthy();
    try {
      await page.goto('');
      await page.evaluate(() => window.goPage('afisha'));
      await expect(page.locator(`.event-card[data-id="${id}"]`)).toBeVisible({ timeout: 15000 });
      await expect(page.locator(`.event-card[data-id="${id}"]`)).toContainText(title);
    } finally {
      await del(request, 'events', id);
    }
  });
});
