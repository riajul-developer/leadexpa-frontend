import { expect, test } from "@playwright/test";

// Enterprise identity (G7a): an admin claims and verifies a domain, connects an identity provider and creates a
// SCIM token; people on an SSO domain are sent to "Sign in with SSO" and come back signed in.

test("set up single sign-on: domain, identity provider, SCIM token", async ({ page }) => {
  await page.goto("/en/settings/sso");
  await expect(page.getByRole("heading", { name: "Your email domains" })).toBeVisible();

  const domain = page.getByRole("textbox", { name: "Domain", exact: true });
  await domain.fill("gmail.com");
  await page.getByRole("button", { name: "Add domain" }).click();
  await expect(page.getByText("Enter a domain you own, like youragency.com (not gmail.com).")).toBeVisible();

  await domain.fill("bright.test");
  await page.getByRole("button", { name: "Add domain" }).click();
  const list = page.getByTestId("sso-domains");
  await expect(list.getByText("_leadexpa-sso.bright.test")).toBeVisible();
  await expect(page.getByText("Verify at least one email domain first", { exact: false })).toBeVisible();
  await list.getByRole("button", { name: "Verify now" }).click();
  await expect(list.getByText("Verified", { exact: true })).toBeVisible();
  await expect(page.getByText("Verify at least one email domain first", { exact: false })).toHaveCount(0);

  // The redirect URI to paste into the provider; the issuer must be https.
  await expect(page.getByText("https://app.leadexpa.app/en/sso/callback")).toBeVisible();
  await page.getByRole("textbox", { name: "Issuer URL" }).fill("http://idp.bright.test");
  await page.getByRole("textbox", { name: "Client ID" }).fill("leadexpa");
  await page.getByLabel("Client secret").fill("s3cret");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("the identity provider's https issuer URL")).toBeVisible();
  await page.getByRole("textbox", { name: "Issuer URL" }).fill("https://idp.bright.test");
  page.once("dialog", (d) => void d.accept()); // requiring SSO asks first
  await page.getByRole("switch", { name: "Require single sign-on" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Single sign-on saved")).toBeVisible();
  await expect(page.getByText("A secret is saved. Leave empty to keep it.")).toBeVisible();

  // SAML shows the service provider values instead.
  await page.getByRole("combobox", { name: "Protocol" }).selectOption("saml");
  await expect(page.getByText("https://api.leadexpa.app/v1/auth/sso/saml/mock/acs")).toBeVisible();

  // A SCIM token is shown once.
  await page.getByRole("textbox", { name: "Token name" }).fill("Okta");
  await page.getByRole("button", { name: "Create token" }).click();
  const created = page.getByTestId("scim-token-created");
  await expect(created.getByText("scim_mockTokenValue123")).toBeVisible();
  await expect(created.getByText("https://api.leadexpa.app/scim/v2")).toBeVisible();
  await created.getByRole("button", { name: "Copy token and close" }).click();
  await expect(page.getByText("scim_mockTokenValue123")).toHaveCount(0);
  await expect(page.getByTestId("scim-tokens").getByText("Never used")).toBeVisible();
});

test("an SSO organization's member is sent through their identity provider", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill("jane@sso.test");
  await page.getByLabel("Password", { exact: true }).fill("DemoPass#2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Your organization signs in with single sign-on. Continue below.")).toBeVisible();
  const panel = page.getByTestId("sso-panel");
  await expect(panel.getByRole("textbox", { name: "Work email" })).toHaveValue("jane@sso.test");
  await panel.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/inbox/);
});

test("single sign-on explains an email without SSO and a failed SAML sign-in", async ({ page }) => {
  await page.goto("/en/login?sso_error=sso_not_provisioned");
  await expect(page.getByText("Your organization hasn't given you access yet. Ask your administrator.")).toBeVisible();
  await page.getByTestId("sso-open").click();
  await page.getByRole("textbox", { name: "Work email" }).fill("someone@example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Single sign-on isn't set up for this email. Sign in with your password.")).toBeVisible();
});

test("network and session limits: invalid ranges explained, own address added, limits saved", async ({ page }) => {
  await page.goto("/en/settings/sso");
  await expect(page.getByRole("heading", { name: "Network & session limits" })).toBeVisible();
  await expect(page.getByTestId("your-ip")).toHaveText("198.51.100.23");
  const list = page.getByRole("textbox", { name: "Allowed networks" });
  await list.fill("0.0.0.0/0");
  await page.getByRole("button", { name: "Save limits" }).click();
  await expect(page.getByText("Check the networks", { exact: false })).toBeVisible();
  await list.fill("203.0.113.0/24");
  await page.getByRole("button", { name: "Add my address" }).click();
  await expect(list).toHaveValue("203.0.113.0/24\n198.51.100.23");
  await page.getByRole("combobox", { name: "Sign people out after" }).selectOption("12");
  await page.getByRole("combobox", { name: "Sign people out when idle for" }).selectOption("60");
  await page.getByRole("button", { name: "Save limits" }).click();
  await expect(page.getByText("Access limits saved")).toBeVisible();
  await expect(list).toHaveValue("203.0.113.0/24\n198.51.100.23/32");
});

test("staff outside the agency's networks see why, and can sign out", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill("owner+offsite@demo.recov.local");
  await page.getByLabel("Password", { exact: true }).fill("DemoPass#2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "only allows access from its own network" })).toBeVisible();
  await expect(page.getByTestId("blocked-ip")).toHaveText("198.51.100.23");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("a login ended by the session policy says so", async ({ page }) => {
  await page.goto("/en/login?reason=session_policy");
  await expect(page.getByText("Your organization's session policy signed you out. Sign in again.")).toBeVisible();
});

test("group roles: a SCIM group is mapped to a role and unmapped", async ({ page }) => {
  await page.goto("/en/settings/sso");
  await expect(page.getByRole("heading", { name: "Group roles" })).toBeVisible();
  const groups = page.getByTestId("sso-groups");
  await expect(groups.getByText("12 members")).toBeVisible();
  const floor = groups.getByRole("combobox", { name: "Role for Sales Floor" });
  await expect(floor).toHaveValue("");
  page.once("dialog", (d) => void d.accept()); // a group with members asks first
  await floor.selectOption("agent");
  await expect(page.getByText("Sales Floor now grants Agent.")).toBeVisible();
  await expect(floor).toHaveValue("agent");
  page.once("dialog", (d) => void d.accept());
  await groups.getByRole("combobox", { name: "Role for Sales Managers" }).selectOption("");
  await expect(page.getByText("Sales Managers no longer sets a role.")).toBeVisible();
});

test("SAML: signed requests, the workspace certificate and replacing it", async ({ page }) => {
  await page.goto("/en/settings/sso");
  await page.getByRole("combobox", { name: "Protocol" }).selectOption("saml");
  await expect(
    page.getByText("Save the connection to get this workspace's certificate", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Identity provider entity ID (issuer)" })
    .fill("https://idp.bright.test/saml");
  await page.getByRole("textbox", { name: "Identity provider sign-in URL" }).fill("https://idp.bright.test/sso");
  await page.getByRole("textbox", { name: "Signing certificate" }).fill("MIIBmock");
  await expect(page.getByRole("switch", { name: "Sign requests" })).toBeChecked();
  await expect(page.getByRole("switch", { name: "Allow sign-in from the provider's app tile" })).not.toBeChecked();
  await page.getByRole("switch", { name: "Allow sign-in from the provider's app tile" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Single sign-on saved")).toBeVisible();

  const cert = page.getByTestId("sp-cert");
  await expect(cert.getByText(/^AB:CD:/)).toBeVisible();
  await expect(cert.getByText("Valid until", { exact: false })).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await cert.getByRole("button", { name: "Replace certificate" }).click();
  await expect(page.getByText("New certificate ready. Update it in your provider.")).toBeVisible();
  await expect(cert.getByText(/^EF:01:/)).toBeVisible();
  await expect(
    cert.getByText("Assertions encrypted to the old certificate still work", { exact: false }),
  ).toBeVisible();
});

test("encryption keys: the workspace moves onto its own AWS KMS key and rotates its data key", async ({ page }) => {
  await page.goto("/en/settings/sso");
  await expect(page.getByRole("heading", { name: /Encryption keys/ })).toBeVisible();
  const provider = page.getByRole("combobox", { name: "Key protecting this workspace" });
  await expect(provider).toHaveValue("platform");
  await provider.selectOption("aws_kms");
  const key = page.getByRole("textbox", { name: "Key" });
  await key.fill("1234abcd");
  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText("Check the key: for AWS, paste the key's full ARN.")).toBeVisible();
  await key.fill("arn:aws:kms:eu-west-1:123456789012:key/denied-1");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText("We couldn't use this key: AccessDeniedException", { exact: false })).toBeVisible();
  await key.fill("arn:aws:kms:eu-west-1:123456789012:key/1234abcd");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText("Encryption key saved")).toBeVisible();

  await page.getByRole("button", { name: "Rotate data key" }).click();
  await expect(page.getByText("Data key version 2 is in use.")).toBeVisible();
  await expect(page.getByTestId("key-facts")).toContainText("2 versions kept");
});

test("lead contact encryption: the owner turns it on and sees what changes for search", async ({ page }) => {
  await page.goto("/en/settings/sso");
  const section = page.getByTestId("lead-pii");
  await expect(section.getByText("Off", { exact: true })).toBeVisible();
  page.on("dialog", (d) => void d.accept());
  await section.getByRole("switch", { name: "Encrypt lead contact details" }).click();
  await expect(page.getByText("Encrypting lead contact details.")).toBeVisible();
  await expect(section.getByText("Encrypting existing leads…")).toBeVisible();
  await expect(
    section.getByText("search finds leads by their full phone number or email only", { exact: false }),
  ).toBeVisible();
});

test("audit log streaming: an HTTPS stream with its secret, a failing S3 stream, pause and remove", async ({
  page,
}) => {
  await page.goto("/en/settings/sso");
  await expect(page.getByRole("heading", { name: "Audit log streaming" })).toBeVisible();
  await expect(page.getByText("No streams yet.")).toBeVisible();
  page.on("dialog", (d) => void d.accept());

  await page.getByRole("button", { name: "Add a stream" }).click();
  const form = page.getByTestId("add-stream");
  await form.getByRole("textbox", { name: "Name" }).fill("Splunk");
  await form.getByRole("textbox", { name: "Endpoint URL" }).fill("http://siem.bright.test");
  await form.getByRole("button", { name: "Start streaming" }).click();
  await expect(form.getByText("Use an https address on the public internet.")).toBeVisible();
  await form.getByRole("textbox", { name: "Endpoint URL" }).fill("https://siem.bright.test/ingest");
  await form.getByRole("combobox", { name: "Payload format" }).selectOption("splunk_hec");
  await form.getByRole("textbox", { name: "Extra header (optional)" }).fill("Authorization");
  await form.getByLabel("Header value").fill("Splunk hec-token");
  await form.getByRole("button", { name: "Start streaming" }).click();
  await expect(page.getByText("Stream added.")).toBeVisible();
  const secret = page.getByTestId("stream-secret");
  await expect(secret.getByText("Signing secret for Splunk. It is shown only once.")).toBeVisible();
  await expect(secret.getByText(/^aswsec_/)).toBeVisible();
  await secret.getByRole("button", { name: "I've copied it" }).click();
  await expect(secret).toHaveCount(0);

  const streams = page.getByTestId("audit-streams");
  const splunk = streams.getByTestId("audit-stream").filter({ hasText: "Splunk" });
  await expect(splunk.getByText("Streaming", { exact: true })).toBeVisible();
  await expect(splunk.getByText("Splunk HTTP Event Collector")).toBeVisible();
  await splunk.getByRole("button", { name: "Send test" }).click();
  await expect(page.getByText("The destination accepted the test entry.")).toBeVisible();

  // S3: our role to grant, and a bucket that refuses us.
  await page.getByRole("button", { name: "Add a stream" }).click();
  await form.getByRole("combobox", { name: "Destination" }).selectOption("s3");
  await expect(form.getByText("arn:aws:iam::123456789012:role/leadexpa-audit")).toBeVisible();
  await form.getByRole("textbox", { name: "Name" }).fill("Archive");
  await form.getByRole("textbox", { name: "Bucket" }).fill("bright-denied");
  await form.getByRole("textbox", { name: "Region" }).fill("eu-west-1");
  await form.getByRole("switch", { name: "Send the existing log too" }).click();
  // Only some actions (ADR 0053): a bad entry is refused, then the stream says what it sends.
  await form.getByRole("textbox", { name: "Only these actions" }).fill("Auth.*");
  await form.getByRole("button", { name: "Start streaming" }).click();
  await expect(form.getByText("Use actions like lead.deleted or groups like auth.*, at most 50.")).toBeVisible();
  await form.getByRole("textbox", { name: "Only these actions" }).fill("lead.deleted, auth.*");
  await form.getByRole("button", { name: "Start streaming" }).click();
  const archive = streams.getByTestId("audit-stream").filter({ hasText: "Archive" });
  await expect(archive.getByTestId("audit-stream-actions")).toHaveText("Sends only: auth.*, lead.deleted");
  await expect(splunk.getByTestId("audit-stream-actions")).toHaveCount(0);
  await expect(archive.getByText("Failing", { exact: true })).toBeVisible();
  await expect(archive.getByText("S3 refused the object: AccessDenied", { exact: false })).toBeVisible();
  await expect(archive.getByText("3 entries waiting", { exact: false })).toBeVisible();
  await expect(archive.getByText("s3://bright-denied/")).toBeVisible();

  await splunk.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Stream paused. New entries wait until you resume it.")).toBeVisible();
  await expect(splunk.getByText("Paused", { exact: true })).toBeVisible();
  await splunk.getByRole("button", { name: "Resume" }).click();
  await expect(splunk.getByText("Streaming", { exact: true })).toBeVisible();

  await archive.getByRole("button", { name: "Remove Archive" }).click();
  await expect(page.getByText("Stream removed.")).toBeVisible();
  await expect(streams.getByTestId("audit-stream")).toHaveCount(1);
});

test("data warehouse export: a daily Parquet snapshot, contact details, a manual run and a refusing bucket", async ({
  page,
}) => {
  await page.goto("/en/settings/sso");
  await expect(page.getByRole("heading", { name: "Data warehouse export" })).toBeVisible();
  await expect(page.getByText("Tables: clients, members, sources", { exact: false })).toBeVisible();
  page.on("dialog", (d) => void d.accept());

  await page.getByRole("button", { name: "Add an export" }).click();
  const form = page.getByTestId("add-warehouse-export");
  await expect(form.getByText("arn:aws:iam::123456789012:role/leadexpa-audit")).toBeVisible();
  await form.getByRole("textbox", { name: "Name" }).fill("Snowflake");
  await form.getByRole("textbox", { name: "Bucket" }).fill("Bad_Bucket");
  await form.getByRole("textbox", { name: "Region" }).fill("eu-west-1");
  await form.getByRole("button", { name: "Create export" }).click();
  await expect(form.getByText("Enter a valid S3 bucket name.")).toBeVisible();
  await form.getByRole("textbox", { name: "Bucket" }).fill("bright-lake");
  await form.getByRole("textbox", { name: "Key prefix (optional)" }).fill("raw");
  await form.getByRole("combobox", { name: "Daily run time (UTC)" }).selectOption("3");
  await form.getByRole("button", { name: "Create export" }).click();
  await expect(page.getByText("Export added.", { exact: false })).toBeVisible();

  const row = page.getByTestId("warehouse-export").filter({ hasText: "Snowflake" });
  await expect(row.getByText("Waiting for its first run")).toBeVisible();
  await expect(row.getByText("Daily at 03:00 UTC", { exact: false })).toBeVisible();
  await expect(row.getByText("s3://bright-lake/raw/recov/", { exact: false })).toBeVisible();

  await row.getByRole("button", { name: "Run now" }).click();
  await expect(row.getByText("Up to date")).toBeVisible();
  await expect(row.getByTestId("last-run")).toContainText("1,240 rows");
  await expect(row.getByTestId("last-run")).toContainText("2.1 MB");

  await row.getByRole("switch", { name: "Include contact details" }).click();
  await expect(page.getByText("Contact details will be in the next snapshot.")).toBeVisible();
  await expect(row.getByRole("switch", { name: "Include contact details" })).toBeChecked();

  // A bucket that refuses us: the failure and its reason.
  await page.getByRole("button", { name: "Add an export" }).click();
  await form.getByRole("textbox", { name: "Name" }).fill("Locked");
  await form.getByRole("textbox", { name: "Bucket" }).fill("bright-denied");
  await form.getByRole("textbox", { name: "Region" }).fill("eu-west-1");
  await form.getByRole("button", { name: "Create export" }).click();
  const locked = page.getByTestId("warehouse-export").filter({ hasText: "Locked" });
  await locked.getByRole("button", { name: "Run now" }).click();
  await expect(locked.getByText("Failed", { exact: true })).toBeVisible();
  await expect(locked.getByText("S3 refused the upload: AccessDenied", { exact: false })).toBeVisible();

  await row.getByRole("button", { name: "Pause" }).click();
  await expect(row.getByText("Paused", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Run now" })).toBeDisabled();

  await locked.getByRole("button", { name: "Remove Locked" }).click();
  await expect(page.getByText("Export removed.")).toBeVisible();
  await expect(page.getByTestId("warehouse-export")).toHaveCount(1);
});

test("Cloud Storage and Azure: an audit stream to an Azure container and an export to a Cloud Storage bucket", async ({
  page,
}) => {
  await page.goto("/en/settings/sso");
  await expect(page.getByRole("heading", { name: "Audit log streaming" })).toBeVisible();

  // Azure Blob Storage (ADR 0056): a container URL and a SAS token; a token without a signature is refused.
  await page.getByRole("button", { name: "Add a stream" }).click();
  const form = page.getByTestId("add-stream");
  await form.getByRole("combobox", { name: "Destination" }).selectOption("azure_blob");
  await form.getByRole("textbox", { name: "Name" }).fill("Sentinel");
  await form.getByRole("textbox", { name: "Container URL" }).fill("https://bright.blob.core.windows.net/audit");
  await form.getByLabel("SAS token").fill("sv=2022-11-02&sp=cw");
  await form.getByRole("button", { name: "Start streaming" }).click();
  await expect(form.getByText("Check the key: an HMAC secret, or a SAS token with sp= and sig=.")).toBeVisible();
  await form.getByLabel("SAS token").fill("sv=2022-11-02&sp=cw&sig=abc");
  await form.getByRole("button", { name: "Start streaming" }).click();
  await expect(page.getByText("Stream added.")).toBeVisible();
  const sentinel = page.getByTestId("audit-stream").filter({ hasText: "Sentinel" });
  await expect(sentinel.getByText("Azure Blob Storage")).toBeVisible();
  await expect(sentinel.getByText("https://bright.blob.core.windows.net/audit/")).toBeVisible();
  await sentinel.getByRole("button", { name: "Replace key" }).click();
  await sentinel.getByLabel("SAS token").fill("sv=2023-01-03&sp=cw&sig=new");
  await sentinel.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText("Key replaced. The next delivery uses it.")).toBeVisible();

  // Google Cloud Storage for the warehouse: a bucket and an HMAC key; the location says gs://.
  await page.getByRole("button", { name: "Add an export" }).click();
  const wh = page.getByTestId("add-warehouse-export");
  await wh.getByRole("combobox", { name: "Destination" }).selectOption("gcs");
  await expect(wh.getByText("arn:aws:iam::123456789012:role/leadexpa-audit")).toHaveCount(0);
  await wh.getByRole("textbox", { name: "Name" }).fill("BigQuery");
  await wh.getByRole("textbox", { name: "Bucket" }).fill("bright_lake");
  await wh.getByRole("textbox", { name: "HMAC access ID" }).fill("short");
  await wh.getByLabel("HMAC secret").fill("a-long-enough-hmac-secret-value");
  await wh.getByRole("button", { name: "Create export" }).click();
  await expect(wh.getByText("Enter the HMAC key's access ID.")).toBeVisible();
  await wh.getByRole("textbox", { name: "HMAC access ID" }).fill("GOOG1EXAMPLEACCESSID0123");
  await wh.getByRole("button", { name: "Create export" }).click();
  await expect(page.getByText("Export added.", { exact: false })).toBeVisible();
  const bq = page.getByTestId("warehouse-export").filter({ hasText: "BigQuery" });
  await expect(bq.getByText(/^gs:\/\/bright_lake\/recov\//)).toBeVisible();
  await expect(bq.getByRole("button", { name: "Replace key" })).toBeVisible();
});

test("sandbox: create one, work in it with test leads, come back, reset and delete it", async ({ page }) => {
  await page.goto("/en/settings/sso");
  const card = page.getByTestId("sandbox-card");
  await expect(page.getByRole("heading", { name: "Sandbox", exact: true })).toBeVisible();
  await expect(card.getByText("WhatsApp and SMS messages are simulated", { exact: false })).toBeVisible();
  page.on("dialog", (d) => void d.accept());

  await card.getByRole("spinbutton", { name: "Test leads" }).fill("5");
  await card.getByRole("button", { name: "Create sandbox" }).click();
  await expect(page.getByText("Sandbox ready. Open it to start testing.")).toBeVisible();
  await expect(card.getByText("Demo Digital Agency (sandbox) was made", { exact: false })).toBeVisible();

  await card.getByRole("button", { name: "Open sandbox" }).click();
  const banner = page.getByTestId("sandbox-banner");
  await expect(banner).toContainText("You're in a sandbox");
  await banner.getByRole("button", { name: "Add 10 test leads" }).click();
  await expect(page.getByText("10 test leads added")).toBeVisible();

  await banner.getByRole("button", { name: "Back to live workspace" }).click();
  await expect(page.getByTestId("sandbox-banner")).toHaveCount(0);

  await page.goto("/en/settings/sso");
  await card.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("The sandbox has a fresh copy.")).toBeVisible();
  await card.getByRole("button", { name: "Delete sandbox" }).click();
  await expect(page.getByText("Sandbox deleted.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Create sandbox" })).toBeVisible();
});

test("uptime and SLA: the region's components and last month's report with its service credit", async ({ page }) => {
  await page.goto("/en/settings/sso");
  const card = page.getByTestId("sla-card");
  await expect(page.getByRole("heading", { name: "Uptime & SLA" })).toBeVisible();
  await expect(card.getByText("Your data is in region ap1:")).toBeVisible();
  await expect(card.getByText("Lead capture: Operational", { exact: false })).toBeVisible();
  const report = card.getByTestId("sla-report");
  await expect(report).toContainText("Availability 99.85% against the standard target of 99.9%.");
  await expect(report).toContainText("Target missed");
  await expect(report).toContainText("A 10% service credit applies to this month.");
  await expect(report).toContainText("60 in announced maintenance");
  await expect(page.getByTestId("incident-banner")).toHaveCount(0);
});
