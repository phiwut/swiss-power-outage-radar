import { describe, expect, it } from "vitest";
import {
  alternatePath,
  canonicalEventPath,
  dePrefixTarget,
  eventCanonicalRedirect,
  eventIdFromPath,
  eventsTemplateTarget,
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
    expect(eventCanonicalRedirect("/stromausfall/zurich-42", "/stromausfall/zurich-42")).toBeNull();
    expect(eventCanonicalRedirect("/stromausfall/zurich-42/", "/stromausfall/zurich-42"))
      .toBe("/stromausfall/zurich-42");
    expect(eventCanonicalRedirect("/fr/stromausfall/zurich-42", "/stromausfall/zurich-42"))
      .toBe("/fr/panne-de-courant/zurich-42");
    expect(dePrefixTarget("/de/netzbetreiber/")).toBe("/netzbetreiber/");
    expect(dePrefixTarget("/fr/")).toBeNull();
    expect(eventsTemplateTarget("/events/")).toBe("/");
    expect(eventsTemplateTarget("/fr/events")).toBe("/fr/");
    expect(eventsTemplateTarget("/it/events/")).toBe("/it/");
    expect(eventsTemplateTarget("/en/events/")).toBe("/en/");
    expect(eventsTemplateTarget("/stromausfall/zurich-42")).toBeNull();
  });

  it("builds one URL per hreflang code and keeps German guides out of other locales", () => {
    const eventLinks = hreflangEntries("/fr/panne-de-courant/zurich-42", "https://outage.ch");
    expect(eventLinks.map((entry) => entry.hreflang)).toEqual(["de-CH", "fr-CH", "it-CH", "en", "x-default"]);
    expect(new Set(eventLinks.map((entry) => entry.hreflang)).size).toBe(eventLinks.length);
    expect(eventLinks.find((entry) => entry.locale === "de")?.href).toBe("https://outage.ch/stromausfall/zurich-42");
    expect(eventLinks.find((entry) => entry.locale === "x-default")?.href).toBe("https://outage.ch/stromausfall/zurich-42");
    expect(eventLinks.some((entry) => entry.href.includes("/events/"))).toBe(false);

    const guideLinks = hreflangEntries("/ratgeber/stromausfall-was-tun/", "https://outage.ch");
    expect(guideLinks.map((entry) => entry.hreflang)).toEqual(["de-CH", "x-default"]);
    expect(guideLinks[0]?.href).toBe("https://outage.ch/ratgeber/stromausfall-was-tun/");
    expect(guideLinks[1]?.href).toBe(guideLinks[0]?.href);
    expect(alternatePath("/ratgeber/stromausfall-was-tun/", "fr")).toBe("/fr/ratgeber/");

    expect(hreflangEntries("/events/", "https://outage.ch")).toEqual([]);
    expect(hreflangEntries("/fr/events/", "https://outage.ch")).toEqual([]);
  });

  it("uses sentence templates instead of machine-translating source quotes", () => {
    expect(t("fr", "nature.unplannedKind")).toBe("Panne de courant");
    expect(t("fr", "event.in", { kind: "Panne de courant", location: "Genève" })).toBe("Panne de courant à Genève");
    expect(t("it", "nav.operators")).toBe("Gestori");
  });
});
