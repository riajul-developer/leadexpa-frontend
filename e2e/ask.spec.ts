import { expect, test } from "@playwright/test";

test("ask from the palette, check the chips, open the leads", async ({ page }) => {
  await page.goto("/en/inbox");
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible(); // hydrated: the shortcut is live
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Search leads, jump to a page, or ask a question…").fill("overdue leads this week");
  await page.getByRole("option", { name: "Ask: “overdue leads this week”" }).click();

  await expect(page).toHaveURL(/\/en\/ask\?q=overdue/);
  await expect(page.getByRole("heading", { name: "Ask your data", level: 1 })).toBeVisible();
  const chips = page.getByTestId("ask-chips");
  await expect(chips.getByText("Overdue", { exact: true })).toBeVisible();
  await expect(chips.getByLabel("Period")).toHaveValue("this_week");
  await expect(page.getByTestId("ask-count")).toBeVisible();

  await chips.getByRole("button", { name: "Remove Overdue" }).click();
  await expect(chips.getByText("Overdue", { exact: true })).toHaveCount(0);
  await chips.getByLabel("Period").selectOption("");
  await page.getByRole("link", { name: "Open in leads table" }).click();
  await expect(page).toHaveURL(/\/en\/leads/);
});

test("numbers: a campaign ranking, then a breakdown by agent", async ({ page }) => {
  await page.goto(`/en/ask?q=${encodeURIComponent("Which campaign brought the most won leads last month?")}`);
  const chips = page.getByTestId("ask-chips");
  await expect(chips.getByLabel("Answer as")).toHaveValue("metrics");
  await expect(chips.getByText("Top 1 by Won")).toBeVisible();
  await expect(page.getByTestId("ask-totals").getByText("Won")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);

  await chips.getByRole("button", { name: "Remove ranking" }).click();
  await chips.getByLabel("Breakdown").selectOption("owner");
  await expect(page.getByRole("columnheader", { name: "By agent" })).toBeVisible();
  await chips.getByLabel("Add a number").selectOption("contact_rate");
  await expect(page.getByRole("columnheader", { name: "Contact rate" })).toBeVisible();
});

test("Bangla examples and a question it can't answer", async ({ page }) => {
  await page.goto("/bn/ask");
  await page.getByRole("button", { name: "এই সপ্তাহের দেরি হওয়া লিড" }).click();
  await expect(page.getByTestId("ask-chips").getByText("দেরি হওয়া", { exact: true })).toBeVisible();

  await page.goto(`/en/ask?q=${encodeURIComponent("what's the weather tomorrow?")}`);
  await expect(page.getByText("I couldn't turn that into a report.")).toBeVisible();
  await page.goto("/en/ask");
  await expect(page.getByRole("button", { name: "what's the weather tomorrow?" })).toBeVisible();
});
