export interface KnowledgeTable {
  headers: string[];
  rows: string[][];
}

export interface KnowledgeStep {
  title: string;
  text: string;
}

export interface KnowledgeSection {
  heading: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: KnowledgeStep[];
  table?: KnowledgeTable;
}

export interface KnowledgeFaq {
  question: string;
  answer: string;
}

export interface KnowledgeSource {
  label: string;
  url: string;
}

export interface KnowledgeArticle {
  slug: string;
  title: string;
  shortTitle: string;
  seoTitle: string;
  description: string;
  definition: string;
  intro: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  relatedSlugs: string[];
  showOperatorDirectory?: boolean;
  howto?: { name: string; steps: KnowledgeStep[] };
  sections: KnowledgeSection[];
  faqs: KnowledgeFaq[];
  sources: KnowledgeSource[];
}

export { knowledgeArticles } from "./knowledge-articles";

import { knowledgeArticles } from "./knowledge-articles";

const DEFAULT_RELATED = [
  "stromausfall-was-tun",
  "stromausfall-melden",
  "stromausfall-dauer-ursachen"
];

export const knowledgeArticlePaths = [
  "/ratgeber/",
  ...knowledgeArticles.map((article) => `/ratgeber/${article.slug}/`)
];

export function knowledgeArticleUrl(article: Pick<KnowledgeArticle, "slug">): string {
  return `/ratgeber/${article.slug}/`;
}

export function knowledgeHeadingId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9äöü]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function relatedKnowledgeArticles(limit = 3, currentSlug?: string): KnowledgeArticle[] {
  const current = currentSlug
    ? knowledgeArticles.find((article) => article.slug === currentSlug)
    : undefined;
  const preferred = current?.relatedSlugs?.length ? current.relatedSlugs : DEFAULT_RELATED;
  const picked: KnowledgeArticle[] = [];
  for (const slug of preferred) {
    const article = knowledgeArticles.find((item) => item.slug === slug && item.slug !== currentSlug);
    if (article) picked.push(article);
  }
  for (const article of knowledgeArticles) {
    if (article.slug === currentSlug) continue;
    if (picked.some((item) => item.slug === article.slug)) continue;
    picked.push(article);
  }
  return picked.slice(0, Math.max(1, limit));
}

export function articleBySlug(slug: string): KnowledgeArticle | undefined {
  return knowledgeArticles.find((article) => article.slug === slug);
}
