import { describe, expect, it } from "vitest";
import { extractPlaceMentions, normalizePlaceText } from "../src/places";
import type { GeoAliasCatalogRow } from "../src/types";

function place(overrides: Partial<GeoAliasCatalogRow>): GeoAliasCatalogRow {
  return {
    id: 1,
    external_id: "openplz:ch:locality:3123:Belp:861",
    country: "CH",
    canton_key: "2",
    canton_code: "BE",
    canton_name: "Bern / Berne",
    district_key: "246",
    district_name: "Bern-Mittelland",
    municipality_key: "861",
    municipality_name: "Belp",
    locality_key: null,
    locality_name: "Belp",
    postcode: "3123",
    street_name: null,
    place_type: "locality",
    canonical_name: "Belp 3123",
    normalized_name: "belp 3123",
    parent_external_id: "openplz:ch:municipality:861",
    source: "openplz",
    source_updated_at: null,
    created_at: "2026-07-09T00:00:00.000Z",
    updated_at: "2026-07-09T00:00:00.000Z",
    alias: "Belp",
    normalized_alias: "belp",
    ...overrides
  };
}

describe("place extraction", () => {
  it("normalizes Swiss place text with accents and punctuation", () => {
    expect(normalizePlaceText("Stromausfall in Zürich-Seefeld")).toBe("stromausfall in zurich seefeld");
  });

  it("extracts a locality without matching substrings inside longer names", () => {
    const mentions = extractPlaceMentions("Stromausfall in Belp gemeldet. Belprahon ist nicht betroffen.", [
      place({ id: 1, alias: "Belp", normalized_alias: "belp" })
    ]);

    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({
      placeId: 1,
      placeType: "locality",
      role: "affected"
    });
  });

  it("uses postcode context for higher-confidence locality matches", () => {
    const mentions = extractPlaceMentions("In 3123 Belp fiel der Strom aus.", [
      place({ id: 1, alias: "3123 Belp", normalized_alias: "3123 belp" })
    ]);

    expect(mentions[0].confidence).toBeGreaterThanOrEqual(0.9);
    expect(mentions[0].matchMethod).toBe("postal_code_alias");
  });

  it("treats canton-only matches as context rather than affected places", () => {
    const mentions = extractPlaceMentions("Im Kanton Bern kam es lokal zu Unterbrüchen.", [
      place({
        id: 2,
        external_id: "openplz:ch:canton:2",
        alias: "Bern",
        normalized_alias: "bern",
        place_type: "canton",
        canonical_name: "Bern / Berne (BE)",
        postcode: null
      })
    ]);

    expect(mentions[0]).toMatchObject({
      placeId: 2,
      role: "context"
    });
  });
});
