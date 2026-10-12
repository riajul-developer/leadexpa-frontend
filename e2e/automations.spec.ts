import { expect, test } from "@playwright/test";

// FRONTEND_PROMPT 17.5: the automation rules builder — When / If / Then, test on a lead, simulate on history,
// the execution log ("why did/didn't it fire") and version history with a diff.

test("rules are listed under Automation and can be switched off and on", async ({ page }) => {
  await page.goto("/en/automations");
  await expect(page.getByRole("heading", { level: 1, name: "Automations" })).toBeVisible();
  await expect(page.getByText("Meta implant leads → best closer")).toBeVisible();
  await expect(page.getByText("When a lead arrives · 2 conditions · then Assign, Add tags, Notify")).toBeVisible();
  const toggle = page.getByRole("switch", { name: "Rule “Meta implant leads → best closer” on" });
  await toggle.click();
  await expect(page.getByText("Rule switched off")).toBeVisible();
  await toggle.click();
  await expect(page.getByText("Rule switched on")).toBeVisible();
});

test("build a rule, test it on a lead and simulate it", async ({ page }) => {
  await page.goto("/en/automations/new");
  await page.getByLabel("Name", { exact: true }).fill("New Meta leads → rotation");
  await page.getByLabel("When").selectOption("lead.created");
  await expect(page.getByLabel("Field of condition 1")).toHaveValue("lead.source_kind");
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await page.getByRole("button", { name: "Add condition" }).click();
  await page.getByLabel("Field of condition 2").selectOption("lead.stage");

  // Nothing runs while trying it.
  await page.getByLabel("Search a lead by name or phone").fill("01");
  await page.getByRole("region", { name: "Test on a lead" }).getByRole("button").first().click();
  await expect(page.getByText(/^Would (not )?run$/)).toBeVisible();
  await expect(page.getByText("the lead has", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.getByText(/of 42 events would have run the rule/)).toBeVisible();

  await page.getByRole("button", { name: "Create (switched off)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New Meta leads → rotation" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Rule “New Meta leads → rotation” on" })).not.toBeChecked();
});

test("the log explains why a rule did or didn't run; history shows what changed", async ({ page }) => {
  await page.goto("/en/automations");
  await page.getByRole("link", { name: "Meta implant leads → best closer" }).click();
  await page.getByRole("tab", { name: "Log" }).click();
  const log = page.getByRole("list", { name: "Log" });
  await expect(log.getByText("Ran").first()).toBeVisible();
  await log.getByRole("button").filter({ hasText: "Conditions not met" }).first().click();
  await expect(page.getByText("the lead has web_form")).toBeVisible();
  await expect(page.getByLabel("false").first()).toBeVisible();

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Changes from version 1 to 2")).toBeVisible();
  await expect(page.getByText("+ ", { exact: false }).first()).toBeVisible();
});
