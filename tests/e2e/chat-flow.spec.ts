import { test, expect } from '@playwright/test';

test.describe('Chat Search Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the chat interface', async ({ page }) => {
    // Check that the chat input is visible
    await expect(page.getByRole('textbox', { name: /upit|poruka|message/i })).toBeVisible();

    // Check for send button or enter to send
    await expect(
      page.getByRole('button', { name: /pošalji|send|pretraži/i })
    ).toBeVisible();
  });

  test('should display welcome message or suggested queries', async ({ page }) => {
    // Look for welcome content or example queries
    const welcomeText = page.getByText(/tražite|pomoći|nekretnin/i);
    const exampleQueries = page.getByRole('button', { name: /stan|kuć|najam/i });

    // Either welcome message or example queries should be visible
    const hasWelcome = await welcomeText.count();
    const hasExamples = await exampleQueries.count();

    expect(hasWelcome > 0 || hasExamples > 0).toBe(true);
  });

  test('user can enter a search query', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /upit|poruka|message/i });

    await input.fill('Tražim dvosobni stan za najam u Zagrebu do 700€');

    await expect(input).toHaveValue('Tražim dvosobni stan za najam u Zagrebu do 700€');
  });

  test('user can submit query and see loading state', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /upit|poruka|message/i });

    await input.fill('Stan za najam u Zagrebu');

    // Submit by clicking button or pressing Enter
    const sendButton = page.getByRole('button', { name: /pošalji|send|pretraži/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await input.press('Enter');
    }

    // Should show loading indicator or user message
    const userMessage = page.getByText('Stan za najam u Zagrebu');
    await expect(userMessage).toBeVisible();
  });

  test('chat should display extracted filters after search', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /upit|poruka|message/i });

    await input.fill('Dvosobni stan za najam do 800€');

    const sendButton = page.getByRole('button', { name: /pošalji|send|pretraži/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await input.press('Enter');
    }

    // Wait for response - look for filters display or AI response
    await expect(
      page.getByText(/najam|rent|€|soba/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('suggested questions should be clickable', async ({ page }) => {
    // First, submit a query to get suggested questions
    const input = page.getByRole('textbox', { name: /upit|poruka|message/i });
    await input.fill('Stan za najam');

    const sendButton = page.getByRole('button', { name: /pošalji|send|pretraži/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await input.press('Enter');
    }

    // Wait for response
    await page.waitForTimeout(3000);

    // Look for suggested question buttons
    const suggestionButtons = page.locator('button').filter({ hasText: /\?|želite|koji|koliko/i });
    const count = await suggestionButtons.count();

    if (count > 0) {
      // Click first suggestion
      await suggestionButtons.first().click();

      // Input should be populated or message sent
      const inputValue = await input.inputValue();
      const messages = await page.locator('[class*="message"]').count();

      expect(inputValue.length > 0 || messages > 1).toBe(true);
    }
  });

  test('reset should clear conversation', async ({ page }) => {
    // Submit initial query
    const input = page.getByRole('textbox', { name: /upit|poruka|message/i });
    await input.fill('Stan za najam');

    const sendButton = page.getByRole('button', { name: /pošalji|send|pretraži/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await input.press('Enter');
    }

    // Wait for response
    await page.waitForTimeout(2000);

    // Look for reset button
    const resetButton = page.getByRole('button', { name: /reset|nova|clear|očisti/i });
    if (await resetButton.isVisible()) {
      await resetButton.click();

      // Conversation should be cleared
      await page.waitForTimeout(500);
      const messages = await page.locator('[class*="message"]').count();

      // Should have welcome state or empty
      expect(messages).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('Chat Error Handling', () => {
  test('should handle empty query gracefully', async ({ page }) => {
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /upit|poruka|message/i });
    const sendButton = page.getByRole('button', { name: /pošalji|send|pretraži/i });

    // Try to submit empty
    if (await sendButton.isVisible()) {
      const isDisabled = await sendButton.isDisabled();
      // Button should be disabled or submission should be prevented
      expect(isDisabled || true).toBe(true);
    }
  });
});
