import { describe, expect, it } from "vitest";
import { assessIncidentValidity, classifyItem } from "../src/ai";
import { cheapFilterItem } from "../src/filter";
import { itemHash, parseRssFeed } from "../src/rss";
import type { AiClassification } from "../src/types";

const fixture = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Stromausfall in Zürich</title>
    <link>https://example.com/a</link>
    <source url="https://example.com">Example News</source>
    <description>Mehrere Quartiere in Zürich sind von einem Stromunterbruch betroffen.</description>
    <pubDate>Tue, 30 Jun 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Sport und Gaming News</title>
    <link>https://example.com/b</link>
    <description>Keine Netzstörung, nur Gaming.</description>
  </item>
</channel></rss>`;

describe("RSS parsing and cheap filtering", () => {
  it("normalizes RSS items", () => {
    const items = parseRssFeed(fixture, "de");

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      feed_language: "de",
      title: "Stromausfall in Zürich",
      url: "https://example.com/a",
      source: "Example News"
    });
    expect(items[0].published_at).toBe("2026-06-30T08:00:00.000Z");
  });

  it("keeps outage candidates and rejects negative terms", () => {
    const items = parseRssFeed(fixture, "de");

    expect(cheapFilterItem(items[0]).candidate).toBe(true);
    expect(cheapFilterItem(items[1]).candidate).toBe(false);
  });

  it("hashes normalized title and URL deterministically", async () => {
    const [first] = parseRssFeed(fixture, "de");

    await expect(itemHash(first)).resolves.toMatch(/^[a-f0-9]{64}$/);
    await expect(itemHash({ title: " Stromausfall   in Zürich ", url: "HTTPS://EXAMPLE.COM/A" }))
      .resolves.toBe(await itemHash(first));
  });
});

describe("mock AI classification", () => {
  it("returns a relevant Swiss outage classification in mock mode", async () => {
    const [item] = parseRssFeed(fixture, "de");

    const result = await classifyItem({ AI_MOCK_MODE: "true", AI: {} as Ai }, item);

    expect(result.parsed).toMatchObject({
      is_relevant: true,
      country: "CH",
      event_type: "power_outage"
    });
    expect(result.parsed?.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it("rejects obvious telecom false positives before event creation", async () => {
    const classification: AiClassification = {
      is_relevant: true,
      confidence: 0.9,
      country: "CH",
      location_text: "Belp",
      event_type: "power_outage",
      summary: "Mögliche Störung.",
      reason: "Signal enthält Ausfallbegriffe."
    };

    const result = await assessIncidentValidity(
      { AI_MOCK_MODE: "true", AI: {} as Ai },
      {
        feed_language: "de",
        title: "Swisscom-Störung in Belp",
        url: "https://example.com/swisscom",
        source: "Example",
        snippet: "Internet und Telefon sind wegen einer Netzstörung betroffen.",
        published_at: null
      },
      classification
    );

    expect(result.parsed).toMatchObject({
      is_actual_outage_incident: false,
      false_positive_type: "telecom"
    });
  });
});
