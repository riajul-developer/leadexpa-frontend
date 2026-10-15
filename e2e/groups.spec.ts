import { expect, test } from "@playwright/test";

// Holding groups (G7e): the group's owner sees one report across its agencies, adds people and makes invite
// codes; an agency's owner leaves and joins from Settings › Holding group.

test("a holding group's report, people and invite code", async ({ page }) => {
  await page.goto("/en/groups");
  await expect(page.getByRole("heading", { name: "Holding groups" })).toBeVisible();
  await page
    .getByTestId("groups")
    .getByRole("link", { name: /Bright Holdings/ })
    .click();
  await expect(page.getByRole("heading", { name: "Bright Holdings" })).toBeVisible();

  // Totals come from summed counts: 40 won of 120 decided is 33 %, not the average of 38 % and 25 %.
  const table = page.getByTestId("group-report");
  await expect(table.getByRole("rowheader", { name: "Bright Skin Clinic" })).toBeVisible();
  const total = table.getByRole("row", { name: /Group total/ });
  await expect(total).toContainText("200");
  await expect(total).toContainText("33%");
  await expect(page.getByText("Speed to lead is shown per agency", { exact: false })).toBeVisible();

  // Only owners and admins of member agencies can be added.
  await page
    .getByRole("combobox", { name: "Add someone" })
    .selectOption({ label: "Farhan Kabir (Bright Skin Clinic)" });
  await page.getByRole("button", { name: "Add as analyst" }).click();
  await expect(page.getByText("Added. They can now see the group's report.")).toBeVisible();
  await expect(page.getByTestId("group-people").getByText("Farhan Kabir")).toBeVisible();
  // The last owner can't step down.
  await page.getByRole("combobox", { name: "Role for সাদিয়া ইসলাম" }).selectOption("analyst");
  await expect(page.getByText("A group needs at least one owner.")).toBeVisible();

  // An invite code is shown once.
  await page.getByRole("button", { name: "Make a code" }).click();
  const created = page.getByTestId("group-invite-created");
  await expect(created.getByText("grp_mockInviteCode123")).toBeVisible();
  await expect(page.getByTestId("group-invites")).toContainText("Open code, expires");
});

test("an agency's owner leaves its group and joins again with a code", async ({ page }) => {
  await page.goto("/en/settings/group");
  const card = page.getByTestId("agency-group");
  await expect(card).toContainText("Bright Holdings");
  page.once("dialog", (d) => void d.accept());
  await card.getByRole("button", { name: "Leave group" }).click();
  await expect(page.getByText("This agency left the group.")).toBeVisible();

  const code = page.getByRole("textbox", { name: "Group code" });
  await code.fill("grp_wrong");
  await page.getByRole("button", { name: "Join group" }).click();
  await expect(page.getByText("This code isn't valid or has expired.", { exact: false })).toBeVisible();
  await code.fill("grp_mockInviteCode123");
  await page.getByRole("button", { name: "Join group" }).click();
  await expect(page.getByText("This agency joined Bright Holdings.")).toBeVisible();
  await expect(page.getByTestId("agency-group")).toContainText("Bright Holdings");
});
