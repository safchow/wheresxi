import { expect, test } from '@playwright/test'

const TEST_USER = {
  id: 'user_theme_test',
  username: 'theme-tester',
  name: 'Theme Tester',
  email: null,
  role: 'USER',
  credits: 1250,
  bankruptcies: 0,
  createdAt: '2026-05-06T00:00:00.000Z',
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: TEST_USER }),
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('wheresxi-token', 'test-token')
  })
})

test('persists light mode from the wallet dropdown in a cookie', async ({
  context,
  page,
}) => {
  await page.goto('/rules')

  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: /1,250 cr/i }).click()
  await page.getByRole('menuitem', { name: /switch to light mode/i }).click()

  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(
    page.getByRole('menuitem', { name: /switch to dark mode/i }),
  ).toBeVisible()

  await expect
    .poll(async () => {
      const cookie = (await context.cookies()).find(
        ({ name }) => name === 'wheresxi-theme',
      )
      return cookie?.value
    })
    .toBe('light')

  await page.reload()

  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.getByRole('button', { name: /1,250 cr/i }).click()
  await expect(
    page.getByRole('menuitem', { name: /switch to dark mode/i }),
  ).toBeVisible()
})
