export const COUNTRY_ZONES: Record<string, string[]> = {
  BD: ["Asia/Dhaka"],
  US: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix"],
  CA: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax"],
  GB: ["Europe/London"],
  IE: ["Europe/Dublin"],
  AU: ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth", "Australia/Adelaide"],
  NZ: ["Pacific/Auckland"],
  AE: ["Asia/Dubai"],
  SA: ["Asia/Riyadh"],
  QA: ["Asia/Qatar"],
  KW: ["Asia/Kuwait"],
  BH: ["Asia/Bahrain"],
  OM: ["Asia/Muscat"],
  JO: ["Asia/Amman"],
  EG: ["Africa/Cairo"],
  MA: ["Africa/Casablanca"],
  IL: ["Asia/Jerusalem"],
  TR: ["Europe/Istanbul"],
  IN: ["Asia/Kolkata", "Asia/Calcutta"],
  PK: ["Asia/Karachi"],
  NP: ["Asia/Kathmandu", "Asia/Katmandu"],
  LK: ["Asia/Colombo"],
  SG: ["Asia/Singapore"],
  MY: ["Asia/Kuala_Lumpur"],
  ID: ["Asia/Jakarta"],
  TH: ["Asia/Bangkok"],
  VN: ["Asia/Ho_Chi_Minh", "Asia/Saigon"],
  PH: ["Asia/Manila"],
  HK: ["Asia/Hong_Kong"],
  JP: ["Asia/Tokyo"],
  KR: ["Asia/Seoul"],
  DE: ["Europe/Berlin"],
  FR: ["Europe/Paris"],
  ES: ["Europe/Madrid"],
  IT: ["Europe/Rome"],
  NL: ["Europe/Amsterdam"],
  BE: ["Europe/Brussels"],
  PT: ["Europe/Lisbon"],
  AT: ["Europe/Vienna"],
  CH: ["Europe/Zurich"],
  SE: ["Europe/Stockholm"],
  NO: ["Europe/Oslo"],
  DK: ["Europe/Copenhagen"],
  FI: ["Europe/Helsinki"],
  PL: ["Europe/Warsaw"],
  BR: ["America/Sao_Paulo"],
  MX: ["America/Mexico_City"],
  AR: ["America/Argentina/Buenos_Aires"],
  CO: ["America/Bogota"],
  CL: ["America/Santiago"],
  PE: ["America/Lima"],
  ZA: ["Africa/Johannesburg"],
  NG: ["Africa/Lagos"],
  KE: ["Africa/Nairobi"],
  GH: ["Africa/Accra"],
};

export const COUNTRIES = Object.keys(COUNTRY_ZONES);

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function countryForTimeZone(tz: string): string {
  for (const [code, zones] of Object.entries(COUNTRY_ZONES)) if (zones.includes(tz)) return code;
  return "";
}

export function countryOptions(locale: string): { code: string; name: string }[] {
  const names = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([locale], { type: "region" }) : null;
  return COUNTRIES.map((code) => ({ code, name: names?.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

export const DIAL_CODES: Record<string, string> = {
  BD: "880",
  US: "1",
  CA: "1",
  GB: "44",
  IE: "353",
  AU: "61",
  NZ: "64",
  AE: "971",
  SA: "966",
  QA: "974",
  KW: "965",
  BH: "973",
  OM: "968",
  JO: "962",
  EG: "20",
  MA: "212",
  IL: "972",
  TR: "90",
  IN: "91",
  PK: "92",
  NP: "977",
  LK: "94",
  SG: "65",
  MY: "60",
  ID: "62",
  TH: "66",
  VN: "84",
  PH: "63",
  HK: "852",
  JP: "81",
  KR: "82",
  DE: "49",
  FR: "33",
  ES: "34",
  IT: "39",
  NL: "31",
  BE: "32",
  PT: "351",
  AT: "43",
  CH: "41",
  SE: "46",
  NO: "47",
  DK: "45",
  FI: "358",
  PL: "48",
  BR: "55",
  MX: "52",
  AR: "54",
  CO: "57",
  CL: "56",
  PE: "51",
  ZA: "27",
  NG: "234",
  KE: "254",
  GH: "233",
};

/** Home-country input goes as typed (the API normalizes); else add that country's code. */
export function composePhone(text: string, dialCountry: string, clientCountry: string | undefined): string {
  const t = text.trim();
  if (t.startsWith("+") || !dialCountry || dialCountry === clientCountry) return t;
  const code = DIAL_CODES[dialCountry];
  if (!code) return t;
  return `+${code}${t.replace(/\D/g, "").replace(/^0+/, "")}`;
}
