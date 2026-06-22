export const PASSIFISTS_VS_BAKERS_ROUTE = "passifists-vs-bakers";
export const PASSIFISTS_VS_BAKERS_START_DATE = "2026-06-05";
export const PASSIFISTS_VS_BAKERS_END_DATE = "2026-06-21";

export const COALITION_COUNTRIES = [
  { name: "Poland", flag: "🇵🇱", tags: ["Passifists"] },
  { name: "Georgia", flag: "🇬🇪", tags: ["Passifists"] },
  { name: "Croatia", flag: "🇭🇷", tags: ["Passifists", "APP"] },
  { name: "Slovenia", flag: "🇸🇮", tags: ["Passifists", "APP"] },
  { name: "Hungary", flag: "🇭🇺", tags: ["Passifists", "APP"] },
  { name: "Brazil", flag: "🇧🇷", tags: ["Passifists", "APP"] },
  { name: "Greece", flag: "🇬🇷", tags: ["Passifists"] },
  { name: "United States", flag: "🇺🇸", tags: ["Passifists"] },
  { name: "Argentina", flag: "🇦🇷", tags: ["Passifists", "URL"] },
  { name: "Peru", flag: "🇵🇪", tags: ["Passifists", "URL"] },
  { name: "United Kingdom", flag: "🇬🇧", tags: ["Passifists", "URL"] },
  { name: "France", flag: "🇫🇷", tags: ["Passifists", "URL"] },
  { name: "Italy", flag: "🇮🇹", tags: ["Passifists", "URL"] },
  { name: "Ireland", flag: "🇮🇪", tags: ["Passifists", "URL"] },
  { name: "Germany", flag: "🇩🇪", tags: ["Passifists", "URL"] },
  { name: "Mexico", flag: "🇲🇽", tags: ["Passifists", "URL"] },
];

export const HOSTILE_COUNTRIES = [
  { name: "South Korea", flag: "🇰🇷", tags: ["Bakers"] },
  { name: "Bulgaria", flag: "🇧🇬", tags: ["Bakers"] },
  { name: "Saudi Arabia", flag: "🇸🇦", tags: ["Bakers"] },
  { name: "Serbia", flag: "🇷🇸", tags: ["Affiliates"] },
  { name: "Turkey", flag: "🇹🇷", tags: ["Affiliates"] },
  { name: "Chile", flag: "🇨🇱", tags: ["Affiliates"] },
  { name: "Australia", flag: "🇦🇺", tags: ["Affiliates"] },
  { name: "North Macedonia", flag: "🇲🇰", tags: ["Affiliates"] },
  { name: "Sweden", flag: "🇸🇪", tags: ["Bakers"] },
];

export const ALLIANCE_TAG_META = {
  Passifists: {
    label: "Passifists",
    color: "emerald",
    description: "Defensive pact core",
  },
  APP: {
    label: "APP",
    color: "sky",
    description: "Auxiliary coalition branch",
  },
  URL: {
    label: "URL",
    color: "violet",
    description: "Support bloc on the coalition side",
  },
  Bakers: {
    label: "The Bakers",
    color: "rose",
    description: "Primary hostile bloc",
  },
  Affiliates: {
    label: "Affiliates",
    color: "amber",
    description: "Unofficial or adjacent hostile members",
  },
};

function normalizeCountryName(name) {
  return String(name || "").trim().toLowerCase();
}

export const CAMPAIGN_COUNTRY_LOOKUP = new Map(
  [...COALITION_COUNTRIES, ...HOSTILE_COUNTRIES].map((country) => [normalizeCountryName(country.name), country]),
);

export function getCampaignCountry(name) {
  return CAMPAIGN_COUNTRY_LOOKUP.get(normalizeCountryName(name)) || null;
}

export function getCampaignSide(name) {
  const country = getCampaignCountry(name);
  if (!country) {
    return "neutral";
  }

  return HOSTILE_COUNTRIES.some((entry) => normalizeCountryName(entry.name) === normalizeCountryName(name))
    ? "hostile"
    : "coalition";
}
