import type { FeedLanguage, NormalizedRssItem } from "./types";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(value: string): string {
  return decodeXml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1]) : null;
}

function getRawTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]).trim() : null;
}

function getAtomLink(block: string): string | null {
  const linkMatch = block.match(/<link\b([^>]*)>/i);
  if (!linkMatch) return null;
  const href = linkMatch[1].match(/\bhref=["']([^"']+)["']/i);
  return href ? decodeXml(href[1]).trim() : null;
}

function getSource(block: string): string | null {
  const sourceBlock = block.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i);
  if (!sourceBlock) return null;

  const text = stripHtml(sourceBlock[2]);
  if (text) return text;

  const urlAttr = sourceBlock[1].match(/\burl=["']([^"']+)["']/i);
  return urlAttr ? decodeXml(urlAttr[1]).trim() : null;
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function itemBlocks(xml: string): string[] {
  const rssItems = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(
    (match) => match[1]
  );
  if (rssItems.length > 0) return rssItems;

  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(
    (match) => match[1]
  );
}

export function parseRssFeed(xml: string, feedLanguage: FeedLanguage): NormalizedRssItem[] {
  return itemBlocks(xml)
    .map((block) => {
      const title = getTag(block, "title") ?? "";
      const rssLink = getRawTag(block, "link");
      const url = (rssLink && !rssLink.includes("<")) ? stripHtml(rssLink) : getAtomLink(block);
      const snippet =
        getTag(block, "description") ??
        getTag(block, "content") ??
        getTag(block, "summary") ??
        getTag(block, "content:encoded");
      const publishedAt =
        getTag(block, "pubDate") ??
        getTag(block, "published") ??
        getTag(block, "updated");

      return {
        feed_language: feedLanguage,
        title,
        url: url ?? "",
        source: getSource(block),
        snippet,
        published_at: normalizeDate(publishedAt)
      };
    })
    .filter((item) => item.title && item.url);
}

export async function itemHash(item: Pick<NormalizedRssItem, "title" | "url">): Promise<string> {
  const normalizedTitle = item.title.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedUrl = item.url.trim().toLowerCase();
  const data = new TextEncoder().encode(`${normalizedTitle}|${normalizedUrl}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
