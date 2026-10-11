import { expect, test } from "@playwright/test";

// Manager and admin flows on mock data (FRONTEND_PROMPT §12 E2E 6, 7).

test("dashboard shows server KPIs with definitions and data coverage", async ({ page }) => {
  await page.goto("/bn/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "ড্যাশবোর্ড" })).toBeVisible();
  await expect(page.getByText("প্রাপ্ত লিড").first()).toBeVisible();
  await expect(page.getByText(/ফলাফল রেকর্ড আছে|কোনো বন্ধ লিড নেই/).first()).toBeVisible();
  // Period picker lives in the URL.
  await page.getByRole("radio", { name: "৭ দিন" }).click();
  await expect(page).toHaveURL(/period=7d/);
});

test("create a client report and a share link", async ({ page }) => {
  await page.goto("/bn/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).click();
  await page.getByRole("main").getByRole("link", { name: "রিপোর্ট" }).click();
  await page.getByRole("button", { name: "নতুন রিপোর্ট" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("সমস্যা ও পরামর্শ").fill("ইমপ্লান্ট বিজ্ঞাপন সবচেয়ে ভালো করছে।");
  await dialog.getByRole("button", { name: "রিপোর্ট তৈরি করুন" }).click();
  await expect(page.getByText("প্রস্তুতকারী Demo Digital Agency")).toBeVisible();
  await expect(page.getByText("ইমপ্লান্ট বিজ্ঞাপন সবচেয়ে ভালো করছে।")).toBeVisible();
  await page.getByRole("button", { name: "লিংক তৈরি করুন" }).click();
  await expect(page.getByRole("textbox", { name: "শেয়ার লিংক" })).toHaveValue(/\/bn\/r\//);
  // The PDF renders in the background and the page polls for it.
  await expect(page.getByRole("link", { name: "PDF ডাউনলোড করুন" })).toBeVisible({ timeout: 15_000 });
});

test("pipeline columns and keyboard-accessible drag handles", async ({ page }) => {
  await page.goto("/bn/pipeline");
  for (const stage of ["নতুন", "যোগাযোগ হয়েছে", "যোগ্য", "বিক্রি হয়েছে", "হারানো"]) {
    await expect(page.getByRole("region", { name: stage })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /সরান$/ }).first()).toBeVisible();
});

test("SLA policy editor previews the deadline in plain language", async ({ page }) => {
  await page.goto("/bn/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).click();
  await page.getByRole("link", { name: "SLA ও সময়" }).click();
  await page.getByRole("radio", { name: /দ্রুত/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "যোগাযোগ করতে হবে" })).toBeVisible();
});
