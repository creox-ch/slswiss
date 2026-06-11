// tests/helpers.js
const TEST_EMAIL = `test_${Date.now()}@slswiss-test.com`;
const TEST_PASSWORD = 'TestPass123!';

async function registerUser(page, email = TEST_EMAIL, pwd = TEST_PASSWORD) {
  await page.goto('/');
  await page.click('button:has-text("Вступить")');
  await page.fill('#rs1-email', email);
  await page.fill('#rs1-pwd', pwd);
  await page.fill('#rs1-first', 'Test');
  await page.fill('#rs1-last', 'User');
  await page.click('button:has-text("Далее")');
  await page.selectOption('#rs2-canton', 'Zürich');
  await page.fill('#rs2-plz', '8001');
  await page.click('button:has-text("Далее")');
  await page.click('button:has-text("Создать аккаунт")');
  return { email, pwd };
}

async function loginUser(page, email, pwd) {
  await page.goto('/');
  await page.click('button:has-text("Войти")');
  await page.fill('#login-email-input', email);
  await page.fill('#login-pwd-input', pwd);
  await page.click('button:has-text("Войти")');
  await page.waitForTimeout(2000);
}

module.exports = { registerUser, loginUser, TEST_EMAIL, TEST_PASSWORD };
