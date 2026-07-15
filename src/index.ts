import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import {
  dismissOutageEvent,
  getDebugStatus,
  getMergeSuggestionsForEvent,
  getEventPlaces,
  getOutageEvent,
  getOutageEventFacts,
  getOutageEventSources,
  getOutageEventSnapshots,
  getPublicFeedItems,
  getPublicStatus,
  getRecentItems,
  getSnapshotsNeedingPublicDigest,
  markOutageEventCorroborated,
  mergeOutageEvent,
  updateSourceSnapshotDigest
} from "./db";
import { summarizeSourceForPublic } from "./ai";
import { generateMergeSuggestions, refreshEventIntelligence } from "./event-intelligence";
import { backfillSourcePlaceMentions, syncOpenPlzLocalities } from "./places";
import { researchOutageEvent } from "./research";
import { ingestFirecrawlWebhook, revalidatePublicEvents, runAlertCheck } from "./runner";
import { loadPublicEventDetail } from "./public-detail";
import { isBearerAuthorized } from "./auth";
import type { CheckAlertFeedsParams, Env } from "./types";

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {})
    },
    status: init?.status
  });
}

async function assetResponse(env: Env, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin/") ||
    url.pathname === "/status" ||
    url.pathname === "/recent" ||
    url.pathname === "/run"
  ) {
    return null;
  }

  if (/^\/events\/\d+$/.test(url.pathname)) {
    const assetUrl = new URL(request.url);
    assetUrl.pathname = "/events/";
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    return response.status === 404 ? null : response;
  }

  const response = await env.ASSETS.fetch(request);
  return response.status === 404 ? null : response;
}

function unauthorized(): Response {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

function isAuthorized(request: Request, env: Env): boolean {
  return isBearerAuthorized(request.headers.get("Authorization"), env.ADMIN_TOKEN);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) return {};
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function bodyNote(body: Record<string, unknown>): string | null {
  const note = body.admin_note ?? body.note;
  if (note === undefined || note === null) return null;
  return String(note).slice(0, 1000);
}

function renderStatusPage(status: Awaited<ReturnType<typeof getPublicStatus>>): string {
  const totals = (status.totals ?? {}) as Record<string, unknown>;
  const lastRun = (status.lastRun ?? {}) as Record<string, unknown>;
  const feedHealth = status.feedHealth as Record<string, unknown>[];
  const events = status.events as Record<string, unknown>[];

  const feeds = feedHealth
    .map(
      (feed) => `<tr>
        <td>${escapeHtml(feed.feed_language)}</td>
        <td>${escapeHtml(feed.last_success_at ?? "-")}</td>
        <td>${escapeHtml(feed.items_seen_last_run ?? 0)}</td>
        <td>${escapeHtml(feed.items_new_last_run ?? 0)}</td>
        <td>${escapeHtml(feed.last_error ?? "")}</td>
      </tr>`
    )
    .join("");

  const rows = events
    .map(
      (event) => `<tr>
        <td>${escapeHtml(event.last_seen_at ?? event.first_seen_at ?? "-")}</td>
        <td>${escapeHtml(event.location_text ?? "nicht eindeutig erkannt")}</td>
        <td>${escapeHtml(event.status ?? "-")}</td>
        <td>${escapeHtml(event.source_count ?? 0)}</td>
        <td>${escapeHtml(event.confidence ?? "-")}</td>
        <td><a href="/events/${escapeHtml(event.id)}">Akte öffnen</a></td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stromausfall Radar</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f8f9; color: #172026; }
    main { max-width: 1080px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin: 0 0 6px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 18px; }
    .muted { color: #5c6b73; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0 4px; }
    .metric { background: white; border: 1px solid #dde3e7; border-radius: 8px; padding: 14px; }
    .metric strong { display: block; font-size: 28px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #dde3e7; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #edf1f3; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: #eef3f6; font-size: 12px; text-transform: uppercase; letter-spacing: 0; }
    a { color: #0068a8; }
    @media (prefers-color-scheme: dark) {
      body { background: #101417; color: #e8ecef; }
      .muted { color: #9aa7af; }
      .metric, table { background: #171d21; border-color: #303a40; }
      th { background: #20282d; }
      th, td { border-bottom-color: #2a3339; }
      a { color: #79c6ff; }
    }
  </style>
</head>
<body>
<main>
  <h1>Stromausfall Radar</h1>
  <p class="muted">Automatisches Monitoring aus Google Alerts. Feed-URLs und Secrets werden hier nicht angezeigt.</p>

  <section class="grid" aria-label="Kennzahlen">
    <div class="metric">Letzter Run<strong>${escapeHtml(lastRun.status ?? "-")}</strong><span class="muted">${escapeHtml(lastRun.finished_at ?? lastRun.started_at ?? "-")}</span></div>
    <div class="metric">Items 24h<strong>${escapeHtml(totals.items_last_24h ?? 0)}</strong></div>
    <div class="metric">Events 24h<strong>${escapeHtml(totals.events_last_24h ?? 0)}</strong></div>
    <div class="metric">Mails 24h<strong>${escapeHtml(totals.emails_last_24h ?? 0)}</strong></div>
  </section>

  <h2>Feed-Status</h2>
  <table>
    <thead><tr><th>Sprache</th><th>Letzter Erfolg</th><th>Gesehen</th><th>Neu</th><th>Fehler</th></tr></thead>
    <tbody>${feeds || `<tr><td colspan="5">Noch keine Feed-Prüfung.</td></tr>`}</tbody>
  </table>

  <h2>Letzte Event-Akten</h2>
  <table>
    <thead><tr><th>Zeit</th><th>Ort</th><th>Status</th><th>Quellen</th><th>Confidence</th><th>Link</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">Noch keine Event-Akten.</td></tr>`}</tbody>
  </table>
</main>
</body>
</html>`;
}

async function renderEventPage(env: Env, eventId: number): Promise<Response> {
  const event = await getOutageEvent(env.DB, eventId);
  if (!event) return new Response("Event nicht gefunden", { status: 404 });
  if (
    event.status === "dismissed" ||
    event.country !== "CH" ||
    (event.public_status ?? "hidden") === "hidden" ||
    (event.event_quality_state ?? "candidate_only") !== "publishable"
  ) {
    return new Response("Event nicht öffentlich", { status: 404 });
  }

  const sources = await getOutageEventSources(env.DB, eventId);
  const sourceRows = sources
    .map(
      (source) => `<tr>
        <td><a href="${escapeHtml(source.source_url)}" rel="noreferrer">${escapeHtml(source.source_title)}</a></td>
        <td>${escapeHtml(source.source_name ?? "-")}</td>
        <td>${escapeHtml(source.published_at ?? "-")}</td>
        <td>${escapeHtml(source.relation_score ?? "-")}</td>
      </tr>`
    )
    .join("");

  return new Response(`<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(event.title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f8f9; color: #172026; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px 48px; }
    a { color: #0068a8; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 18px; }
    .muted { color: #5c6b73; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 20px 0; }
    .metric { background: white; border: 1px solid #dde3e7; border-radius: 8px; padding: 14px; }
    .metric span { display: block; color: #5c6b73; font-size: 12px; text-transform: uppercase; }
    .panel { background: white; border: 1px solid #dde3e7; border-radius: 8px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #dde3e7; border-radius: 8px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #edf1f3; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: #eef3f6; font-size: 12px; text-transform: uppercase; letter-spacing: 0; }
    @media (prefers-color-scheme: dark) {
      body { background: #101417; color: #e8ecef; }
      .muted, .metric span { color: #9aa7af; }
      .metric, .panel, table { background: #171d21; border-color: #303a40; }
      th { background: #20282d; }
      th, td { border-bottom-color: #2a3339; }
      a { color: #79c6ff; }
    }
  </style>
</head>
<body>
<main>
  <p><a href="/">Zurück zur Übersicht</a></p>
  <h1>${escapeHtml(event.title)}</h1>
  <p class="muted">Automatisch erkannte Ereignis-Akte. Nicht offiziell verifiziert.</p>

  <section class="grid">
    <div class="metric"><span>Status</span>${escapeHtml(event.status)}</div>
    <div class="metric"><span>Ort</span>${escapeHtml(event.location_text || "nicht eindeutig erkannt")}</div>
    <div class="metric"><span>Typ</span>${escapeHtml(event.event_type)}</div>
    <div class="metric"><span>Confidence</span>${escapeHtml(event.confidence)}</div>
    <div class="metric"><span>First seen</span>${escapeHtml(event.first_seen_at)}</div>
    <div class="metric"><span>Last seen</span>${escapeHtml(event.last_seen_at)}</div>
    <div class="metric"><span>Quellen</span>${escapeHtml(event.source_count)}</div>
  </section>

  <h2>Zusammenfassung</h2>
  <div class="panel">${escapeHtml(event.summary ?? "")}</div>

  <h2>Warum relevant</h2>
  <div class="panel">${escapeHtml(event.reason ?? "")}</div>

  <h2>Quellen</h2>
  <table>
    <thead><tr><th>Titel</th><th>Quelle</th><th>Publiziert</th><th>Score</th></tr></thead>
    <tbody>${sourceRows || `<tr><td colspan="4">Keine Quellen gespeichert.</td></tr>`}</tbody>
  </table>
</main>
</body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function startWorkflow(env: Env, params: CheckAlertFeedsParams) {
  return await env.CHECK_ALERT_FEEDS.create({
    id: `check-${crypto.randomUUID()}`,
    params
  });
}

export class CheckAlertFeedsWorkflow extends WorkflowEntrypoint<Env, CheckAlertFeedsParams> {
  async run(event: WorkflowEvent<CheckAlertFeedsParams>, step: WorkflowStep): Promise<void> {
    if (event.payload.revalidatePublicEvents) {
      await step.do("revalidate public events", async () => {
        const report = await revalidatePublicEvents(this.env, {
          apply: event.payload.apply === true,
          limit: event.payload.limit
        });
        console.log(JSON.stringify({ type: "public_revalidation", ...report }));
      });
      return;
    }
    await step.do(
      "check google alert feeds",
      {
        retries: {
          limit: 1,
          delay: "10 seconds",
          backoff: "constant"
        },
        timeout: "5 minutes"
      },
      async () => {
        await runAlertCheck(this.env);
      }
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const asset = await assetResponse(env, request);
    if (asset) return asset;

    if ((url.pathname === "/api/public/events" || url.pathname === "/api/public/status") && request.method === "GET") {
      const requestedLimit = Number(url.searchParams.get("limit") ?? 10);
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(10, Math.floor(requestedLimit))) : 10;
      const before = url.searchParams.get("before");
      return json({
        ...(await getPublicFeedItems(env.DB, { limit, before })),
        generated_at: new Date().toISOString()
      });
    }

    const publicEventMatch = url.pathname.match(/^\/api\/public\/events\/(\d+)$/);
    if (publicEventMatch && request.method === "GET") {
      const eventId = Number(publicEventMatch[1]);
      const detail = await loadPublicEventDetail(env, eventId);
      if (!detail) return json({ error: "Not found" }, { status: 404 });
      return json(detail);
    }

    if (url.pathname === "/" && request.method === "GET") {
      const status = await getPublicStatus(env.DB);
      return new Response(renderStatusPage(status), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }

    const eventMatch = url.pathname.match(/^\/events\/(\d+)$/);
    if (eventMatch && request.method === "GET") {
      return await renderEventPage(env, Number(eventMatch[1]));
    }

    if (url.pathname === "/status" && request.method === "GET") {
      if (!isAuthorized(request, env)) return unauthorized();
      return json(await getDebugStatus(env.DB));
    }

    if (url.pathname === "/recent" && request.method === "GET") {
      if (!isAuthorized(request, env)) return unauthorized();
      return json({ items: await getRecentItems(env.DB) });
    }

    if (url.pathname === "/api/firecrawl/webhook" && request.method === "POST") {
      const webhookSecret = request.headers.get("x-firecrawl-webhook-secret");
      const webhookAuthorized =
        Boolean(env.FIRECRAWL_WEBHOOK_SECRET) && webhookSecret === env.FIRECRAWL_WEBHOOK_SECRET;
      if (!webhookAuthorized && !isAuthorized(request, env)) return unauthorized();
      try {
        const body = await readJsonBody(request);
        const result = await ingestFirecrawlWebhook(env, body);
        return json({ ok: result.accepted, ...result }, { status: result.accepted ? 200 : 202 });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    if (url.pathname === "/admin/events/revalidate" && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      const body = await readJsonBody(request);
      return json(await revalidatePublicEvents(env, {
        apply: body.apply === true,
        limit: typeof body.limit === "number" ? body.limit : undefined
      }));
    }

    const adminMergeMatch = url.pathname.match(/^\/admin\/events\/(\d+)\/merge$/);
    if (adminMergeMatch && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      try {
        const body = await readJsonBody(request);
        const targetEventId = Number(body.target_event_id ?? body.targetEventId);
        if (!Number.isInteger(targetEventId) || targetEventId <= 0) {
          return badRequest("target_event_id is required");
        }

        const result = await mergeOutageEvent(
          env.DB,
          Number(adminMergeMatch[1]),
          targetEventId,
          bodyNote(body)
        );
        const target = await refreshEventIntelligence(env, result.target.id, { useAiFactSheet: true });
        await generateMergeSuggestions(env, target.id);
        return json({ ok: true, action: "merge", source: result.source, target });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    const adminDismissMatch = url.pathname.match(/^\/admin\/events\/(\d+)\/dismiss$/);
    if (adminDismissMatch && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      try {
        const body = await readJsonBody(request);
        const event = await dismissOutageEvent(env.DB, Number(adminDismissMatch[1]), bodyNote(body));
        return json({ ok: true, action: "dismiss", event });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    const adminCorroborateMatch = url.pathname.match(/^\/admin\/events\/(\d+)\/corroborate$/);
    if (adminCorroborateMatch && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      try {
        const body = await readJsonBody(request);
        const event = await markOutageEventCorroborated(
          env.DB,
          Number(adminCorroborateMatch[1]),
          bodyNote(body)
        );
        return json({ ok: true, action: "corroborate", event });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    const adminResearchMatch = url.pathname.match(/^\/admin\/events\/(\d+)\/research$/);
    if (adminResearchMatch && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      try {
        const result = await researchOutageEvent(env, Number(adminResearchMatch[1]));
        return json({
          ok: true,
          action: "research",
          event: result.event,
          added_sources: result.addedSources,
          snapshots: result.snapshots
        });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    if (url.pathname === "/admin/geo/sync-openplz" && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      try {
        const body = await readJsonBody(request);
        const cantonKey = String(body.canton_key ?? body.cantonKey ?? "").trim();
        const name = String(body.name ?? "").trim();
        if (!name && !/^\d{1,2}$/.test(cantonKey)) return badRequest("canton_key or name is required");
        const result = await syncOpenPlzLocalities(env, {
          cantonKey: cantonKey || undefined,
          name: name || undefined,
          startPage: Number(body.start_page ?? body.startPage ?? 1),
          maxPages: Number(body.max_pages ?? body.maxPages ?? 2),
          pageSize: Number(body.page_size ?? body.pageSize ?? (name ? 10 : 5))
        });
        return json({ ok: true, ...result });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    if (url.pathname === "/admin/geo/backfill-places" && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      try {
        const body = await readJsonBody(request);
        const result = await backfillSourcePlaceMentions(env, {
          limit: Number(body.limit ?? 20),
          eventId: body.event_id === undefined && body.eventId === undefined
            ? null
            : Number(body.event_id ?? body.eventId)
        });
        return json({ ok: true, ...result });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    if (url.pathname === "/admin/snapshots/digest" && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      try {
        const body = await readJsonBody(request);
        const limit = Math.max(1, Math.min(3, Number(body.limit ?? 2)));
        const targets = await getSnapshotsNeedingPublicDigest(
          env.DB,
          limit,
          body.event_id === undefined && body.eventId === undefined ? null : Number(body.event_id ?? body.eventId)
        );
        let digested = 0;
        const errors: string[] = [];
        for (const target of targets) {
          const result = await summarizeSourceForPublic(env, {
            eventTitle: target.event_title || target.location_text || target.source_title || "Stromausfall",
            eventSummary: target.research_summary_de || target.event_summary || "",
            sourceTitle: target.source_title || "Quelle",
            sourceUrl: target.source_url,
            excerpt: target.markdown_excerpt
          });
          await updateSourceSnapshotDigest(
            env.DB,
            target.snapshot_id,
            result.parsed,
            new Date().toISOString(),
            result.error ?? null
          );
          if (result.parsed) digested += 1;
          else errors.push(`#${target.snapshot_id}: ${result.error ?? "digest failed"}`);
        }
        return json({ ok: true, scanned: targets.length, digested, errors });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    const adminFactSheetMatch = url.pathname.match(/^\/admin\/events\/(\d+)\/fact-sheet$/);
    if (adminFactSheetMatch && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      try {
        const eventId = Number(adminFactSheetMatch[1]);
        const event = await refreshEventIntelligence(env, eventId, { useAiFactSheet: true });
        await generateMergeSuggestions(env, eventId);
        return json({
          ok: true,
          action: "fact-sheet",
          event,
          merge_suggestions: await getMergeSuggestionsForEvent(env.DB, eventId)
        });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    if (url.pathname === "/run" && request.method === "POST") {
      if (!isAuthorized(request, env)) return unauthorized();
      const instance = await startWorkflow(env, {
        manual: true,
        requestedAt: new Date().toISOString()
      });
      return json({ ok: true, instance_id: instance.id });
    }

    return json({ error: "Not found" }, { status: 404 });
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      startWorkflow(env, {
        cron: event.cron,
        scheduledTime: event.scheduledTime
      })
    );
  }
};
