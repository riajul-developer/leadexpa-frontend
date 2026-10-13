import { expect, test } from "@playwright/test";

// FRONTEND_PROMPT 17.12 (step 7c): the AI agent console: a prominent kill switch, the approval queue, the live
// monitor with transcript, take-over and review; and per client: autonomy with confirmations and eval gates,
// guardrails, the knowledge base and evals.

test("approval queue, live monitor, take-over and the kill switch", async ({ page }) => {
  await page.goto("/en/agent");
  await expect(page.getByRole("heading", { name: "AI agent", level: 1 })).toBeVisible();
  const kill = page.getByRole("region", { name: "Kill switch" });
  await expect(kill.getByText("AI agents are running")).toBeVisible();

  // Approve one draft (edited), discard the other.
  const cards = page.locator("[data-draft]");
  await expect(cards).toHaveCount(2);
  await expect(cards.first().getByText("Are you open on Friday?")).toBeVisible();
  await cards.first().getByRole("textbox").fill("We're closed on Fridays. See you Saturday from 10am!");
  await cards.first().getByRole("button", { name: "Send edited" }).click();
  await expect(page.getByText("Sent", { exact: true })).toBeVisible();
  await cards.first().getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText("Nothing waiting for approval")).toBeVisible();

  // Live conversations: the hand-off reason, the transcript, take-over and a quality rating.
  await page.getByRole("tab", { name: "Live conversations" }).click();
  await expect(page.getByText("Asked for a person").first()).toBeVisible();
  await expect(page.getByText("Stopped by a guardrail: a price not in the knowledge base")).toBeVisible();
  await page.getByRole("group", { name: "Filter" }).getByRole("button", { name: "AI replying" }).click();
  await page.locator("[data-conversation]").first().getByRole("button").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("You're chatting with an AI assistant", { exact: false })).toBeVisible();
  await sheet.getByRole("button", { name: "Take over" }).click();
  await expect(page.getByText("It's yours now.", { exact: false })).toBeVisible();
  await sheet.getByRole("radio", { name: "4 out of 5" }).click();
  await expect(page.getByText("Thanks for the review")).toBeVisible();
  await page.keyboard.press("Escape");

  // The kill switch, with a confirmation.
  page.once("dialog", (d) => void d.accept());
  await kill.getByRole("button", { name: "Stop all agents" }).click();
  await expect(kill.getByText("All AI agents are stopped")).toBeVisible();
  await kill.getByRole("button", { name: "Start agents again" }).click();
  await expect(kill.getByText("AI agents are running")).toBeVisible();
});

test("client agent settings: autonomy gate, evals, guardrails and knowledge", async ({ page }) => {
  await page.goto("/en/clients");
  await page.getByRole("link", { name: "Dhaka Dental Care" }).first().click();
  await page.locator("main").getByRole("link", { name: "AI agent", exact: true }).click();
  await expect(page.getByRole("radio", { name: /L1 · Approve/ })).toHaveAttribute("aria-checked", "true");

  // Bangla hasn't passed its eval: autonomy can't go above Approve yet.
  await page.getByRole("radio", { name: /L3 · Qualify/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, turn it on" }).click();
  await expect(page.getByText("Run and pass the evals for every language first.")).toBeVisible();

  await page.locator('[data-eval="bn"]').getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("BN: passed")).toBeVisible();
  await expect(page.locator('[data-case="injection"]')).toContainText("Ignores a prompt injection");
  await page.getByRole("radio", { name: /L3 · Qualify/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, turn it on" }).click();
  await expect(page.getByText("Autonomy set to Qualify")).toBeVisible();
  await expect(page.getByRole("radio", { name: /L3 · Qualify/ })).toHaveAttribute("aria-checked", "true");

  // Guardrails and knowledge.
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByRole("textbox", { name: "Key" }).last().fill("budget");
  await page.getByRole("textbox", { name: "Question" }).last().fill("What budget do you have in mind?");
  await page.getByRole("button", { name: "Save guardrails" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add knowledge" }).click();
  const dialog = page.getByRole("dialog", { name: "Add knowledge" });
  await dialog.getByLabel("Title").fill("Payment options");
  await dialog.getByLabel("Text").fill("We accept bKash, cards and cash. Installments are available for implants.");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(page.locator('[data-doc="Payment options"]')).toBeVisible();
  await page.getByLabel("Test a question").fill("Are you open on Friday?");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("Friday closed.", { exact: false })).toBeVisible();
});
