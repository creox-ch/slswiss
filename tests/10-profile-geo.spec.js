// tests/10-profile-geo.spec.js
// Баг/фикс: при регистрации canton/plz не доходят до profiles (триггер не копирует их
// из user_metadata), поэтому профиль показывает пустые кантон/PLZ. Фикс — код-фоллбэк
// backfillProfileGeo(): при загрузке профиля, если в БД пусто, взять из user_metadata
// и до-записать в profiles.
//
// Тест воспроизводит баг детерминированно: регистрируем (метаданные canton/plz есть) →
// подтверждаем через admin-API → ОБНУЛЯЕМ canton/plz в profiles → логинимся →
// профиль должен снова показать canton/plz (бэкфилл из метаданных).
// Требует SUPABASE_SERVICE_KEY (admin). Без него — skip.

const { test, expect } = require('@playwright/test');
const { registerUser, loginUser, openProfileSettings } = require('./helpers');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwcmiommviauwzkhkbki.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const hasAdmin = !!SERVICE_KEY;
const PWD = 'TestPass123!';
const uniqueEmail = () => `geo_${Date.now()}_${Math.floor(Math.random() * 1000)}@slswiss-test.com`;

const adminHeaders = () => ({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' });
async function adminFindUser(request, email) {
  const res = await request.get(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: adminHeaders() });
  if (!res.ok()) return null;
  const body = await res.json();
  return (body.users || body || []).find((u) => u.email === email) || null;
}
async function adminConfirm(request, id) {
  return request.put(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: adminHeaders(), data: { email_confirm: true } });
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
// БЛОК 15 — Профиль: кантон/PLZ после регистрации
// ─────────────────────────────────────────────────────────────
test.describe('БЛОК 15 — Профиль: canton/plz из метаданных', () => {
  test.skip(!hasAdmin, 'нужен SUPABASE_SERVICE_KEY (admin)');

  test('15.1 — после входа профиль показывает canton/plz (бэкфилл)', async ({ page, request }) => {
    const email = uniqueEmail();
    let userId = null;
    try {
      // 1) регистрация — helper заполняет canton=Zürich, plz=8001 (попадают в user_metadata)
      await registerUser(page, email, PWD);
      const user = await adminFindUser(request, email);
      expect(user).toBeTruthy();
      userId = user.id;
      // 2) подтвердить email (иначе не залогиниться)
      await adminConfirm(request, userId);
      // 3) воспроизвести баг: обнулить canton/plz в profiles
      await nullProfileGeo(request, userId);
      // 4) вход
      await loginUser(page, email, PWD);
      // 5) профиль показывает кантон/PLZ (восстановлены бэкфиллом из метаданных)
      await openProfileSettings(page);
      await expect(page.locator('#prof-canton')).toHaveValue('Zürich');
      await expect(page.locator('#prof-plz')).toHaveValue('8001');
      // 6) бэкфилл также до-записал их в БД
      const geo = await getProfileGeo(request, userId);
      expect(geo.canton).toBe('Zürich');
      expect(geo.plz).toBe('8001');
    } finally {
      if (userId) await adminDelete(request, userId);
    }
  });
});
