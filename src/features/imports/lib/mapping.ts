export const IMPORT_FIELDS = [
  "full_name",
  "first_name",
  "last_name",
  "phone",
  "email",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "whatsapp_opt_in",
  "marketing_opt_in",
  "custom",
  "_ignore",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

const ALIASES: Record<string, ImportField> = {
  name: "full_name",
  full_name: "full_name",
  fullname: "full_name",
  customer_name: "full_name",
  client_name: "full_name",
  your_name: "full_name",
  নাম: "full_name",
  পূর্ণ_নাম: "full_name",
  গ্রাহকের_নাম: "full_name",
  first_name: "first_name",
  firstname: "first_name",
  last_name: "last_name",
  lastname: "last_name",
  surname: "last_name",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  mobile_number: "phone",
  mobile_no: "phone",
  contact: "phone",
  contact_number: "phone",
  contact_no: "phone",
  cell: "phone",
  tel: "phone",
  whatsapp: "phone",
  whatsapp_number: "phone",
  মোবাইল: "phone",
  ফোন: "phone",
  মোবাইল_নম্বর: "phone",
  ফোন_নম্বর: "phone",
  মোবাইল_নং: "phone",
  email: "email",
  email_address: "email",
  e_mail: "email",
  mail: "email",
  ইমেইল: "email",
  ই_মেইল: "email",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
  campaign: "utm_campaign",
  ক্যাম্পেইন: "utm_campaign",
  utm_term: "utm_term",
  utm_content: "utm_content",
  whatsapp_opt_in: "whatsapp_opt_in",
  marketing_opt_in: "marketing_opt_in",
};

export function normalizeHeader(h: string): string {
  const k = h.replace(/^﻿/, "").trim().toLowerCase();
  const prefix = k.match(/^_+/)?.[0] ?? "";
  return (
    prefix +
    k
      .split(/[\s\-._]+/)
      .filter(Boolean)
      .join("_")
  );
}

export function guessField(header: string): ImportField {
  return ALIASES[normalizeHeader(header)] ?? "custom";
}

export function autoMap(headers: string[], suggested: Record<string, string> = {}): Record<string, ImportField> {
  const out: Record<string, ImportField> = {};
  const used = new Set<ImportField>();
  for (const h of headers) {
    const s = suggested[h];
    const candidate = (IMPORT_FIELDS as readonly string[]).includes(s ?? "") ? (s as ImportField) : guessField(h);
    const field = candidate !== "custom" && candidate !== "_ignore" && used.has(candidate) ? "custom" : candidate;
    used.add(field);
    out[h] = field;
  }
  return out;
}

export function hasContactColumn(m: Record<string, string>): boolean {
  return Object.values(m).some((f) => f === "phone" || f === "email");
}
