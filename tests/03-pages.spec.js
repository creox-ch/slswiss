// tests/03-pages.spec.js
const { test, expect } = require('@playwright/test');

test.describe('БЛОК 5 — Кантоны', () => {

  test('5.1 — Карта кантонов отображается', async ({ page }) => {
    await page.goto('');
    await page.click('nav li:has-text("Кантоны")');
    await expect(page.locator('#swiss-map-svg')).toBeVisible();
  });

  test.skip('5.5 — Клик на кантон открывает детальную', async ({ page }) => {
    // Деферим: text=Zürich находит 31 элемент (фильтр-пилл, карточки, ссылки и т.д.).
    // Для починки нужны точные селекторы SVG-карты или карточек кантонов.
    // Разкомментировать когда добавим data-testid на SVG-элементы или карточки.
    await page.goto('');
    await page.click('nav li:has-text("Кантоны")');
    await page.click('text=Zürich', { timeout: 5000 });
    await page.waitForTimeout(1000);
  });
});

test.describe('БЛОК 6 — Акции', () => {

  test('6.1 — Замок виден на странице Акций без логина', async ({ page }) => {
    await page.goto('');
    await page.click('nav li:has-text("Акции")');
    await expect(page.locator('#deals-locked')).toBeVisible();
  });

  test('6.3 — Замок НЕ виден на главной', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('#deals-locked')).not.toBeVisible();
  });
});

test.describe('БЛОК 7 — Навигация', () => {

  const pages = ['Афиша', 'Кантоны', 'Каталог', 'Биржа', 'Статьи', 'Акции'];
  for (const name of pages) {
    test(`Открывается раздел: ${name}`, async ({ page }) => {
      await page.goto('');
      await page.click(`nav li:has-text("${name}")`);
      await page.waitForTimeout(500);
    });
  }
});
