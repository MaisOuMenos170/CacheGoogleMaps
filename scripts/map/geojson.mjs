/**
 * Builds a GeoJSON feature collection from lugares.json.
 * Properties are name, place id, and category. No user fields.
 */
import { readFile, writeFile } from "node:fs/promises";
import { inferCategory } from "./infer-category.mjs";

export function toGeoJSON(places) {
  const features = [];
  const counts = new Map();
  let skipped = 0;

  for (const place of places) {
    const category = inferCategory(place.tags, place.types);
    counts.set(category, (counts.get(category) ?? 0) + 1);
    const lat = place?.geometry?.location?.lat;
    const lng = place?.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      skipped += 1;
      continue;
    }
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        name: place.name ?? "",
        place_id: place.place_id ?? "",
        category,
      },
    });
  }

  return {
    collection: { type: "FeatureCollection", features },
    counts,
    skipped,
  };
}

export function formatCategorySummary(counts, featureCount, skipped) {
  const lines = [
    "## Mapa",
    "",
    `- Pontos: ${featureCount}`,
    `- Sem coordenada: ${skipped}`,
    "",
    "### Por categoria",
  ];
  for (const [category, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- ${category}: ${count}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const places = JSON.parse(await readFile("data/lugares.json", "utf8"));
  const { collection, counts, skipped } = toGeoJSON(places);
  await writeFile("lugares.geojson", JSON.stringify(collection));
  await writeFile("map-summary.md", formatCategorySummary(counts, collection.features.length, skipped));
}

if (process.argv[1]?.endsWith("geojson.mjs")) {
  await main();
}
