// tests/15-articles-moderation.spec.js
// user-content-moderation: статьи (articles) в статус-модели — форма → pending_moderation →
// панель модерации (с автором + полным текстом, коммент №4) → публикация одобренных на «Статьи».
// Сид/проверка/чистка — service_role (SUPABASE_SERVICE_KEY); панель — админ TEST_USER (is_admin).

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

async function seed(request, data) {
  const res = await request.post(`${SUPABASE_URL}/rest/v1/articles`, {
    headers: { ...adminHeaders(), Prefer: 'return=representation' }, data,
  });
  const rows = res.ok() ? await res.json() : [];
  return rows[0] && rows[0].id;
}
async function status(request, id) {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/articles?id=eq.${id}&select=status`, { headers: adminHeaders() });
  const rows = res.ok() ? await res.json() : [];
  return rows[0] && rows[0].status;
}
async function del(request, id) {
  return request.delete(`${SUPABASE_URL}/rest/v1/articles?id=eq.${id}`, { headers: adminHeaders() });
}

test.describe('БЛОК 21 — Статьи: модерация и публикация', () => {
  test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY');

  test('21.1 — одобренная статья видна на «Статьи», pending — нет', async ({ page, request }) => {
    const okTitle = `E2E-ART-OK-${Date.now()}`;
    const okId = await seed(request, { title: okTitle, topic: 'Документы', content: 'Одобренный текст статьи', author_name: 'Автотест', status: 'approved' });
    const pendId = await seed(request, { title: `E2E-ART-PEND-${Date.now()}`, content: 'pending', status: 'pending_moderation' });
    expect(okId).toBeTruthy();
    try {
      await page.goto('');
      await page.evaluate(() => window.goPage('articles'));
      await expect(page.locator(`.art-card[data-id="${okId}"]`)).toBeVisible({ timeout: 15000 });
      await expect(page.locator(`.art-card[data-id="${okId}"]`)).toContainText(okTitle);
      await expect(page.locator(`.art-card[data-id="${pendId}"]`)).toHaveCount(0);
    } finally {
      await del(request, okId);
      if (pendId) await del(request, pendId);
    }
  });

  test('21.2 — модерация статьи: виден автор, approve → approved', async ({ page, request }) => {
    const id = await seed(request, { title: `E2E-ART-MOD-${Date.now()}`, topic: 'Работа', content: 'Полный текст статьи на модерации', author_name: 'Иван Автор', status: 'pending_moderation' });
    expect(id).toBeTruthy();
    try {
      await loginUser(page, email, pwd);
      await page.evaluate(() => window.openModeration());
      const row = page.locator(`.mod-row[data-id="${id}"]`);
      await expect(row).toBeVisible({ timeout: 15000 });
      await expect(row).toContainText('Иван Автор');        // коммент №4: виден автор
      await expect(row).toContainText('Полный текст статьи'); // полный текст
      await row.locator('.mod-approve').click();
      await expect(row).toHaveCount(0, { timeout: 15000 });
      expect(await status(request, id)).toBe('approved');
    } finally {
      await del(request, id);
    }
  });

  test('21.3 — RLS: аноним НЕ может сменить статус статьи', async ({ request }) => {
    const id = await seed(request, { title: `E2E-ART-RLS-${Date.now()}`, content: 'rls', status: 'pending_moderation' });
    expect(id).toBeTruthy();
    try {
      await request.patch(`${SUPABASE_URL}/rest/v1/articles?id=eq.${id}`, {
        headers: { ...anonHeaders(), Prefer: 'return=representation' }, data: { status: 'approved' },
      });
      expect(await status(request, id)).toBe('pending_moderation');
    } finally {
      await del(request, id);
    }
  });
});
