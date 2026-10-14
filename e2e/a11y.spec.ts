import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// WCAG 2.2 AA (FRONTEND_PROMPT §10): zero serious/critical axe violations on every main route, every locale.
const ROUTES = [
  "/inbox",
  "/leads",
  "/pipeline",
  "/dashboard",
  "/clients",
  "/integrations",
  "/review",
  "/conversations",
  "/calls",
  "/sequences",
  "/sequences/new",
  "/automations",
  "/automations/new",
  "/settings/calls",
  "/lite",
  "/lite/login",
  "/settings/notifications",
  "/settings/security",
  "/settings/developer",
  "/marketplace",
  "/marketplace/leadsheet",
  "/report-builder",
  "/report-builder/rbt-demo",
  "/wallboards",
  "/progress",
  "/tv",
  "/pay/mock-pay-missing",
  "/login",
];

for (const locale of ["bn", "en", "ar"]) {
  for (const route of ROUTES) {
    test(`axe: /${locale}${route}`, async ({ page }) => {
      await page.goto(`/${locale}${route}`);
      await page.locator("h1").first().waitFor();
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious.map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(" "))
              .slice(0, 3)
              .join(", ")}`,
        ),
      ).toEqual([]);
    });
  }
}

// Leadexpa is light-only: a dark OS preference still gets the brand theme, with readable SLA chips.
test("dark OS preference keeps the light brand theme and readable SLA chips", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/bn/inbox");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator('[data-sla="overdue"]').first().waitFor();
  const results = await new AxeBuilder({ page }).include("[data-sla]").withRules(["color-contrast"]).analyze();
  expect(results.violations).toEqual([]);
});
