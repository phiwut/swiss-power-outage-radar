import { describe, expect, it } from "vitest";
import {
  alternatePath,
  canonicalEventPath,
  dePrefixTarget,
  eventIdFromPath,
  hreflangEntries,
  localizeStoredEventUrl,
  parseAppPath,
  parseLocaleFromPath,
  pathFor,
  t
} from "../src/i18n";

describe("i18n routing", () => {
  it("keeps German unprefixed and prefixes other locales", () => {
    expect(pathFor({ kind: "home" }, "de")).toBe("/");
    expect(pathFor({ kind: "home" }, "fr")).toBe("/fr/");
    expect(pathFor({ kind: "operators" }, "it")).toBe("/it/netzbetreiber/");
    expect(pathFor({ kind: "event", slugId: "geneve-194" }, "fr")).toBe("/fr/panne-de-courant/geneve-194");
    expect(pathFor({ kind: "event", slugId: "zurich-42" }, "en")).toBe("/en/power-outage/zurich-42");
    expect(pathFor({ kind: "guide", slug: "stromausfall-was-tun" }, "fr")).toBe("/ratgeber/stromausfall-was-tun/");
  });

  it("parses locale prefixes and translated event stems", () => {
    expect(parseLocaleFromPath("/fr/panne-de-courant/zurich-42")).toBe("fr");
    expect(parseAppPath("/fr/netzbetreiber/ewz/")).toEqual({
      locale: "fr",
      route: { kind: "operator", slug: "ewz" }
    });
    expect(parseAppPath("/it/interruzione-di-corrente/lugano-9")).toEqual({
      locale: "it",
      route: { kind: "event", slugId: "lugano-9" }
    });
    expect(eventIdFromPath("/en/power-outage/zurich-42")).toBe(42);
    expect(eventIdFromPath("/stromausfall/zurich-42")).toBe(42);
  });

  it("rewrites stored German event URLs at render time", () => {
    expect(localizeStoredEventUrl("/stromausfall/zurich-42", "fr")).toBe("/fr/panne-de-courant/zurich-42");
    expect(canonicalEventPath("/stromausfall/zurich-42", "/fr/stromausfall/zurich-42"))
      .toBe("/fr/panne-de-courant/zurich-42");
    expect(dePrefixTarget("/de/netzbetreiber/")).toBe("/netzbetreiber/");
    expect(dePrefixTarget("/fr/")).toBeNull();
  });

  it("builds hreflang including x-default German", () => {
    const links = hreflangEntries("/fr/panne-de-courant/zurich-42", "https://outage.ch");
    expect(links.map((entry) => entry.hreflang)).toEqual(["de-CH", "fr-CH", "it-CH", "en", "x-default"]);
    expect(links.find((entry) => entry.locale === "de")?.href).toBe("https://outage.ch/stromausfall/zurich-42");
    expect(links.find((entry) => entry.locale === "x-default")?.href).toBe("https://outage.ch/stromausfall/zurich-42");
    expect(alternatePath("/ratgeber/stromausfall-was-tun/", "fr")).toBe("/fr/ratgeber/");
  });

  it("uses sentence templates instead of machine-translating source quotes", () => {
    expect(t("fr", "nature.unplannedKind")).toBe("Panne de courant");
    expect(t("fr", "event.in", { kind: "Panne de courant", location: "Genève" })).toBe("Panne de courant à Genève");
    expect(t("it", "nav.operators")).toBe("Gestori");
  });
});
