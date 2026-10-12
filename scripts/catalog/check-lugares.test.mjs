import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkCatalog } from "./check-lugares.mjs";

const expected = {
  note: "lista de teste",
  routes: [
    {
      slug: "visitando-parques",
      routeType: "free",
      targetCategory: "park",
      targetCount: 2,
      places: [{ name: "Parque Tanguá" }, { name: "Parque Barigui", addressIncludes: "Cândido Hartmann" }],
    },
  ],
};

test("a missing seed name fails and the report stays free of coordinates", () => {
  const result = checkCatalog(
    [
      {
        name: "Parque Tanguá",
        place_id: "abc",
        types: ["park"],
        photos: [{ photo_reference: "secret-ref" }],
        geometry: { location: { lat: -25.4284, lng: -49.2733 } },
      },
    ],
    expected,
  );
  assert.equal(result.ok, false);
  assert.match(result.markdown, /não achei "Parque Barigui"/);
  assert.doesNotMatch(result.markdown, /-25\.|photo_reference|secret-ref/);
});

test("the catalog on disk matches the expected itinerary names", async () => {
  const places = JSON.parse(await readFile(new URL("../../data/lugares.json", import.meta.url), "utf8"));
  const liveExpected = JSON.parse(await readFile(new URL("../../data/roteiros-esperados.json", import.meta.url), "utf8"));
  const result = checkCatalog(places, liveExpected);
  assert.equal(result.ok, true, result.markdown);
});
