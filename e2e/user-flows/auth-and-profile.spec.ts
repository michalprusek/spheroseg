/**
 * E2E tests for authentication and user profile management
 * 
 * Tests registration, login, password reset, and profile updates
 */

import { test, expect } from '@playwright/test';

// Test constants
const NEW_USER = {
  email: `test_${Date.now()}@example.com`,
  password: 'SecurePassword123!',
  name: 'Test User',
};

test.describe('Authentication Flow', () => {
  test('should complete full registration flow', async ({ page }) => {
    // Navigate to registration
    await page.goto('/register');
    
    // Fill registration form
    await page.fill('input[name="name"]', NEW_USER.name);
    await page.fill('input[name="email"]', NEW_USER.email);
    await page.fill('input[name="password"]', NEW_USER.password);
    await page.fill('input[name="confirmPassword"]', NEW_USER.password);
    
    // Accept terms
    await page.click('label:has-text("I agree to the Terms of Service")');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Verify welcome message
    await expect(page.locator('[data-testid="welcome-banner"]'))
      .toContainText(`Welcome, ${NEW_USER.name}`);
    
    // Verify email verification prompt
    await expect(page.locator('[data-testid="verify-email-prompt"]'))
      .toContainText('Please verify your email');
  });

  test('should validate registration form', async ({ page }) => {
    await page.goto('/register');
    
    // Test empty form submission
    await page.click('button[type="submit"]');
    
    // Verify error messages
    await expect(page.locator('[data-testid="name-error"]'))
      .toContainText('Name is required');
    await expect(page.locator('[data-testid="email-error"]'))
      .toContainText('Email is required');
    await expect(page.locator('[data-testid="password-error"]'))
      .toContainText('Password is required');
    
    // Test invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="email-error"]'))
      .toContainText('Invalid email address');
    
    // Test weak password
    await page.fill('input[name="password"]', '123');
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="password-error"]'))
      .toContainText('Password must be at least 8 characters');
    
    // Test password mismatch
    await page.fill('input[name="password"]', 'ValidPassword123!');
    await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="confirmPassword-error"]'))
      .toContainText('Passwords do not match');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.fill('input[name="password"]', 'testuser123');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await expect(page).toHaveURL('/dashboard');
    
    // Verify user menu
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should handle login errors', async ({ page }) => {
    await page.goto('/login');
    
    // Test invalid credentials
    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="login-error"]'))
      .toContainText('Invalid email or password');
    
    // Test account lockout after multiple attempts
    for (let i = 0; i < 5; i++) {
      await page.click('button[type="submit"]');
    }
    
    await expect(page.locator('[data-testid="login-error"]'))
      .toContainText('Account temporarily locked');
  });

  test('should handle password reset flow', async ({ page }) => {
    // Navigate to forgot password
    await page.goto('/login');
    await page.click('a:has-text("Forgot password?")');
    
    // Enter email
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.click('button:has-text("Send Reset Link")');
    
    // Verify success message
    await expect(page.locator('[data-testid="reset-success"]'))
      .toContainText('Password reset link sent');
    
    // Simulate clicking reset link (in real test, would intercept email)
    const resetToken = 'mock-reset-token';
    await page.goto(`/reset-password?token=${resetToken}`);
    
    // Enter new password
    const newPassword = 'NewSecurePassword123!';
    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);
    await page.click('button:has-text("Reset Password")');
    
    // Verify redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid="password-reset-success"]'))
      .toContainText('Password reset successful');
    
    // Verify can login with new password
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.fill('input[name="password"]', newPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should maintain session across browser refresh', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.fill('input[name="password"]', 'testuser123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Navigate away and back
    await page.goto('/');
    await page.goto('/dashboard');
    
    // Should still have access
    await expect(page).toHaveURL('/dashboard');
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.fill('input[name="password"]', 'testuser123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');
    
    // Verify redirect to home
    await expect(page).toHaveURL('/');
    
    // Try to access protected route
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login?redirect=%2Fdashboard');
  });
});

test.describe('User Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.fill('input[name="password"]', 'testuser123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should update profile information', async ({ page }) => {
    // Navigate to profile
    await page.click('[data-testid="user-menu"]');
    await page.click('a:has-text("Profile")');
    
    // Update basic info
    await page.fill('input[name="name"]', 'Updated Name');
    await page.fill('input[name="bio"]', 'This is my bio');
    await page.fill('input[name="organization"]', 'Test Organization');
    await page.fill('input[name="location"]', 'Test City');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Verify success
    await expect(page.locator('[data-testid="save-success"]'))
      .toContainText('Profile updated successfully');
    
    // Refresh and verify persistence
    await page.reload();
    
    await expect(page.locator('input[name="name"]')).toHaveValue('Updated Name');
    await expect(page.locator('input[name="bio"]')).toHaveValue('This is my bio');
  });

  test('should upload and change avatar', async ({ page }) => {
    // Navigate to profile
    await page.click('[data-testid="user-menu"]');
    await page.click('a:has-text("Profile")');
    
    // Upload avatar
    const fileInput = page.locator('input[type="file"][name="avatar"]');
    await fileInput.setInputFiles('./e2e/fixtures/avatar.jpg');
    
    // Wait for upload
    await expect(page.locator('[data-testid="avatar-upload-progress"]'))
      .toHaveAttribute('data-complete', 'true');
    
    // Verify avatar updated
    await expect(page.locator('[data-testid="user-avatar"]'))
      .toHaveAttribute('src', /avatar/);
    
    // Remove avatar
    await page.click('button:has-text("Remove Avatar")');
    
    // Confirm removal
    await page.click('button:has-text("Confirm")');
    
    // Verify avatar removed
    await expect(page.locator('[data-testid="user-avatar"]'))
      .toHaveAttribute('src', /default-avatar/);
  });

  test('should change password', async ({ page }) => {
    // Navigate to security settings
    await page.click('[data-testid="user-menu"]');
    await page.click('a:has-text("Settings")');
    await page.click('a:has-text("Security")');
    
    // Fill password change form
    await page.fill('input[name="currentPassword"]', 'testuser123');
    await page.fill('input[name="newPassword"]', 'NewTestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'NewTestPassword123!');
    
    // Submit
    await page.click('button:has-text("Change Password")');
    
    // Verify success
    await expect(page.locator('[data-testid="password-change-success"]'))
      .toContainText('Password changed successfully');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');
    
    // Login with new password
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.fill('input[name="password"]', 'NewTestPassword123!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
  });

  test('should manage notification preferences', async ({ page }) => {
    // Navigate to notifications settings
    await page.click('[data-testid="user-menu"]');
    await page.click('a:has-text("Settings")');
    await page.click('a:has-text("Notifications")');
    
    // Toggle email notifications
    await page.click('label:has-text("Email notifications")');
    await page.click('label:has-text("Project updates")');
    await page.click('label:has-text("Segmentation complete")');
    
    // Toggle in-app notifications
    await page.click('label:has-text("Browser notifications")');
    
    // Save preferences
    await page.click('button:has-text("Save Preferences")');
    
    // Verify saved
    await expect(page.locator('[data-testid="preferences-saved"]'))
      .toContainText('Preferences saved');
    
    // Test notification
    await page.click('button:has-text("Test Notification")');
    
    // Verify test notification appears
    await expect(page.locator('[data-testid="notification-toast"]'))
      .toContainText('Test notification');
  });

  test('should delete account', async ({ page }) => {
    // Create a test account first
    const testEmail = `delete_test_${Date.now()}@example.com`;
    
    // Register new account
    await page.goto('/register');
    await page.fill('input[name="name"]', 'Delete Test');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    await page.click('label:has-text("I agree")');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to account deletion
    await page.click('[data-testid="user-menu"]');
    await page.click('a:has-text("Settings")');
    await page.click('a:has-text("Account")');
    
    // Scroll to danger zone
    await page.locator('[data-testid="danger-zone"]').scrollIntoViewIfNeeded();
    
    // Click delete account
    await page.click('button:has-text("Delete Account")');
    
    // Confirm deletion
    await page.fill('input[placeholder="Type DELETE to confirm"]', 'DELETE');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Delete My Account")');
    
    // Verify redirect to home
    await expect(page).toHaveURL('/');
    
    // Try to login with deleted account
    await page.goto('/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    // Should show error
    await expect(page.locator('[data-testid="login-error"]'))
      .toContainText('Invalid email or password');
  });
});

test.describe('Two-Factor Authentication', () => {
  test('should enable and use 2FA', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.fill('input[name="password"]', 'testuser123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to security settings
    await page.click('[data-testid="user-menu"]');
    await page.click('a:has-text("Settings")');
    await page.click('a:has-text("Security")');
    
    // Enable 2FA
    await page.click('button:has-text("Enable Two-Factor Authentication")');
    
    // Verify QR code displayed
    await expect(page.locator('[data-testid="2fa-qr-code"]')).toBeVisible();
    
    // Enter verification code (in real test, would use authenticator)
    await page.fill('input[name="verificationCode"]', '123456');
    await page.click('button:has-text("Verify and Enable")');
    
    // Save backup codes
    const backupCodes = await page.locator('[data-testid="backup-codes"]').textContent();
    await page.click('button:has-text("I\'ve saved my backup codes")');
    
    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');
    
    // Login again
    await page.fill('input[name="email"]', 'testuser@test.com');
    await page.fill('input[name="password"]', 'testuser123');
    await page.click('button[type="submit"]');
    
    // Should prompt for 2FA code
    await expect(page.locator('[data-testid="2fa-prompt"]')).toBeVisible();
    
    // Enter 2FA code
    await page.fill('input[name="twoFactorCode"]', '123456');
    await page.click('button:has-text("Verify")');
    
    // Should be logged in
    await expect(page).toHaveURL('/dashboard');
  });
});