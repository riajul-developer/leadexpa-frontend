import { expect, test } from "@playwright/test";

test("connect a custom portal domain: records to add, verify, failures explained", async ({ page }) => {
  await page.goto("/en/settings/branding");
  await expect(page.getByRole("heading", { name: "Your own portal address" })).toBeVisible();
  await expect(page.getByText("No domain connected.", { exact: false })).toBeVisible();

  const host = page.getByRole("textbox", { name: "Domain", exact: true });
  await host.fill("leadexpa.app");
  await page.getByRole("button", { name: "Connect domain" }).click();
  await expect(page.getByText("Enter a domain you own, like portal.youragency.com.")).toBeVisible();

  await host.fill("https://Portal.Bright.test/login");
  await page.getByRole("button", { name: "Connect domain" }).click();
  const list = page.getByTestId("custom-domains");
  await expect(list.getByText("portal.bright.test", { exact: true }).first()).toBeVisible();
  await expect(list.getByText("Waiting for DNS")).toBeVisible();
  await expect(list.getByText("_leadexpa-challenge.portal.bright.test")).toBeVisible();
  await expect(list.getByText("domains.leadexpa.app")).toBeVisible();

  await list.getByRole("button", { name: "Verify now" }).click();
  await expect(page.getByText("Verified. It is live.")).toBeVisible();
  await expect(list.getByText("Verified", { exact: true })).toBeVisible();
  await expect(list.getByRole("link", { name: "Open" })).toHaveAttribute("href", "https://portal.bright.test");

  await host.fill("wrong.bright.test");
  await page.getByRole("button", { name: "Connect domain" }).click();
  const wrong = list.getByRole("listitem").filter({ hasText: "wrong.bright.test" });
  await wrong.getByRole("button", { name: "Verify now" }).click();
  await expect(wrong.getByText("Needs attention")).toBeVisible();
  await expect(wrong.getByText("The domain doesn't point to us yet: check the CNAME record.")).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await wrong.getByRole("button", { name: "Remove wrong.bright.test" }).click();
  await expect(list.getByText("wrong.bright.test")).toHaveCount(0);
});

test("send client email from the agency's domain: SPF, DKIM and DMARC", async ({ page }) => {
  await page.goto("/en/settings/branding");
  await expect(page.getByRole("heading", { name: "Send client email from your domain" })).toBeVisible();
  await page.getByRole("textbox", { name: "Address" }).fill("team");
  await page.getByRole("textbox", { name: "Email domain" }).fill("bright.test");
  await page.getByRole("button", { name: "Add domain" }).click();
  const list = page.getByTestId("sender-domains");
  await expect(list.getByText("team@bright.test")).toBeVisible();
  await expect(list.getByText("v=spf1 include:_spf.leadexpa.app ~all")).toBeVisible();
  await expect(list.getByText("leadexpa._domainkey.bright.test")).toBeVisible();
  await expect(list.getByText("_dmarc.bright.test")).toBeVisible();
  await list.getByRole("button", { name: "Verify now" }).click();
  await expect(list.getByText("Client email now comes from this address.")).toBeVisible();
});

test("domain settings in Bangla", async ({ page }) => {
  await page.goto("/bn/settings/branding");
  await expect(page.getByRole("heading", { name: "আপনার নিজের পোর্টাল ঠিকানা" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "আপনার ডোমেইন থেকে ক্লায়েন্টদের ইমেইল পাঠান" })).toBeVisible();
});
