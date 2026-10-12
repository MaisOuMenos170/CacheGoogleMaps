import assert from "node:assert/strict";
import test from "node:test";
import { formatCategorySummary, toGeoJSON } from "./geojson.mjs";

test("two places become two features without user fields", () => {
  const { collection, counts, skipped } = toGeoJSON([
    {
      name: "Parque Tanguá",
      place_id: "place-1",
      tags: ["parque"],
      geometry: { location: { lat: -25.38, lng: -49.28 } },
      email: "person@example.com",
      userId: "abc",
    },
    {
      name: "Museu Oscar Niemeyer | MON",
      place_id: "place-2",
      tags: ["museu"],
      geometry: { location: { lat: -25.41, lng: -49.26 } },
    },
  ]);

  assert.equal(collection.features.length, 2);
  assert.equal(skipped, 0);
  assert.equal(counts.get("park"), 1);
  assert.equal(counts.get("museum"), 1);
  for (const feature of collection.features) {
    assert.deepEqual(Object.keys(feature.properties).sort(), ["category", "name", "place_id"]);
    assert.equal(JSON.stringify(feature).includes("example.com"), false);
    assert.equal(JSON.stringify(feature).includes("userId"), false);
  }

  const summary = formatCategorySummary(counts, 2, 0);
  assert.match(summary, /park: 1/);
  assert.equal(summary.includes("@"), false);
});
