import { insertSourceSnapshot } from "./db";
import type { Env, OutageEvent, OutageSource, SourceSnapshot, StoredAlertItem } from "./types";

interface SnapshotTarget {
  event: Pick<OutageEvent, "id">;
  source: Pick<OutageSource, "id" | "source_url" | "source_title">;
  alertItem?: Pick<StoredAlertItem, "id"> | null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function excerpt(markdown: string): string {
  return markdown
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function snapshotKey(eventId: number, sourceId: number, hash: string, fetchedAt: string): string {
  const day = fetchedAt.slice(0, 10);
  return `snapshots/${day}/event-${eventId}/source-${sourceId}-${hash.slice(0, 16)}.md`;
}

function unwrapGoogleAlertUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const target = parsed.searchParams.get("url");
    if ((hostname === "google.com" || hostname === "google.ch") && target) {
      return target;
    }
  } catch {
    return value;
  }
  return value;
}

async function parseBrowserMarkdownResponse(response: Response): Promise<{
  markdown: string;
  title: string | null;
  httpStatus: number | null;
  error: string | null;
}> {
  const httpStatus = response.status;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    const text = await response.text().catch(() => "");
    return { markdown: "", title: null, httpStatus, error: text || `HTTP ${httpStatus}` };
  }

  const record = payload as Record<string, unknown>;
  if (record.success === true && typeof record.result === "string") {
    const meta = record.meta as Record<string, unknown> | undefined;
    return {
      markdown: record.result,
      title: typeof meta?.title === "string" ? meta.title : null,
      httpStatus: typeof meta?.status === "number" ? meta.status : httpStatus,
      error: null
    };
  }

  const errors = Array.isArray(record.errors)
    ? record.errors
        .map((error) => {
          const err = error as Record<string, unknown>;
          return [err.message, err.code, err.detail].filter(Boolean).join(" ");
        })
        .join("; ")
    : `HTTP ${httpStatus}`;
  return { markdown: "", title: null, httpStatus, error: errors };
}

export async function createSourceSnapshot(
  env: Pick<Env, "DB" | "BROWSER" | "SNAPSHOTS" | "BROWSER_MOCK_MODE">,
  target: SnapshotTarget,
  fetchedAt = new Date().toISOString()
): Promise<SourceSnapshot> {
  const fetchUrl = unwrapGoogleAlertUrl(target.source.source_url);
  const base = {
    alertItemId: target.alertItem?.id ?? null,
    outageEventId: target.event.id,
    outageSourceId: target.source.id,
    url: target.source.source_url,
    finalUrl: fetchUrl,
    fetchMethod: "cloudflare_browser_markdown",
    fetchedAt
  };

  try {
    const parsed =
      env.BROWSER_MOCK_MODE === "true"
        ? {
            markdown: `# ${target.source.source_title}\n\nMock Markdown Snapshot for ${target.source.source_url}`,
            title: target.source.source_title,
            httpStatus: 200,
            error: null
          }
        : await parseBrowserMarkdownResponse(
            await env.BROWSER.quickAction("markdown", {
              url: fetchUrl,
              cacheTTL: 0,
              bestAttempt: true,
              gotoOptions: {
                timeout: 30000,
                waitUntil: "domcontentloaded"
              },
              userAgent: "swiss-power-outage-radar/0.2"
            })
          );

    if (parsed.error || !parsed.markdown.trim()) {
      return await insertSourceSnapshot(env.DB, {
        ...base,
        fetchStatus: "failed",
        httpStatus: parsed.httpStatus,
        title: parsed.title,
        markdownR2Key: null,
        markdownExcerpt: null,
        contentHash: null,
        error: parsed.error || "Markdown response was empty"
      });
    }

    const contentHash = await sha256Hex(parsed.markdown);
    const key = snapshotKey(target.event.id, target.source.id, contentHash, fetchedAt);
    await env.SNAPSHOTS.put(key, parsed.markdown, {
      httpMetadata: {
        contentType: "text/markdown; charset=utf-8"
      },
      customMetadata: {
        source_url: target.source.source_url,
        final_url: fetchUrl,
        outage_event_id: String(target.event.id),
        outage_source_id: String(target.source.id),
        content_hash: contentHash
      }
    });

    return await insertSourceSnapshot(env.DB, {
      ...base,
      fetchStatus: "success",
      httpStatus: parsed.httpStatus,
      title: parsed.title,
      markdownR2Key: key,
      markdownExcerpt: excerpt(parsed.markdown),
      contentHash,
      error: null
    });
  } catch (error) {
    return await insertSourceSnapshot(env.DB, {
      ...base,
      fetchStatus: "failed",
      httpStatus: null,
      title: null,
      markdownR2Key: null,
      markdownExcerpt: null,
      contentHash: null,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
