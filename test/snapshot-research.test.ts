import { afterEach, describe, expect, it, vi } from "vitest";
import { isBearerAuthorized } from "../src/auth";
import { normalizeUrl, scoreExaResultForEvent } from "../src/research";
import { createSourceSnapshot } from "../src/snapshots";
import type { OutageEvent, SourceSnapshot } from "../src/types";

function fakeSnapshotDb() {
  let row: SourceSnapshot | null = null;
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bound = values;
          return this;
        },
        async run() {
          if (sql.includes("UPDATE source_snapshots")) {
            if (row) {
              row = {
                ...row,
                public_summary_de: bound[0] as string | null,
                public_key_points_json: bound[1] as string | null,
                public_relevance_label: bound[2] as SourceSnapshot["public_relevance_label"],
                public_facts_json: bound[3] as string | null,
                digest_generated_at: bound[4] as string | null,
                digest_error: bound[5] as string | null
              };
            }
            return { meta: { changes: row ? 1 : 0 } };
          }
          if (!sql.includes("INSERT INTO source_snapshots")) {
            throw new Error(`Unexpected run SQL: ${sql}`);
          }
          row = {
            id: 1,
            alert_item_id: bound[0] as number | null,
            outage_event_id: bound[1] as number | null,
            outage_source_id: bound[2] as number | null,
            url: bound[3] as string,
            final_url: bound[4] as string | null,
            fetch_method: bound[5] as string,
            fetch_status: bound[6] as "success" | "failed",
            http_status: bound[7] as number | null,
            title: bound[8] as string | null,
            markdown_r2_key: bound[9] as string | null,
            markdown_excerpt: bound[10] as string | null,
            content_hash: bound[11] as string | null,
            fetched_at: bound[12] as string,
            error: bound[13] as string | null,
            public_summary_de: null,
            public_key_points_json: null,
            public_relevance_label: null,
            public_facts_json: null,
            digest_generated_at: null,
            digest_error: null,
            created_at: "2026-06-30 00:00:00",
            updated_at: "2026-06-30 00:00:00"
          };
          return { meta: { last_row_id: 1 } };
        },
        async first() {
          return row;
        }
      };
    }
  } as unknown as D1Database;
}

const target = {
  event: { id: 10 },
  source: {
    id: 20,
    source_url: "https://example.com/story",
    source_title: "Stromausfall in Wohlen"
  },
  alertItem: { id: 30 }
};

describe("source snapshots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores markdown in R2 and D1 metadata only", async () => {
    const puts: Array<{ key: string; value: unknown; options?: R2PutOptions }> = [];
    const snapshot = await createSourceSnapshot(
      {
        DB: fakeSnapshotDb(),
        BROWSER_MOCK_MODE: "true",
        BROWSER: {} as BrowserRun,
        SNAPSHOTS: {
          async put(key: string, value: unknown, options?: R2PutOptions) {
            puts.push({ key, value, options });
            return null;
          }
        } as unknown as R2Bucket
      },
      target,
      "2026-06-30T10:00:00.000Z"
    );

    expect(snapshot.fetch_status).toBe("success");
    expect(snapshot.markdown_r2_key).toMatch(/^snapshots\/2026-06-30\/event-10\/source-20-/);
    expect(snapshot.markdown_excerpt).toContain("Mock Markdown Snapshot");
    expect(puts).toHaveLength(2);
    expect(puts[1]?.key).toBe(`evidence/snapshot-${snapshot.id}.png`);
    expect((puts[1]?.options?.httpMetadata as R2HTTPMetadata | undefined)?.contentType).toBe("image/png");
    expect(puts[1]?.options?.customMetadata?.compression).toBe("lossless");
  });

  it("creates a compact public source digest when AI is available", async () => {
    const db = fakeSnapshotDb();
    const snapshot = await createSourceSnapshot(
      {
        DB: db,
        BROWSER_MOCK_MODE: "true",
        AI_MOCK_MODE: "true",
        BROWSER: {} as BrowserRun,
        AI: {} as Ai,
        SNAPSHOTS: {
          async put() {
            return null;
          }
        } as unknown as R2Bucket
      },
      {
        ...target,
        event: { id: 10, title: "Stromausfall in Wohlen", summary: "Möglicher Stromausfall." }
      },
      "2026-06-30T10:00:00.000Z"
    );

    const stored = await db.prepare("SELECT * FROM source_snapshots WHERE id = ?").first<SourceSnapshot>();
    expect(stored?.fetch_status).toBe("success");
    expect(stored?.public_summary_de).toContain("Stromausfall in Wohlen");
    expect(stored?.public_key_points_json).toContain("Mock Markdown Snapshot");
  });

  it("falls back to Jina markdown when Cloudflare markdown fails", async () => {
    const puts: Array<{ key: string; value: string }> = [];
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("https://r.jina.ai/https://example.com/story");
      return new Response("# Jina Snapshot\n\nFallback markdown body.", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await createSourceSnapshot(
      {
        DB: fakeSnapshotDb(),
        BROWSER: {
          async quickAction() {
            return Response.json({ success: false, errors: [{ message: "blocked" }] }, { status: 422 });
          }
        } as unknown as BrowserRun,
        SNAPSHOTS: {
          async put(key: string, value: string) {
            puts.push({ key, value });
            return null;
          }
        } as unknown as R2Bucket
      },
      target,
      "2026-06-30T10:00:00.000Z"
    );

    expect(snapshot.fetch_status).toBe("success");
    expect(snapshot.fetch_method).toBe("jina_markdown_fallback");
    expect(snapshot.title).toBe("Jina Snapshot");
    expect(snapshot.markdown_excerpt).toContain("Fallback markdown body");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(puts).toHaveLength(1);
  });

  it("persists failed markdown attempts without throwing when both providers fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("jina blocked", { status: 502 }))
    );

    const snapshot = await createSourceSnapshot(
      {
        DB: fakeSnapshotDb(),
        BROWSER: {
          async quickAction() {
            return Response.json({ success: false, errors: [{ message: "blocked" }] }, { status: 422 });
          }
        } as unknown as BrowserRun,
        SNAPSHOTS: {
          async put() {
            throw new Error("should not write failed markdown");
          }
        } as unknown as R2Bucket
      },
      target,
      "2026-06-30T10:00:00.000Z"
    );

    expect(snapshot.fetch_status).toBe("failed");
    expect(snapshot.error).toContain("blocked");
    expect(snapshot.markdown_r2_key).toBeNull();
  });
});

describe("manual research guardrails", () => {
  it("normalizes URLs for Exa deduplication", () => {
    expect(normalizeUrl("https://example.com/a/?b=2&a=1#section")).toBe("https://example.com/a/?a=1&b=2");
    expect(normalizeUrl("https://example.com/a/")).toBe("https://example.com/a");
  });

  it("requires a matching Bearer token for protected research actions", () => {
    expect(isBearerAuthorized(null, "secret")).toBe(false);
    expect(isBearerAuthorized("Bearer wrong", "secret")).toBe(false);
    expect(isBearerAuthorized("Bearer secret", "secret")).toBe(true);
  });

  it("scores timely local Exa results above stale historical matches", () => {
    const event = {
      id: 6,
      title: "Möglicher Stromausfall / Netzunterbruch: Murgenthal",
      status: "needs_review",
      event_type: "power_outage",
      location_text: "Murgenthal",
      normalized_location: "murgenthal",
      canton: null,
      country: "CH",
      first_seen_at: "2026-06-30T12:52:16.000Z",
      last_seen_at: "2026-06-30T12:52:16.000Z",
      started_at_estimate: null,
      resolved_at_estimate: null,
      summary: "Stromunterbruch in Murgenthal.",
      reason: "Google Alert.",
      confidence: 0.96,
      source_count: 1,
      primary_source_url: "https://www.murgenthal.ch/news",
      primary_source_title: "Bauarbeiten Weidhoger",
      email_sent: 1,
      email_sent_at: "2026-06-30T13:00:00.000Z",
      update_email_sent_at: null,
      merged_into_event_id: null,
      admin_note: null,
      outage_nature: "unknown",
      cause_category: "unknown",
      cause_text: null,
      research_status: "not_started",
      research_started_at: null,
      research_finished_at: null,
      research_summary_de: null,
      fact_confidence: null,
      event_score: null,
      evidence_level: null,
      fact_sheet_json: null,
      fact_sheet_updated_at: null,
      auto_research_started_at: null,
      mail_decision_reason: null,
      public_status: "hidden",
      verification_level: "auto_analyzed",
      location_granularity: "municipality",
      event_quality_state: "candidate_only",
      created_at: "2026-06-30 13:00:00",
      updated_at: "2026-06-30 13:00:00"
    } satisfies OutageEvent;

    const timely = scoreExaResultForEvent(
      {
        title: "Bauarbeiten Weidhoger - Verkehrsführung und Stromunterbruch - Murgenthal",
        url: "https://www.murgenthal.ch/verwaltung/news/aktuelles.html/276/news/2637",
        publishedDate: "2026-06-30T12:50:00.000Z",
        highlights: ["Stromunterbruch in Murgenthal wegen Bauarbeiten am Netz."]
      },
      event
    );
    const stale = scoreExaResultForEvent(
      {
        title: "Stromausfall an Heiligabend in Murgenthal",
        url: "https://example.ch/archiv/stromausfall-murgenthal",
        publishedDate: "2025-12-25T01:00:00.000Z",
        highlights: ["Archivmeldung zu Weihnachten."]
      },
      event
    );

    expect(timely?.score).toBeGreaterThanOrEqual(62);
    expect(stale?.score).toBeLessThan(62);
  });

  it("does not accept undated Exa matches on keywords alone", () => {
    const event = {
      id: 6,
      title: "Möglicher Stromausfall / Netzunterbruch: Murgenthal",
      status: "needs_review",
      event_type: "power_outage",
      location_text: "Murgenthal",
      normalized_location: "murgenthal",
      canton: null,
      country: "CH",
      first_seen_at: "2026-06-30T12:52:16.000Z",
      last_seen_at: "2026-06-30T12:52:16.000Z",
      started_at_estimate: null,
      resolved_at_estimate: null,
      summary: "Stromunterbruch in Murgenthal.",
      reason: "Google Alert.",
      confidence: 0.96,
      source_count: 1,
      primary_source_url: "https://www.murgenthal.ch/news",
      primary_source_title: "Bauarbeiten Weidhoger",
      email_sent: 1,
      email_sent_at: "2026-06-30T13:00:00.000Z",
      update_email_sent_at: null,
      merged_into_event_id: null,
      admin_note: null,
      outage_nature: "unknown",
      cause_category: "unknown",
      cause_text: null,
      research_status: "not_started",
      research_started_at: null,
      research_finished_at: null,
      research_summary_de: null,
      fact_confidence: null,
      event_score: null,
      evidence_level: null,
      fact_sheet_json: null,
      fact_sheet_updated_at: null,
      auto_research_started_at: null,
      mail_decision_reason: null,
      public_status: "hidden",
      verification_level: "auto_analyzed",
      location_granularity: "municipality",
      event_quality_state: "candidate_only",
      created_at: "2026-06-30 13:00:00",
      updated_at: "2026-06-30 13:00:00"
    } satisfies OutageEvent;

    const undated = scoreExaResultForEvent(
      {
        title: "Stromausfall / Stromunterbruch - Murgenthal",
        url: "https://www.murgenthal.ch/verwaltung/news/aktuelles.html/276/news/old",
        highlights: ["Stromausfall in Murgenthal."]
      },
      event
    );

    expect(undated?.score).toBeLessThan(64);
  });
});
