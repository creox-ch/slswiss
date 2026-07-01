// tests/17-mobile-adaptive.spec.js
// Спринт mobile-adaptive: адаптивность на мобильной ширине + гамбургер-меню.
// Playwright реально эмулирует мобильный viewport (в отличие от Chrome-MCP из Cowork).
const { test, expect } = require('@playwright/test');

async function noHOverflow(page) {
  return page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test.describe('БЛОК 17 — Mobile adaptive (мобильная ширина 390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('17.1 — Главная: нет горизонтального скролла', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('.hero')).toBeVisible();
    expect(await noHOverflow(page)).toBeTruthy();
  });

  test('17.2 — Шапка: гамбургер виден, меню скрыто; тап открывает; переход закрывает', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#nav-burger')).toBeVisible();
    // меню свёрнуто по умолчанию
    await expect(page.locator('nav .nav-links')).toBeHidden();
    // тап по ☰ → меню открылось
    await page.click('#nav-burger');
    await expect(page.locator('nav .nav-links')).toBeVisible();
    // тап по пункту → переход + меню закрылось
    await page.locator('nav .nav-links a', { hasText: 'Кантоны' }).click();
    await expect(page.locator('#page-cantons')).toHaveClass(/active/);
    await expect(page.locator('nav .nav-links')).toBeHidden();
  });

  test('17.3 — Основные экраны без горизонтального скролла', async ({ page }) => {
    await page.goto('');
    for (const nav of ['Каталог', 'Кантоны']) {
      await page.click('#nav-burger');
      await page.locator('nav .nav-links a', { hasText: nav }).click();
      await page.waitForTimeout(300);
      expect(await noHOverflow(page), `overflow на «${nav}»`).toBeTruthy();
    }
  });

  test('17.4 — Hero идёт одной колонкой (не 2)', async ({ page }) => {
    await page.goto('');
    const cols = await page.evaluate(() => {
      const el = document.querySelector('.hero-inner');
      return el ? getComputedStyle(el).gridTemplateColumns : '';
    });
    // одна колонка → одно значение (без пробела между двумя треками)
    expect(cols.trim().split(/\s+/).length).toBe(1);
  });
});

test.describe('БЛОК 17 — Desktop не затронут', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('17.5 — На desktop гамбургер скрыт, меню видно', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#nav-burger')).toBeHidden();
    await expect(page.locator('nav .nav-links')).toBeVisible();
  });
});
