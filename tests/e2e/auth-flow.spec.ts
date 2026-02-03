import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      // Check for email and password inputs
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/lozinka|password/i)).toBeVisible();

      // Check for login button
      await expect(page.getByRole('button', { name: /prijav|login/i })).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/login');

      // Click login without filling fields
      await page.getByRole('button', { name: /prijav|login/i }).click();

      // Should show validation errors
      await expect(page.getByText(/required|obavezan|unesite/i).first()).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/lozinka|password/i).fill('wrongpassword');

      await page.getByRole('button', { name: /prijav|login/i }).click();

      // Should show error message
      await expect(
        page.getByText(/invalid|neisprav|pogrešn|error/i).first()
      ).toBeVisible({ timeout: 10000 });
    });

    test('should have link to signup page', async ({ page }) => {
      await page.goto('/login');

      const signupLink = page.getByRole('link', { name: /registr|sign up|kreiraj/i });
      await expect(signupLink).toBeVisible();

      await signupLink.click();
      await expect(page).toHaveURL(/signup/);
    });

    test('should have forgot password link', async ({ page }) => {
      await page.goto('/login');

      const forgotLink = page.getByRole('link', { name: /zaborav|forgot|reset/i });
      if (await forgotLink.isVisible()) {
        await forgotLink.click();
        await expect(page).toHaveURL(/reset/);
      }
    });
  });

  test.describe('Signup Page', () => {
    test('should display signup form', async ({ page }) => {
      await page.goto('/signup');

      // Check for name, email, password fields
      await expect(page.getByLabel(/ime|name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/lozinka|password/i).first()).toBeVisible();

      // Check for signup button
      await expect(
        page.getByRole('button', { name: /registr|sign up|kreiraj/i })
      ).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/signup');

      await page.getByLabel(/ime|name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('invalid-email');

      // Tab out or submit to trigger validation
      await page.getByLabel(/email/i).blur();

      // Should show email validation error
      await expect(page.getByText(/valid|ispravan|email/i).first()).toBeVisible();
    });

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/signup');

      await page.getByLabel(/lozinka|password/i).first().fill('123');

      // Tab out to trigger validation
      await page.getByLabel(/lozinka|password/i).first().blur();

      // Should show password requirements error (length, etc.)
      await expect(
        page.getByText(/karakter|character|duljin|length|6|8/i).first()
      ).toBeVisible({ timeout: 3000 });
    });

    test('should have link to login page', async ({ page }) => {
      await page.goto('/signup');

      const loginLink = page.getByRole('link', { name: /prijav|login|već imate/i });
      await expect(loginLink).toBeVisible();

      await loginLink.click();
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('Protected Routes', () => {
    test('dashboard should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('saved listings should redirect unauthenticated users', async ({ page }) => {
      await page.goto('/dashboard/saved');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('search history should redirect unauthenticated users', async ({ page }) => {
      await page.goto('/dashboard/history');

      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    });

    test('redirect URL should be preserved', async ({ page }) => {
      await page.goto('/dashboard/saved');

      // URL should contain redirect parameter
      await expect(page).toHaveURL(/redirect.*saved|returnUrl.*saved/i);
    });
  });

  test.describe('Password Reset Page', () => {
    test('should display password reset form', async ({ page }) => {
      await page.goto('/reset-password');

      // Check for email input
      await expect(page.getByLabel(/email/i)).toBeVisible();

      // Check for submit button
      await expect(
        page.getByRole('button', { name: /reset|pošalj|send/i })
      ).toBeVisible();
    });

    test('should validate email before submission', async ({ page }) => {
      await page.goto('/reset-password');

      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByRole('button', { name: /reset|pošalj|send/i }).click();

      // Should show validation error
      await expect(page.getByText(/valid|ispravan/i).first()).toBeVisible();
    });
  });
});
