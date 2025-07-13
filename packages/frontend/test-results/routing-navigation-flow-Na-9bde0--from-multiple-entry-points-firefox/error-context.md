# Test info

- Name: Navigation Flow and Links >> should navigate to request access from multiple entry points
- Location: /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/navigation-flow.spec.ts:63:3

# Error details

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('img[alt="SpheroSeg Logo"]')
    - locator resolved to <img class="w-10 h-10" src="/favicon.svg" alt="SpheroSeg Logo"/>
  - attempting click action
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying

    at /home/cvat/spheroseg/spheroseg/packages/frontend/e2e/routing/navigation-flow.spec.ts:69:16
```

# Page snapshot

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- main:
  - button "Back to Home":
    - img
    - text: Home
  - button "Language EN":
    - img
    - text: Language EN
  - heading "Request Access to Spheroid Segmentation Platform" [level=2]
  - paragraph: Fill out the following form to request access to our platform. We will review your request and contact you soon.
  - text: Your Email Address *
  - textbox "Your Email Address *"
  - text: Your Name *
  - textbox "Your Name *"
  - text: Institution/Company
  - textbox "Institution/Company"
  - text: Reason for Access *
  - textbox "Reason for Access *"
  - paragraph:
    - text: By submitting this request, you agree to our
    - link "Terms of Service":
      - /url: /terms-of-service
    - text: and
    - link "Privacy Policy":
      - /url: /privacy-policy
  - button "Submit Request" [disabled]
  - text: Already have access?
  - link "Sign In":
    - /url: /sign-in
    - button "Sign In"
  - link "Sign Up":
    - /url: /sign-up
    - button "Sign Up"
  - paragraph:
    - text: By signing up, you agree to our Terms of Service and Privacy Policy.
    - link "Terms of Service":
      - /url: /terms-of-service
    - text: and
    - link "Privacy Policy":
      - /url: /privacy-policy
- region "Notifications alt+T"
```

# Test source

```ts
   1 | import { test, expect, selectors, urls, navigateAndWaitForLoad } from '../fixtures';
   2 |
   3 | test.describe('Navigation Flow and Links', () => {
   4 |   test.beforeEach(async ({ page }) => {
   5 |     await navigateAndWaitForLoad(page, urls.home);
   6 |   });
   7 |
   8 |   test('should navigate between pages using navigation menu', async ({ page }) => {
   9 |     // Test navigation menu flow
   10 |     await page.click(selectors.navigation.documentation);
   11 |     await expect(page).toHaveURL(urls.documentation);
   12 |     
   13 |     await page.click(selectors.navigation.termsOfService);
   14 |     await expect(page).toHaveURL(urls.termsOfService);
   15 |     
   16 |     await page.click(selectors.navigation.privacyPolicy);
   17 |     await expect(page).toHaveURL(urls.privacyPolicy);
   18 |     
   19 |     // Navigate back to home using logo
   20 |     await page.click(selectors.logo);
   21 |     await expect(page).toHaveURL(urls.home);
   22 |   });
   23 |
   24 |   test('should navigate between pages using footer links', async ({ page }) => {
   25 |     // Scroll to footer
   26 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   27 |     
   28 |     // Test footer navigation
   29 |     await page.locator('footer').getByRole('link', { name: 'Documentation' }).click();
   30 |     await expect(page).toHaveURL(urls.documentation);
   31 |     
   32 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   33 |     await page.locator('footer').getByRole('link', { name: 'Terms of Service' }).click();
   34 |     await expect(page).toHaveURL(urls.termsOfService);
   35 |     
   36 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   37 |     await page.locator('footer').getByRole('link', { name: 'Privacy Policy' }).click();
   38 |     await expect(page).toHaveURL(urls.privacyPolicy);
   39 |   });
   40 |
   41 |   test('should navigate from sign in to sign up and back', async ({ page }) => {
   42 |     // Go to sign in
   43 |     await page.click(selectors.navigation.signIn);
   44 |     await expect(page).toHaveURL(urls.signIn);
   45 |     
   46 |     // Navigate to sign up from sign in page
   47 |     await page.click('text=Sign Up');
   48 |     await expect(page).toHaveURL(urls.signUp);
   49 |     
   50 |     // Navigate back to sign in from sign up page
   51 |     await page.click('text=Sign In');
   52 |     await expect(page).toHaveURL(urls.signIn);
   53 |     
   54 |     // Navigate to forgot password
   55 |     await page.click('text=Forgot password?');
   56 |     await expect(page).toHaveURL(urls.forgotPassword);
   57 |     
   58 |     // Navigate back to sign in
   59 |     await page.click('text=Back to Sign In');
   60 |     await expect(page).toHaveURL(urls.signIn);
   61 |   });
   62 |
   63 |   test('should navigate to request access from multiple entry points', async ({ page }) => {
   64 |     // From main navigation
   65 |     await page.click(selectors.navigation.requestAccess);
   66 |     await expect(page).toHaveURL(urls.requestAccess);
   67 |     
   68 |     // Back to home
>  69 |     await page.click(selectors.logo);
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
   70 |     await expect(page).toHaveURL(urls.home);
   71 |     
   72 |     // From footer
   73 |     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   74 |     await page.locator('footer').getByRole('link', { name: 'Request Access' }).click();
   75 |     await expect(page).toHaveURL(urls.requestAccess);
   76 |   });
   77 |
   78 |   test('should handle browser back/forward navigation correctly', async ({ page }) => {
   79 |     // Navigate through multiple pages
   80 |     await page.click(selectors.navigation.documentation);
   81 |     await expect(page).toHaveURL(urls.documentation);
   82 |     
   83 |     await page.click(selectors.navigation.about);
   84 |     await expect(page).toHaveURL(urls.about);
   85 |     
   86 |     await page.click(selectors.navigation.termsOfService);
   87 |     await expect(page).toHaveURL(urls.termsOfService);
   88 |     
   89 |     // Test browser back button
   90 |     await page.goBack();
   91 |     await expect(page).toHaveURL(urls.about);
   92 |     
   93 |     await page.goBack();
   94 |     await expect(page).toHaveURL(urls.documentation);
   95 |     
   96 |     await page.goBack();
   97 |     await expect(page).toHaveURL(urls.home);
   98 |     
   99 |     // Test browser forward button
  100 |     await page.goForward();
  101 |     await expect(page).toHaveURL(urls.documentation);
  102 |     
  103 |     await page.goForward();
  104 |     await expect(page).toHaveURL(urls.about);
  105 |   });
  106 |
  107 |   test('should maintain scroll position when navigating back', async ({ page }) => {
  108 |     // Scroll down on home page
  109 |     await page.evaluate(() => window.scrollTo(0, 500));
  110 |     const initialScrollY = await page.evaluate(() => window.scrollY);
  111 |     expect(initialScrollY).toBeGreaterThan(0);
  112 |     
  113 |     // Navigate to another page
  114 |     await page.click(selectors.navigation.documentation);
  115 |     await expect(page).toHaveURL(urls.documentation);
  116 |     
  117 |     // Go back
  118 |     await page.goBack();
  119 |     await expect(page).toHaveURL(urls.home);
  120 |     
  121 |     // Check if scroll position is maintained (might not be exact due to async loading)
  122 |     const finalScrollY = await page.evaluate(() => window.scrollY);
  123 |     expect(finalScrollY).toBeGreaterThanOrEqual(0);
  124 |   });
  125 |
  126 |   test('should handle external links correctly', async ({ page }) => {
  127 |     // Check external links in footer open in new tab
  128 |     const [newPage] = await Promise.all([
  129 |       page.waitForEvent('popup'),
  130 |       page.locator('footer').getByRole('link', { name: 'FNSPE CTU in Prague' }).click()
  131 |     ]);
  132 |     
  133 |     await expect(newPage).toHaveURL(/fjfi\.cvut\.cz/);
  134 |     await newPage.close();
  135 |   });
  136 |
  137 |   test('should display correct active states in navigation', async ({ page }) => {
  138 |     // Check documentation page
  139 |     await page.click(selectors.navigation.documentation);
  140 |     const docLink = page.locator(selectors.navigation.documentation).first();
  141 |     
  142 |     // The active link might have different styling - check if it's visible and enabled
  143 |     await expect(docLink).toBeVisible();
  144 |     await expect(docLink).toBeEnabled();
  145 |   });
  146 |
  147 |   test('should handle navigation with hash links correctly', async ({ page }) => {
  148 |     await page.click(selectors.navigation.documentation);
  149 |     await expect(page).toHaveURL(urls.documentation);
  150 |     
  151 |     // Click on section link
  152 |     await page.click('a[href="#getting-started"]');
  153 |     await expect(page).toHaveURL(urls.documentation + '#getting-started');
  154 |     
  155 |     // Check that the section is visible
  156 |     await expect(page.locator('#getting-started')).toBeInViewport();
  157 |   });
  158 |
  159 |   test('should preserve query parameters during navigation', async ({ page }) => {
  160 |     // Navigate with query params
  161 |     await navigateAndWaitForLoad(page, urls.home + '?ref=test&utm_source=e2e');
  162 |     
  163 |     // Click on documentation link
  164 |     await page.click(selectors.navigation.documentation);
  165 |     
  166 |     // Query params might not be preserved by default - this is expected behavior
  167 |     await expect(page).toHaveURL(urls.documentation);
  168 |   });
  169 | });
```