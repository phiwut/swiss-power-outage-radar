import { describe, expect, it } from "vitest";
import {
  ELCOM_H4_YEAR,
  elcomFactsForSlug,
  elcomMappedSlugs,
  formatRpPerKwh
} from "../src/elcom-operator-facts";
import { publicOperatorProfiles } from "../src/operators";

describe("ElCom operator facts", () => {
  it("maps ewz to the Stadt Zürich operator and skips ambiguous ewl entities", () => {
    expect(elcomFactsForSlug("ewz")?.elcomId).toBe(565);
    expect(elcomFactsForSlug("ewz")?.totalRp).toBe(24.36);
    expect(elcomFactsForSlug("ewl-luzern")).toBeNull();
    expect(elcomFactsForSlug("werke-am-zurichsee")).toBeNull();
    expect(formatRpPerKwh(24.36)).toContain("24.36");
    expect(ELCOM_H4_YEAR).toBe(2026);
  });

  it("only maps slugs that exist as public operator profiles", () => {
    const slugs = new Set(publicOperatorProfiles().map((profile) => profile.slug));
    for (const slug of elcomMappedSlugs()) {
      expect(slugs.has(slug), slug).toBe(true);
    }
  });
});
