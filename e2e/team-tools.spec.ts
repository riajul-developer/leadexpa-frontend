import { expect, test } from "@playwright/test";

// Tier 3 team tools (step 8h): opt-in coaching that compares you only with yourself, a sales-floor TV paired by
// a kiosk link (counts only, dims at night, opt-in leaderboard), and live presence on a lead.

test("coaching is opt-in and private", async ({ page }) => {
  await page.goto("/en/progress");
  await expect(page.getByRole("heading", { name: "My progress", level: 1 })).toBeVisible();
  await expect(page.getByText("Private: your numbers are yours. Managers don't see this page.")).toBeVisible();
  await page.getByRole("button", { name: "Turn on" }).click();

  await expect(page.getByTestId("coaching-highlight")).toHaveText("Last week was your fastest yet. Nice work!");
  await expect(page.getByTestId("coaching-streak")).toHaveText("4 days");
  await expect(page.getByText("Best: 6 days")).toBeVisible();
  await expect(page.getByText("Personal best week")).toBeVisible();

  await page.getByRole("button", { name: "Turn off coaching" }).click();
  await expect(page.getByRole("button", { name: "Turn on" })).toBeVisible();
});

test("create a TV screen, pair it, see the board, unpair it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/wallboards");
  await expect(page.getByRole("heading", { name: "TV screens", level: 1 })).toBeVisible();
  await expect(page.getByText("No TV screens yet")).toBeVisible();

  await page.getByRole("button", { name: "New screen" }).click();
  const form = page.getByRole("dialog", { name: "New screen" });
  await form.getByLabel("Name").fill("Floor TV");
  await form.getByLabel("Dhaka Dental Care").check();
  await form.getByLabel("Switch client every").selectOption("30");
  await form.getByRole("button", { name: "Create screen" }).click();

  const pair = page.getByRole("dialog", { name: "Pair a TV" });
  await expect(pair.getByRole("img", { name: "QR code for the TV link" })).toBeVisible();
  await expect(pair.getByText("This link is shown once.", { exact: false })).toBeVisible();
  const link = await pair.getByLabel("TV link", { exact: true }).inputValue();
  expect(link).toMatch(/\/tv#k=wb_mock-/);
  const tvLink = link.replace(/\/(bn|ar|en)\/tv/, "/en/tv"); // the demo agency's language is Bangla

  // The TV: token taken from the fragment, kept, and removed from the address bar.
  await page.goto(tvLink);
  await expect(page.getByRole("heading", { name: "Floor TV", level: 1 })).toBeVisible();
  await expect(page).not.toHaveURL(/#k=/);
  await expect(page.getByTestId("tv-overdue")).toBeVisible();
  await expect(page.getByTestId("tv-client").getByRole("heading", { name: "Dhaka Dental Care" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Floor TV", level: 1 })).toBeVisible(); // still paired

  await page.goto("/en/wallboards");
  const row = page.getByTestId("wallboard-row");
  await expect(row.getByText("Floor TV")).toBeVisible();
  await expect(row.getByText("On now")).toBeVisible();
  await expect(row.getByText("Dhaka Dental Care · rotates every 30s", { exact: false })).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await row.getByRole("button", { name: "Delete Floor TV" }).click();
  await expect(page.getByText("No TV screens yet")).toBeVisible();

  await page.goto("/bn/tv");
  await expect(page.getByRole("heading", { name: "এই স্ক্রিন যুক্ত নেই" })).toBeVisible();
});

test("the leaderboard shows only people who opted in", async ({ page }) => {
  await page.goto("/en/wallboards");
  await page.getByRole("button", { name: "New screen" }).click();
  const form = page.getByRole("dialog", { name: "New screen" });
  await form.getByLabel("Name").fill("Team TV");
  await form.getByRole("switch", { name: "Dim at night" }).click(); // off: always bright for the test
  await form.getByRole("button", { name: "Create screen" }).click();
  const link = (
    await page.getByRole("dialog", { name: "Pair a TV" }).getByLabel("TV link", { exact: true }).inputValue()
  ).replace(/\/(bn|ar|en)\/tv/, "/en/tv");

  await page.goto(link);
  const board = page.getByRole("region", { name: "Fastest today" });
  await expect(board.getByRole("listitem")).toHaveCount(1);
  await page.goto("/en/progress");
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByTestId("coaching-streak")).toBeVisible();
  await page.goto(link.replace(/#.*/, ""));
  await expect(page.getByRole("region", { name: "Fastest today" }).getByRole("listitem")).toHaveCount(2);
});

test("presence: who else is on the lead", async ({ page }) => {
  await page.goto("/en/appointments"); // lists leads as links
  const href = (await page.locator("main a[href*='/leads/']").first().getAttribute("href")) ?? "";
  await page.goto(href.replace(/^\/(en|bn|ar)/, "/en"));
  await expect(page).toHaveURL(/\/en\/leads\/[^/]+$/);
  const here = page.getByTestId("lead-presence");
  await expect(here.getByText("Tanvir Ahmed is also here")).toBeVisible();
  await expect(here.getByRole("group", { name: "1 teammate here" })).toBeVisible();
});
