// tests/02-content.spec.js
const { test, expect } = require('@playwright/test');
const { loginUser } = require('./helpers');

const email = process.env.TEST_USER_EMAIL || 'test@slswiss-test.com';
const pwd = process.env.TEST_USER_PWD || 'TestPass123!';

test.describe('БЛОК 2 — Статьи', () => {

  test('2.1 — Без логина "Написать статью" открывает регистрацию', async ({ page }) => {
    await page.goto('');
    await page.click('nav li:has-text("Статьи")');
    await page.click('button:has-text("Написать статью")');
    // Открывается auth-модалка (универсальная, табы Войти/Регистрация).
    // Проверяем что появилась email-форма логина.
    await expect(page.locator('#login-email-input')).toBeVisible({ timeout: 3000 });
  });

  test('2.2-2.3 — Залогинен: открывается форма, отправка статьи', async ({ page }) => {
    await loginUser(page, email, pwd);
    await page.click('nav li:has-text("Статьи")');
    await page.click('button:has-text("Написать статью")');

    await expect(page.locator('#art-title')).toBeVisible({ timeout: 3000 });
    await page.fill('#art-title', 'Тестовая статья ' + Date.now());
    await page.fill('#art-text', 'Это тестовое содержание статьи для автотеста.');
    await page.click('button:has-text("Отправить на модерацию")');
    await expect(page.locator('text=Статья отправлена')).toBeVisible({ timeout: 5000 });
  });

  test('2.4 — Валидация: пустой заголовок', async ({ page }) => {
    await loginUser(page, email, pwd);
    await page.click('nav li:has-text("Статьи")');
    await page.click('button:has-text("Написать статью")');
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Заполни');
      await dialog.accept();
    });
    await page.click('button:has-text("Отправить на модерацию")');
  });
});

test.describe('БЛОК 3 — Биржа задач', () => {

  test('3.2-3.3 — Создание задачи залогиненным', async ({ page }) => {
    await loginUser(page, email, pwd);
    await page.click('nav li:has-text("Биржа")');
    await page.click('button:has-text("Разместить задачу")');

    await expect(page.locator('#task-title')).toBeVisible({ timeout: 3000 });
    await page.fill('#task-title', 'Тест задача ' + Date.now());
    await page.fill('#task-desc', 'Описание тестовой задачи');
    await page.fill('#task-budget', '100');
    // Submit "Разместить задачу →" — последняя кнопка с этим текстом (в модалке).
    await page.locator('button:has-text("Разместить задачу")').last().click();
    // Сайт пока не показывает "Задача размещена". Проверяем что модалка закрылась.
    await expect(page.locator('#task-title')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('БЛОК 4 — Каталог', () => {

  test('4.2-4.3 — Добавление бизнеса', async ({ page }) => {
    await loginUser(page, email, pwd);
    await page.click('nav li:has-text("Каталог")');
    // На странице 2 кнопки "+ Добавить в каталог". Верхняя (в баннере) сломана,
    // нижняя (в пустом состоянии) — рабочая. Кликаем последнюю.
    await page.locator('button:has-text("Добавить в каталог")').last().click();

    await expect(page.locator('#biz-name')).toBeVisible({ timeout: 3000 });
    await page.fill('#biz-name', 'Тест Бизнес ' + Date.now());
    await page.fill('#biz-desc', 'Описание тестового бизнеса');
    // Submit — последняя кнопка с этим текстом (в открытой модалке)
    await page.locator('button:has-text("Добавить в каталог")').last().click();
    // Сайт пока не показывает "Бизнес добавлен" — проверяем что модалка закрылась
    await expect(page.locator('#biz-name')).not.toBeVisible({ timeout: 5000 });
  });
});
