import { describe, expect, it } from "vitest";
import { knowledgeArticles, knowledgeArticlePaths } from "../src/knowledge";

describe("knowledge articles", () => {
  it("provides unique, substantial Swiss outage guides", () => {
    expect(knowledgeArticles.length).toBeGreaterThanOrEqual(4);
    expect(new Set(knowledgeArticles.map((article) => article.slug)).size).toBe(knowledgeArticles.length);
    expect(new Set(knowledgeArticles.map((article) => article.title)).size).toBe(knowledgeArticles.length);
    expect(new Set(knowledgeArticles.map((article) => article.description)).size).toBe(knowledgeArticles.length);

    for (const article of knowledgeArticles) {
      expect(article.sections.length).toBeGreaterThanOrEqual(3);
      expect(article.faqs.length).toBeGreaterThanOrEqual(3);
      expect(article.sources.length).toBeGreaterThan(0);
      expect(article.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
    }
  });

  it("emits one canonical path per guide", () => {
    expect(knowledgeArticlePaths).toEqual([
      "/ratgeber/",
      ...knowledgeArticles.map((article) => `/ratgeber/${article.slug}/`)
    ]);
  });
});
