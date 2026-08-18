import { describe, expect, it } from "vitest";
import {
  buildLlmsTxt,
  buildPublicSitemapDocuments,
  buildRobotsTxt,
  buildSitemapXml,
  eventIndexablePages,
  escapeXml,
  staticIndexablePages
} from "../src/seo-site";
import { knowledgeArticles } from "../src/knowledge";
import { publicOperatorProfiles } from "../src/operators";

describe("site SEO helpers", () => {
  it("allows citation crawlers and blocks training-only scrapers", () => {
    const robots = buildRobotsTxt("https://outage.ch");
    expect(robots).toContain("User-agent: GPTBot\nAllow: /");
    expect(robots).toContain("User-agent: PerplexityBot\nAllow: /");
    expect(robots).toContain("User-agent: ClaudeBot\nAllow: /");
    expect(robots).toContain("User-agent: Google-Extended\nAllow: /");
    expect(robots).toContain("ai-input=yes");
    expect(robots).toContain("User-agent: CCBot\nDisallow: /");
    expect(robots).toContain("Sitemap: https://outage.ch/sitemap.xml");
    expect(robots).not.toContain("Sitemap: https://outage.ch/sitemap-pages.xml");
  });

  it("builds a valid sitemap for static pages, guides and operators", () => {
    const xml = buildSitemapXml(staticIndexablePages("https://outage.ch"));
    expect(xml.startsWith("<?xml version=\"1.0\"")).toBe(true);
    expect(xml).toContain("<loc>https://outage.ch/</loc>");
    expect(xml).toContain("<loc>https://outage.ch/fr/</loc>");
    expect(xml).toContain('hreflang="de-CH"');
    expect(xml).toContain('hreflang="x-default"');
    expect(xml).toContain("<loc>https://outage.ch/ratgeber/</loc>");
    expect(xml).toContain("<loc>https://outage.ch/fr/ratgeber/</loc>");
    expect(xml).toContain("<loc>https://outage.ch/netzbetreiber/</loc>");
    expect(xml).toContain("<loc>https://outage.ch/ueber/</loc>");
    expect(xml).toContain("<loc>https://outage.ch/ratgeber/stromausfall-was-tun/</loc>");
    expect(xml).toContain(`<loc>https://outage.ch/netzbetreiber/${publicOperatorProfiles()[0].slug}/</loc>`);
    expect(xml).toContain(`<lastmod>${knowledgeArticles[0].updatedAt}</lastmod>`);
    expect(xml).not.toContain("/events/");
    expect(xml).not.toContain("/de/");
    expect(xml).not.toContain("<changefreq>");
    expect(xml).not.toContain("<priority>");
  });

  it("keeps German guides as DE-only hreflang targets", () => {
    const xml = buildSitemapXml(staticIndexablePages("https://outage.ch"));
    const guide = xml.match(
      /<url><loc>https:\/\/outage\.ch\/ratgeber\/stromausfall-was-tun\/<\/loc>.*?<\/url>/
    )?.[0] ?? "";
    expect(guide).toContain('hreflang="de-CH"');
    expect(guide).toContain('hreflang="x-default"');
    expect(guide).not.toContain('hreflang="fr-CH"');
    expect(guide).not.toContain("https://outage.ch/fr/ratgeber/stromausfall-was-tun/");
  });

  it("splits the public sitemap into pages and events with a sitemap index", () => {
    const documents = buildPublicSitemapDocuments({
      origin: "https://outage.ch",
      events: [
        { url: "/stromausfall/zurich-42", updated_at: "2026-08-18T09:15:15.000Z" },
        { url: "/stromausfall/geneve-7", updated_at: "2026-08-17T08:00:00Z" }
      ],
      operatorLastmods: { ewz: "2026-08-18T09:15:15.000Z" }
    });

    expect(documents.index).toContain("<sitemapindex");
    expect(documents.index).toContain("<loc>https://outage.ch/sitemap-pages.xml</loc>");
    expect(documents.index).toContain("<loc>https://outage.ch/sitemap-events.xml</loc>");
    expect(documents.index).toContain("<lastmod>2026-08-18T09:15:15Z</lastmod>");

    expect(documents.pages).toContain("<loc>https://outage.ch/</loc>");
    expect(documents.pages).toContain("<lastmod>2026-08-18T09:15:15Z</lastmod>");
    expect(documents.pages).not.toContain("/stromausfall/");
    expect(documents.pages).not.toContain("/panne-de-courant/");

    expect(documents.events).toContain("<loc>https://outage.ch/stromausfall/zurich-42</loc>");
    expect(documents.events).toContain("<loc>https://outage.ch/fr/panne-de-courant/zurich-42</loc>");
    expect(documents.events).toContain("<loc>https://outage.ch/it/interruzione-di-corrente/zurich-42</loc>");
    expect(documents.events).toContain("<loc>https://outage.ch/en/power-outage/zurich-42</loc>");
    expect(documents.events.indexOf("zurich-42")).toBeLessThan(documents.events.indexOf("geneve-7"));
    expect(documents.events).not.toContain("/events/");
    expect(documents.events).not.toContain(".000Z");
    const eventBlock = documents.events.match(
      /<url><loc>https:\/\/outage\.ch\/stromausfall\/zurich-42<\/loc>.*?<\/url>/
    )?.[0] ?? "";
    expect(eventBlock.match(/hreflang="de-CH"/g)).toHaveLength(1);
    expect(eventBlock.match(/hreflang="fr-CH"/g)).toHaveLength(1);
    expect(eventBlock.match(/hreflang="en"/g)).toHaveLength(1);
    expect(eventBlock).not.toContain("/events/");
  });

  it("drops duplicate locs, unknown lastmods and non-canonical event URLs", () => {
    const xml = buildSitemapXml([
      { loc: "https://outage.ch/", lastmod: "2026-08-18" },
      { loc: "https://outage.ch/", lastmod: "2026-08-19" },
      { loc: "https://outage.ch/ueber/", lastmod: "not-a-date" }
    ]);
    expect(xml.match(/<loc>https:\/\/outage\.ch\/<\/loc>/g)).toHaveLength(1);
    expect(xml).toContain("<lastmod>2026-08-18</lastmod>");
    expect(xml).not.toContain("2026-08-19");
    expect(xml).toContain("<loc>https://outage.ch/ueber/</loc>");
    expect(xml).not.toContain("not-a-date");
    expect(eventIndexablePages([{ url: "/events/42", updated_at: "2026-08-18T10:00:00Z" }])).toEqual([]);
  });

  it("escapes XML special characters", () => {
    expect(escapeXml(`a&b<"'>`)).toBe("a&amp;b&lt;&quot;&apos;&gt;");
  });

  it("describes the product for AI agents", () => {
    const llms = buildLlmsTxt("https://outage.ch");
    expect(llms).toContain("# outage.ch");
    expect(llms).toContain("kein offizieller Notfallkanal");
    expect(llms).toContain("https://outage.ch/ratgeber/");
    expect(llms).toContain("Verteilnetzbetreiber");
  });
});
