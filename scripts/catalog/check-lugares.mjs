/**
 * Reads lugares.json and the expected itinerary names. Does not call Google or Atlas.
 */
import { readFile, writeFile } from "node:fs/promises";
import { inferCategory } from "./infer-category.mjs";

export function checkCatalog(places, expected) {
  const problems = [];
  const counts = new Map();
  let withoutPhoto = [];

  if (!Array.isArray(places)) {
    return { ok: false, markdown: "lugares.json precisa ser um array." };
  }

  const seenIds = new Set();
  for (const place of places) {
    const category = inferCategory(place.tags, place.types);
    counts.set(category, (counts.get(category) ?? 0) + 1);
    if (!Array.isArray(place.photos) || place.photos.length === 0) {
      withoutPhoto.push(displayName(place));
    }
    if (place.place_id) {
      if (seenIds.has(place.place_id)) problems.push(`place_id repetido: ${displayName(place)}`);
      seenIds.add(place.place_id);
    }
  }

  for (const route of expected.routes ?? []) {
    for (const wanted of route.places ?? []) {
      const matches = places.filter((place) => placeMatches(place, wanted));
      if (matches.length === 0) problems.push(`${route.slug}: não achei "${wanted.name}"`);
      if (matches.length > 1) problems.push(`${route.slug}: "${wanted.name}" aparece ${matches.length} vezes`);
    }
    if (route.routeType === "free" && route.targetCategory && route.targetCount) {
      const available = counts.get(route.targetCategory) ?? 0;
      if (available < route.targetCount) {
        problems.push(
          `${route.slug}: targetCount ${route.targetCount} é maior que os ${available} lugares da categoria ${route.targetCategory}`,
        );
      }
    }
  }

  return { ok: problems.length === 0, markdown: render(counts, withoutPhoto, problems) };
}

function displayName(place) {
  const nickname = typeof place.nickname === "string" ? place.nickname.trim() : "";
  if (nickname) return nickname;
  const name = typeof place.name === "string" ? place.name.trim() : "";
  return name || "(sem nome)";
}

function placeMatches(place, wanted) {
  if (place.name !== wanted.name) return false;
  if (wanted.addressIncludes && !String(place.formatted_address || "").includes(wanted.addressIncludes)) {
    return false;
  }
  return true;
}

function render(counts, withoutPhoto, problems) {
  const countLines = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, count]) => `- ${category}: ${count}`);
  const photoLines = withoutPhoto.length === 0
    ? ["Nenhum."]
    : withoutPhoto.map((name) => `- ${name}`);
  const problemLines = problems.length === 0 ? ["Nenhum."] : problems.map((problem) => `- ${problem}`);
  return [
    "## Catálogo",
    "",
    "### Por categoria",
    ...countLines,
    "",
    "### Sem foto",
    ...photoLines,
    "",
    "### Problemas",
    ...problemLines,
    "",
    "Os nomes que o seed exige estão em `data/roteiros-esperados.json`.",
    "",
  ].join("\n");
}

async function main() {
  const outFlag = process.argv.indexOf("--out");
  const outPath = outFlag === -1 ? "" : process.argv[outFlag + 1];
  const placesPath = process.argv.includes("--places")
    ? process.argv[process.argv.indexOf("--places") + 1]
    : "data/lugares.json";
  const expectedPath = process.argv.includes("--expected")
    ? process.argv[process.argv.indexOf("--expected") + 1]
    : "data/roteiros-esperados.json";
  const places = JSON.parse(await readFile(placesPath, "utf8"));
  const expected = JSON.parse(await readFile(expectedPath, "utf8"));
  const result = checkCatalog(places, expected);
  if (outPath) await writeFile(outPath, result.markdown);
  else process.stdout.write(result.markdown);
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1]?.endsWith("check-lugares.mjs")) {
  await main();
}
