import { describe, expect, it } from "vitest";
import {
  findOperatorProfile,
  operatorBySlug,
  operatorProfileUrl,
  publicOperatorProfiles
} from "../src/operators";

describe("operator profiles", () => {
  it("creates unique public profiles from official sources", () => {
    const profiles = publicOperatorProfiles();
    expect(profiles.length).toBeGreaterThan(20);
    expect(new Set(profiles.map((profile) => profile.slug)).size).toBe(profiles.length);
    expect(profiles.some((profile) => profile.sourceKey === "alertswiss")).toBe(false);
    expect(profiles.some((profile) => profile.slug === "ewz")).toBe(true);
    expect(operatorProfileUrl(profiles[0]).startsWith("/netzbetreiber/")).toBe(true);
  });

  it("resolves operators by slug and name", () => {
    const ewz = operatorBySlug("ewz");
    expect(ewz?.name).toBe("ewz");
    expect(findOperatorProfile("ewz")?.slug).toBe("ewz");
    expect(findOperatorProfile("Energie Wasser Bern")?.slug).toBe("energie-wasser-bern");
    expect(findOperatorProfile(null)).toBeNull();
  });
});
