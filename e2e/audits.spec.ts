import { expect, test } from "@playwright/test";

test("start an audit with consent, load the log, see the report and its assumptions", async ({ page }) => {
  await page.goto("/en/audits");
  await expect(page.getByRole("heading", { name: "Lead Leakage Audits", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "New audit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Prospect's business").fill("Glow Dental Banani");
  await dialog.getByLabel("Country code").fill("BD");
  await dialog.getByLabel("Who agreed").fill("Dr. Nusrat");
  await dialog.getByLabel("Their email").fill("nusrat@glow.test");
  await expect(dialog.getByRole("button", { name: "Start the audit" })).toBeDisabled();
  await dialog.getByRole("checkbox").click();
  await dialog.getByRole("button", { name: "Start the audit" }).click();

  await expect(page.getByRole("heading", { name: "Glow Dental Banani", level: 1 })).toBeVisible();
  await page.locator("#audit-csv").setInputFiles({
    name: "log.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("created_at,responded_at,status,source\n2026-10-01 10:00,2026-10-01 10:40,open,facebook\n"),
  });
  await expect(page.getByTestId("audit-import")).toContainText("212 added");
  const report = page.getByTestId("audit-report");
  await expect(report.getByText("Never answered").first()).toBeVisible();
  await expect(page.getByTestId("fix-plan")).toContainText("Answer every lead.");
  await expect(page.getByTestId("assumptions")).toContainText("a typical range for");
  await expect(page.getByTestId("assumptions")).toContainText("No deal value was given");
  await expect(page.getByTestId("lost-revenue")).toHaveCount(0);

  await page.getByLabel("Deal value, low (BDT)").fill("5000");
  await page.getByLabel("Deal value, high (BDT)").fill("15000");
  await page.getByRole("button", { name: "Update the report" }).click();
  await expect(page.getByTestId("lost-revenue")).toBeVisible();
  await expect(page.getByTestId("assumptions")).toContainText("the range entered for this business");

  await page.getByRole("button", { name: "Share the report" }).click();
  await expect(page.getByText("Link for the prospect:")).toBeVisible();
});

test("the prospect's report link", async ({ page }) => {
  await page.goto("/en/audit/mock-audit-audit-smile");
  await expect(page.getByRole("heading", { name: "Lead Leakage Audit: Smile Clinic Uttara" })).toBeVisible();
  await expect(page.getByText("Prepared by", { exact: false })).toBeVisible();
  await expect(page.getByTestId("assumptions")).toBeVisible();
  await page.goto("/bn/audit/nope");
  await expect(page.getByRole("heading", { name: "এই রিপোর্ট লিংকটি নেই।" })).toBeVisible();
});

test("a business review: linked numbers, edits checked, approve and share", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.locator("main").getByRole("link", { name: "Business reviews", exact: true }).click();
  await page.getByRole("button", { name: "Draft a review" }).click();
  const doc = page.getByTestId("review-document");
  await expect(doc.locator('[data-fact="leads.current"]')).toHaveText("184");
  await expect(doc.locator('[data-fact="leads.current"]')).toHaveAttribute("title", "Leads received · this period");

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByTestId("review-editor");
  await editor.getByLabel("Headline").fill("Leads up 18% this month");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor.getByRole("alert")).toContainText("Typed number");
  await editor.getByLabel("Headline").fill("Leads up");
  await editor.getByLabel("Headline").focus();
  await editor.getByLabel("Insert a number").selectOption("leads.change");
  await expect(editor.getByLabel("Headline")).toHaveValue("Leads up {{leads.change}}");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. Approve it again before sharing.")).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("button", { name: "Share with the client" }).click();
  await expect(page.getByText("Link for the client:")).toBeVisible();
});
