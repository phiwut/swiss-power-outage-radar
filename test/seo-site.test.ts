import { describe, expect, it } from "vitest";
import {
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
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
