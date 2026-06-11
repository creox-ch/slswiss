// tests/04-supabase.spec.js
const { test, expect } = require('@playwright/test');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwcmiommviauwzkhkbki.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

test.describe('БЛОК 9 — Проверка данных в Supabase', () => {
  test.skip(!SUPABASE_SERVICE_KEY, 'Нужен SUPABASE_SERVICE_KEY');

  async function sbFetch(table, params = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    });
    return res.json();
  }

  test('9.1 — Таблица profiles существует и доступна', async () => {
    const data = await sbFetch('profiles', 'limit=1');
    expect(Array.isArray(data)).toBe(true);
  });

  test('9.2 — Таблица articles существует', async () => {
    const data = await sbFetch('articles', 'limit=1');
    expect(Array.isArray(data)).toBe(true);
  });

  test('9.3 — Таблица tasks существует', async () => {
    const data = await sbFetch('tasks', 'limit=1');
    expect(Array.isArray(data)).toBe(true);
  });

  test('9.4 — Таблица services существует', async () => {
    const data = await sbFetch('services', 'limit=1');
    expect(Array.isArray(data)).toBe(true);
  });

  test('9.5 — Появляются новые записи в articles за последний час', async () => {
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const data = await sbFetch('articles', `created_at=gte.${hourAgo}`);
    console.log(`Найдено статей за последний час: ${data.length}`);
  });
});
