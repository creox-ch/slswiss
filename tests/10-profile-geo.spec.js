// tests/10-profile-geo.spec.js
// Баг/фикс: при регистрации canton/plz не доходят до profiles (триггер не копирует их
// из user_metadata), профиль показывает пустые кантон/PLZ. Фикс — backfillProfileGeo():
// при загрузке профиля, если в БД пусто, взять из user_metadata и до-записать в profiles.
//
// Тест: создаём подтверждённого юзера через admin-API с метаданными canton/plz →
// обнуляем canton/plz в его profiles (воспроизводим баг) → логинимся через UI →
// профиль должен показать canton/plz (бэкфилл) и до-записать их в БД.
// Требует SUPABASE_SERVICE_KEY (admin). Без него — skip.

const { test, expect } = require('@playwright/test');
const { loginUser, openProfileSettings } = require('./helpers');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwcmiommviauwzkhkbki.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const hasAdmin = !!SERVICE_KEY;
const PWD = 'TestPass123!';
const uniqueEmail = () => `geo_${Date.now()}_${Math.floor(Math.random() * 1000)}@slswiss-test.com`;

const adminHeaders = () => ({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' });

async function adminCreateUser(request, email) {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: adminHeaders(),
    data: {
      email, password: PWD, email_confirm: true,
      user_metadata: { first_name: 'Geo', last_name: 'Test', canton: 'Zürich', plz: '8001' },
    },
  });
  return res.ok() ? res.json() : null;
}
async function adminDelete(request, id) {
  return request.delete(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: adminHeaders() });
}
async function nullProfileGeo(request, id) {
  return request.patch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    data: { canton: null, plz: null },
  });
}
async function getProfileGeo(request, id) {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=canton,plz`, { headers: adminHeaders() });
  const rows = res.ok() ? await res.json() : [];
  return rows[0] || {};
}

// ─────────────────────────────────────────────────────────────
// БЛОК 15 — Профиль: кантон/PLZ из метаданных (бэкфилл)
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 15 — Профиль: canton/plz из метаданных', () => {
  test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY (admin)');

  test('15.1 — после входа профиль показывает canton/plz (бэкфилл)', async ({ page, request }) => {
    const email = uniqueEmail();
    let userId = null;
    try {
      // 1) подтверждённый юзер с метаданными canton=Zürich, plz=8001
      const user = await adminCreateUser(request, email);
      expect(user && user.id).toBeTruthy();
      userId = user.id;
      // 2) воспроизвести баг: обнулить canton/plz в profiles (строку создал триггер)
      await nullProfileGeo(request, userId);
      // 3) вход через UI
      await loginUser(page, email, PWD);
      // 4) профиль показывает кантон/PLZ — восстановлены бэкфиллом из метаданных
      await openProfileSettings(page);
      await expect(page.locator('#prof-canton')).toHaveValue('Zürich');
      await expect(page.locator('#prof-plz')).toHaveValue('8001');
      // 5) бэкфилл также до-записал их в БД
      const geo = await getProfileGeo(request, userId);
      expect(geo.canton).toBe('Zürich');
      expect(geo.plz).toBe('8001');
    } finally {
      if (userId) await adminDelete(request, userId);
    }
  });
});
