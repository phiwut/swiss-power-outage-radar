import type { Env, OutageEvent, OutageSource } from "./types";

function eventLocation(event: OutageEvent): string {
  return event.location_text?.trim() || "Ort unklar";
}

function eventSubject(event: OutageEvent, kind: "new" | "update"): string {
  if (kind === "update") {
    return `[Stromausfall Radar] Update: ${eventLocation(event)} - ${event.source_count} Quellen`;
  }

  return `[Stromausfall Radar] Möglicher Vorfall: ${eventLocation(event)}`;
}

function eventBody(event: OutageEvent, sources: OutageSource[]): string {
  const primary = sources.find((source) => source.is_primary === 1) ?? sources[0];
  const eventUrl = `https://outage.ch/events/${event.id}`;
  const sourceLines = sources
    .filter((source) => source.id !== primary?.id)
    .slice(0, 5)
    .map((source) => `${source.source_title}\n${source.source_url}`)
    .join("\n\n");

  return `Möglicher Stromausfall / Netzunterbruch erkannt

Status:
${event.status}

Ort:
${event.location_text || "nicht eindeutig erkannt"}

Kurzfassung:
${event.summary ?? ""}

Warum erstellt:
${event.reason ?? ""}

Confidence:
${event.confidence}

Quellen:
${primary ? `${primary.source_title}\n${primary.source_url}` : "Keine Quelle gespeichert"}

${sourceLines ? `Weitere Quellen:\n${sourceLines}` : ""}

Event-Akte:
${eventUrl}

Hinweis:
Dies ist eine automatische Vorprüfung aus Google Alerts. Der Vorfall ist noch nicht offiziell verifiziert.`;
}

export async function sendEventEmail(
  env: Pick<Env, "EMAIL" | "NOTIFY_EMAIL" | "FROM_EMAIL" | "EMAIL_MOCK_MODE">,
  event: OutageEvent,
  sources: OutageSource[],
  kind: "new" | "update"
): Promise<void> {
  if (env.EMAIL_MOCK_MODE === "true") return;

  if (!env.NOTIFY_EMAIL || !env.FROM_EMAIL) {
    throw new Error("Missing NOTIFY_EMAIL or FROM_EMAIL");
  }

  try {
    await env.EMAIL.send({
      from: env.FROM_EMAIL,
      to: env.NOTIFY_EMAIL,
      subject: eventSubject(event, kind),
      text: eventBody(event, sources),
      headers: {
        "X-Outage-Event-ID": String(event.id),
        "X-Outage-Event-Kind": kind
      }
    });
  } catch (error) {
    const name = error instanceof Error && error.name ? `${error.name}: ` : "";
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Email send failed for event ${event.id}: ${name}${message}`);
  }
}
