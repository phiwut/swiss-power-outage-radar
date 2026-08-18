import { describe, expect, it } from "vitest";
import { knowledgeArticles, knowledgeArticlePaths, relatedKnowledgeArticles } from "../src/knowledge";

describe("knowledge articles", () => {
  it("provides unique, substantial Swiss outage guides", () => {
    expect(knowledgeArticles.length).toBeGreaterThanOrEqual(8);
    expect(new Set(knowledgeArticles.map((article) => article.slug)).size).toBe(knowledgeArticles.length);
    expect(new Set(knowledgeArticles.map((article) => article.title)).size).toBe(knowledgeArticles.length);
    expect(new Set(knowledgeArticles.map((article) => article.description)).size).toBe(knowledgeArticles.length);
    expect(new Set(knowledgeArticles.map((article) => article.seoTitle)).size).toBe(knowledgeArticles.length);

    for (const article of knowledgeArticles) {
      expect(article.sections.length).toBeGreaterThanOrEqual(3);
      expect(article.faqs.length).toBeGreaterThanOrEqual(3);
      expect(article.sources.length).toBeGreaterThan(0);
      expect(article.definition.length).toBeGreaterThan(80);
      expect(article.seoTitle.length).toBeLessThanOrEqual(65);
      expect(article.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
    }
  });

  it("emits one canonical path per guide", () => {
    expect(knowledgeArticlePaths).toEqual([
      "/ratgeber/",
      ...knowledgeArticles.map((article) => `/ratgeber/${article.slug}/`)
    ]);
  });

  it("returns related guides without repeating the current article", () => {
    const related = relatedKnowledgeArticles(3, "stromausfall-was-tun");
    expect(related).toHaveLength(3);
    expect(related.some((article) => article.slug === "stromausfall-was-tun")).toBe(false);
    expect(related.some((article) => article.slug === "stromausfall-melden")).toBe(true);
  });
});
