/**
 * Same category rules as ZanzarBackend/scripts/seed/lugares-inference.js.
 * Copied here so a catalog pull request does not need the backend checkout.
 */

const tagCategoryMap = {
  restaurante: "restaurant",
  bar: "bar",
  café: "cafe",
  cafe: "cafe",
  museu: "museum",
  parque: "park",
  "ponto turístico": "tourist",
  "ponto turistico": "tourist",
  histórico: "historic",
  historico: "historic",
  curiosidade: "curiosity",
  festa: "party",
};

const typeCategoryRules = [
  { types: ["night_club", "event_venue", "casino"], category: "party" },
  { types: ["zoo", "aquarium"], category: "curiosity" },
  { types: ["museum"], category: "museum" },
  { types: ["park", "amusement_park"], category: "park" },
  { types: ["bar"], category: "bar" },
  { types: ["restaurant"], category: "restaurant" },
  { types: ["cafe", "bakery"], category: "cafe" },
  { types: ["historic", "church", "place_of_worship"], category: "historic" },
];

export function inferCategory(tags, types) {
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      const category = tagCategoryMap[String(tag || "").trim().toLowerCase()];
      if (category) return category;
    }
  }
  const set = new Set(types || []);
  if (set.has("bar") && set.has("restaurant")) return "bar";
  for (const rule of typeCategoryRules) {
    if (rule.types.some((type) => set.has(type))) return rule.category;
  }
  return "tourist";
}
