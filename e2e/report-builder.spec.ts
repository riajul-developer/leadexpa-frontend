import { expect, test } from "@playwright/test";

// Tier 3 custom report builder (step 8g): a widget grid saved as a template, previewed for any client, moved and
// resized (pointer or keyboard), shared as a frozen link without lead data, and emailed on a schedule.

test("start from a layout, add a note, arrange it and save", async ({ page }) => {
  await page.goto("/en/report-builder");
  await expect(page.getByRole("heading", { name: "Report builder", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Monthly client results" }).first()).toBeVisible(); // the demo template
  await page.getByRole("link", { name: /Team performance/ }).click();

  await expect(page).toHaveURL(/\/en\/report-builder\/new\?starter=team/);
  await expect(page.getByLabel("Report name")).toHaveValue("Team performance");
  const board = page.getByRole("list", { name: "Report widgets" });
  await expect(board.locator("[data-testid^=rb-widget-]")).toHaveCount(6);
  await expect(board.getByTestId("rb-kpi").first()).not.toBeEmpty();

  // Preview another client: the numbers rerun.
  await page.getByLabel("Preview for client").selectOption({ label: "Dhaka Dental Care" });
  await expect(board.getByTestId("rb-kpi").first()).toBeVisible();

  // Add a note; its settings open.
  await page.getByRole("button", { name: "Add widget" }).click();
  await page.getByRole("menuitem", { name: /Note/ }).click();
  const sheet = page.getByRole("dialog", { name: "Widget settings" });
  await sheet.getByLabel("Note", { exact: true }).fill("Great month for the front desk team.");
  await sheet.getByLabel("Title").fill("From your account manager");
  await page.keyboard.press("Escape");
  await expect(board.getByText("Great month for the front desk team.")).toBeVisible();

  // Keyboard arranging: arrows move, Shift+arrows resize, and it's announced.
  const grip = page.getByRole("button", { name: "Move From your account manager", exact: true });
  await grip.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.getByText("Now 11 columns wide and 2 rows tall.")).toBeAttached();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByText(/^Moved to column 1, row/)).toBeAttached();

  // A type change reshapes the query: a trend shows numbers by day.
  await page.getByRole("button", { name: "Edit Contact rate", exact: true }).click();
  await sheet.getByLabel("Widget type").selectOption("line");
  await expect(sheet.getByLabel("Breakdown")).toHaveCount(0); // a trend is always by day
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/report-builder\/rbt-/);
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Back to reports" }).click();
  await expect(page.getByRole("link", { name: "Team performance", exact: true })).toBeVisible();
});

test("a widget that doesn't fit its type can't be saved", async ({ page }) => {
  await page.goto("/en/report-builder/new");
  await expect(page.getByText("This report is empty")).toBeVisible();
  await page.getByLabel("Report name").fill("Draft");
  await page.getByRole("button", { name: "Add widget" }).click();
  await page.getByRole("menuitem", { name: /Note/ }).click();
  const sheet = page.getByRole("dialog", { name: "Widget settings" });
  await sheet.getByLabel("Note", { exact: true }).fill("");
  await expect(sheet.getByText("Write the note, or remove the widget.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Widget settings" })).toBeVisible(); // reopened on the problem
  await expect(page).toHaveURL(/\/new$/);
});

test("share a frozen link: counts, never leads", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/report-builder/rbt-demo");
  await expect(page.getByLabel("Report name")).toHaveValue("Monthly client results");
  await page.getByRole("button", { name: "Share" }).click();
  const dialog = page.getByRole("dialog", { name: "Share this report" });
  await dialog.getByLabel("Client").selectOption({ label: "Bashundhara Homes" });
  await dialog.getByLabel("Page language").selectOption("bn");
  await dialog.getByRole("button", { name: "Create link" }).click();
  const url = await dialog.getByLabel("Link").inputValue();
  expect(url).toMatch(/\/bn\/rb\/mock-rb-/);

  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Monthly client results", level: 1 })).toBeVisible();
  await expect(page.getByText(/Bashundhara Homes ·/)).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Monthly client results" }).locator("[data-testid^=rb-widget-]"),
  ).toHaveCount(8);
  await expect(page.getByRole("button", { name: "প্রিন্ট বা PDF হিসেবে সেভ" })).toBeVisible();

  await page.goto("/en/rb/mock-rb-nope");
  await expect(page.getByText("This report link doesn't exist or has expired.")).toBeVisible();
});

test("email it monthly, send a test, pause", async ({ page }) => {
  await page.goto("/en/report-builder/rbt-demo");
  await page.getByRole("button", { name: "Email schedule" }).click();
  const sheet = page.getByRole("dialog", { name: /Email schedule/ });
  await expect(sheet.getByText("This report isn't emailed to anyone yet.")).toBeVisible();

  await sheet.getByLabel("Client").selectOption({ label: "Dhaka Dental Care" });
  await sheet.getByLabel("Recipients").fill("not-an-email");
  await sheet.getByRole("button", { name: "Add schedule" }).click();
  await expect(sheet.getByText("Enter 1 to 10 valid email addresses.")).toBeVisible();
  await sheet.getByLabel("Recipients").fill("Owner@Clinic.test, owner@clinic.test, boss@clinic.test");
  await sheet.getByLabel("Email language").selectOption("bn");
  await sheet.getByRole("button", { name: "Add schedule" }).click();

  const row = sheet.getByTestId("rb-schedule");
  await expect(row).toHaveCount(1);
  await expect(row.getByText("owner@clinic.test, boss@clinic.test")).toBeVisible();
  await expect(row.getByText("Monthly")).toBeVisible();

  await row.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText("Report sent to its recipients.")).toBeVisible();
  await expect(sheet.getByText("Emailed", { exact: false })).toBeVisible(); // history

  await row.getByRole("button", { name: "Pause" }).click();
  await expect(row.getByText("Paused", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Resume" }).click();
  await expect(row.getByText("Paused", { exact: true })).toHaveCount(0);
});
