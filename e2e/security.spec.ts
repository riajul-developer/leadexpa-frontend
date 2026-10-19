import { expect, test, type Page } from "@playwright/test";

// Mock: 123456 is every app code; "mfa@…" has 2FA; "+gate" triggers the agency gate.

async function signIn(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("DemoPass#2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function setUpAuthenticatorApp(page: Page) {
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  await expect(page.getByText("JBSW Y3DP EHPK 3PXP", { exact: false })).toBeVisible();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "k7m2p-x9q4r" })).toBeVisible();
  const done = page.getByRole("button", { name: "Done" });
  await expect(done).toBeDisabled();
  await page.getByRole("checkbox", { name: "I've saved these codes" }).check();
  await done.click();
}

test("a password alone asks for the second step", async ({ page }) => {
  await signIn(page, "mfa@demo.recov.local");
  await expect(page.getByRole("heading", { name: "Two-step sign-in" })).toBeVisible();
  const code = page.getByLabel("Code from your authenticator app");
  await code.fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code or passkey didn't work. Try again.")).toBeVisible();
  await page.getByRole("button", { name: "Use a recovery code" }).click();
  await expect(page.getByLabel("Recovery code")).toBeVisible();
  await page.getByRole("button", { name: "Use the authenticator app" }).click();
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/en\/inbox/);
});

test("security settings: authenticator app, recovery codes and other devices", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/en/settings/security");
  const twoStep = page.locator("section", { hasText: "Authenticator app" });
  await expect(page.getByText("Off", { exact: true })).toBeVisible();
  await twoStep.getByRole("button", { name: "Set up" }).click();
  await expect(page.getByRole("dialog", { name: "Set up an authenticator app" })).toBeVisible();
  await setUpAuthenticatorApp(page);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("On", { exact: true })).toBeVisible();
  await expect(page.getByText("10 codes left")).toBeVisible();
  await expect(page.getByText("Authenticator app added")).toBeVisible();

  const devices = page.locator("li", { hasText: "Last active" });
  await expect(page.getByText("This device")).toBeVisible();
  await expect(devices.filter({ hasText: "Safari on iOS" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out other devices" }).click();
  await expect(page.getByText("1 device signed out")).toBeVisible();
  await expect(devices).toHaveCount(0);
});

test("an agency that requires two-step sign-in gates the app until it's set up", async ({ page }) => {
  await signIn(page, "owner+gate@demo.recov.local");
  await expect(page.getByRole("heading", { name: "Demo Digital Agency requires two-step sign-in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Use an authenticator app" }).click();
  await setUpAuthenticatorApp(page);
  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
});

test("turning on the admin policy needs your own two-step sign-in first", async ({ page }) => {
  await page.goto("/en/settings/agency");
  await page.getByRole("switch", { name: "Require two-step sign-in for owners and admins" }).click();
  await expect(page.getByText("Turn on two-step sign-in for your own account first")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Require two-step sign-in for owners and admins" })).not.toBeChecked();
});
