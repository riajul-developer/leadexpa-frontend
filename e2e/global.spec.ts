import { expect, test, type Page } from "@playwright/test";

// GLOBAL_PROMPT §5 (G0): the app works right-to-left in Arabic, every main route renders in the pseudo-locale
// without missing or broken messages, and country-dependent inputs behave.

const ROUTES = [
  "/inbox",
  "/leads",
  "/pipeline",
  "/dashboard",
  "/clients",
  "/integrations",
  "/settings/profile",
  "/settings/security",
];

/** next-intl reports missing keys and ICU errors on the console; any of them fails the page. */
function watchMessages(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (/MISSING_MESSAGE|FORMATTING_ERROR|INVALID_MESSAGE/.test(m.text())) problems.push(m.text().slice(0, 200));
  });
  return problems;
}

test("Arabic renders right-to-left without horizontal overflow", async ({ page }) => {
  const problems = watchMessages(page);
  await page.goto("/ar/inbox");
  await expect(page.getByRole("heading", { level: 1, name: "صندوق الوارد" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  // The sidebar sits on the right in RTL.
  const nav = await page.getByRole("navigation", { name: "التنقل الرئيسي" }).first().boundingBox();
  const width = page.viewportSize()!.width;
  expect(nav && nav.x + nav.width / 2).toBeGreaterThan(width / 2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(problems).toEqual([]);
});

for (const route of ROUTES) {
  test(`pseudo-locale renders ${route}`, async ({ page }) => {
    const problems = watchMessages(page);
    await page.goto(`/en-XA${route}`);
    const h1 = page.locator("h1").first();
    await h1.waitFor();
    // Every catalog string is wrapped in [...]: plain text here would be a hard-coded string.
    await expect(h1).toHaveText(/^\[.+\]$/);
    await page.waitForLoadState("networkidle");
    expect(problems).toEqual([]);
  });
}

test("native digits follow the profile preference", async ({ page }) => {
  await page.goto("/ar/settings/profile");
  await page.getByLabel("الأرقام").selectOption("native");
  // In-app navigation: the mock API keeps state in the page, so a reload would forget the preference.
  await page.getByRole("link", { name: "لوحة المؤشرات" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main")).toContainText(/[٠-٩]/);
});

test("signup preselects the country from the browser timezone", async ({ page }) => {
  await page.goto("/en/signup");
  // The project's timezone is Asia/Dhaka.
  await expect(page.getByLabel("Country")).toHaveValue("BD");
  await page.getByLabel("Country").selectOption("AE");
  await expect(page.getByLabel("Country")).toHaveValue("AE");
});

test("quick add puts a foreign number in international form", async ({ page }) => {
  await page.goto("/en/inbox");
  await page.getByRole("button", { name: "Add a lead" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Country code").selectOption("AE");
  await dialog.getByLabel("Phone", { exact: true }).fill("050 123 4567");
  await dialog.getByRole("button", { name: "Add lead" }).click();
  await expect(page).toHaveURL(/\/en\/leads\//);
  await expect(page.locator("main")).toContainText("+971501234567");
});

test("the eye button shows and hides a password without leaving the field", async ({ page }) => {
  await page.goto("/en/login");
  const field = page.getByLabel("Password", { exact: true });
  const eye = page.getByRole("button", { name: "Show password" });
  await field.fill("DemoPass#2026");
  await expect(field).toHaveAttribute("type", "password");
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await field.focus();
  await eye.click();
  await expect(field).toHaveAttribute("type", "text");
  await expect(field).toHaveValue("DemoPass#2026");
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await expect(field).toBeFocused();
  await eye.click();
  await expect(field).toHaveAttribute("type", "password");
});
