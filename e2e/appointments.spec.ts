import { expect, test, type Page } from "@playwright/test";

async function firstLeadId(page: Page) {
  await page.goto("/en/appointments");
  const link = page.locator("main a[href*='/leads/']").first();
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href")) ?? "";
  return href.split("/leads/")[1]!;
}

test("client booking rules: hours, hosts, reminders and rooms", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.locator("main").getByRole("link", { name: "Booking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Booking" }).first()).toBeVisible();
  await expect(page.locator('[data-day="fri"]').getByText("Closed")).toBeVisible();
  await page.locator('[data-day="fri"]').getByRole("checkbox").click();
  await expect(page.getByRole("textbox", { name: "Friday from" }).or(page.getByLabel("Friday from"))).toBeVisible();
  await page.getByLabel("Length (minutes)").fill("45");
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved")).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill("Treatment room 1");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Treatment room 1")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Treatment room 1 in use" })).toBeChecked();
});

test("book from the lead page, then record the outcome and read the funnel", async ({ page }) => {
  const leadId = await firstLeadId(page);
  await expect(page.getByRole("heading", { name: "Show-rate funnel" })).toBeVisible();
  await expect(page.getByText("Show rate", { exact: true }).first()).toBeVisible();

  const needs = page.getByRole("group", { name: /^Did .+ come\?$/ });
  const before = await needs.count();
  expect(before).toBeGreaterThan(0);
  await needs.first().getByRole("button", { name: "Came" }).click();
  await expect(needs).toHaveCount(before - 1);

  await page.goto(`/en/leads/${leadId}`);
  await page.getByRole("tab", { name: "Sales" }).first().click();
  const card = page.getByTestId("lead-appointments").first();
  await expect(card.getByRole("heading", { name: "Appointments" })).toBeVisible();
  await card.getByRole("button", { name: "Book", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radiogroup", { name: "Time" }).getByRole("radio").first().click();
  await dialog.getByLabel("Reminder language").selectOption("bn");
  await dialog.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByText(/^Booked for .+\. The lead gets a confirmation\.$/)).toBeVisible();
  await expect(card.getByText("Booked by the team").first()).toBeVisible();
});

test("the lead books, confirms, moves and cancels from their links", async ({ page }) => {
  const leadId = await firstLeadId(page);
  await page.goto(`/en/book/mock-book-${leadId}`);
  await expect(page.getByRole("heading", { name: /Book a Consultation with/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Book this time" })).toBeDisabled();
  await page.getByRole("radiogroup", { name: "Available times" }).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Book this time" }).click();

  await expect(page).toHaveURL(/\/en\/appt\/mock-appt-/);
  await expect(page.getByRole("status")).toContainText("You're booked.");
  await page.getByRole("button", { name: "I'll be there" }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Change the time" }).click();
  // Another day: late in the day, today may have no other time left.
  await page.getByRole("tab").nth(1).click();
  await page.getByRole("radiogroup", { name: "Available times" }).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Move to this time" }).click();
  await expect(page.getByText("Booked", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Cancel the appointment" }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change the time" })).toHaveCount(0);
});

test("an unknown link says so", async ({ page }) => {
  await page.goto("/en/appt/not-a-token");
  await expect(page.getByRole("heading", { name: "We couldn't find this appointment." })).toBeVisible();
  await page.goto("/bn/book/not-a-token");
  await expect(page.getByRole("heading", { name: "এই বুকিং লিংকের মেয়াদ শেষ। নতুন লিংক চেয়ে নিন।" })).toBeVisible();
});

test("connect a calendar and come back in your own language, then disconnect", async ({ page }) => {
  await page.goto("/bn/settings/calendar");
  await expect(page.getByRole("heading", { name: "আপনার ক্যালেন্ডার" })).toBeVisible();
  await page.getByRole("button", { name: "Google Calendar যুক্ত করুন" }).click();
  await expect(page).toHaveURL(/\/bn\/settings\/calendar$/);
  await expect(page.getByText("যুক্ত", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "বিচ্ছিন্ন করুন" }).click();
  await expect(page.getByText("ক্যালেন্ডার বিচ্ছিন্ন হয়েছে")).toBeVisible();
  await expect(page.getByRole("button", { name: "Microsoft 365 যুক্ত করুন" })).toBeVisible();
});
