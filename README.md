# Swiss Power Outage Radar

Schlanker Cloudflare-MVP: ein Worker startet alle 15 Minuten den Workflow `check-alert-feeds`, prüft drei Google-Alerts-RSS-Feeds, dedupliziert neue Items in D1, filtert billige Nicht-Kandidaten, klassifiziert Kandidaten mit Workers AI und gruppiert relevante Treffer in vorsichtige `outage_events` mit Quellen. Orte werden opportunistisch über die offizielle geo.admin.ch-Location-Suche normalisiert, mit lokalem Fallback. Neue mögliche Ereignisse senden eine Mail über Cloudflare Email Sending an Philipp. Relevante Quellen werden intern als Markdown-Snapshot in R2 gesichert; D1 speichert nur Metadaten und kurze Auszüge.

Kein Portal, keine Karte, kein Strommix, kein Firecrawl. Webrecherche läuft nicht im Cron, sondern nur manuell per Admin-Klick. Ein `outage_event` ist keine offizielle Verifikation, sondern eine automatische Ereignis-Akte aus Google Alerts und optionaler manueller Recherche.

## Setup

```bash
npm install
npm run typecheck
npm test
```

## D1 erstellen

```bash
npx wrangler d1 create swiss-power-outage-radar
```

Die ausgegebene `database_id` in `wrangler.jsonc` unter `d1_databases[0].database_id` eintragen.

## Migration anwenden

Lokal:

```bash
npm run db:migrate:local
```

Remote:

```bash
npm run db:migrate:remote
```

## Secrets setzen

Keine Secrets ins Repo committen. Die Feed-URLs und Mail-Adressen stehen als nicht geheime `vars` in `wrangler.jsonc`. Für Produktion werden diese Secrets benötigt:

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put EXA_API_KEY
```

Lokale Entwicklung kann mit einer nicht committed `.dev.vars` arbeiten:

```dotenv
ALERT_FEED_DE="http://127.0.0.1:8788/mock-feed.xml"
ALERT_FEED_FR="http://127.0.0.1:8788/mock-feed.xml"
ALERT_FEED_IT="http://127.0.0.1:8788/mock-feed.xml"
ADMIN_TOKEN="local-admin-token"
NOTIFY_EMAIL="pw@bimex.ch"
FROM_EMAIL="alert@outage.ch"
AI_MOCK_MODE="true"
EMAIL_MOCK_MODE="true"
BROWSER_MOCK_MODE="true"
EXA_MOCK_MODE="true"
```

`AI_MOCK_MODE`, `EMAIL_MOCK_MODE`, `BROWSER_MOCK_MODE` und `EXA_MOCK_MODE` sind nur für lokale Smoke-Tests gedacht. In Produktion weglassen.

## R2 und Browser Run

Snapshots werden in R2 gespeichert. Einmalig:

```bash
npx wrangler r2 bucket create outage-source-snapshots
```

Der Worker bindet den Bucket als `SNAPSHOTS`. Cloudflare Browser Run ist als Binding `BROWSER` konfiguriert und nutzt die Quick Action `markdown`. Vollständige Markdown-Snapshots werden nicht öffentlich angezeigt.

## Cloudflare Email Sending

Der Worker nutzt das `send_email` Binding `EMAIL`. Cloudflare Email Sending muss fuer `alert@outage.ch` eingerichtet und verifiziert sein. Die Binding-Konfiguration beschränkt Sender und Empfänger auf:

- Sender: `alert@outage.ch`
- Empfänger: `pw@bimex.ch`

## Lokal testen

Fixture-Server starten:

```bash
npx http-server fixtures -p 8788
```

In einem zweiten Terminal:

```bash
npm run db:migrate:local
npm run dev
```

Manuellen Lauf starten:

```bash
curl -X POST http://127.0.0.1:8787/run \
  -H "Authorization: Bearer local-admin-token"
```

Status prüfen:

```bash
curl http://127.0.0.1:8787/status \
  -H "Authorization: Bearer local-admin-token"

curl http://127.0.0.1:8787/recent \
  -H "Authorization: Bearer local-admin-token"
```

Die öffentliche Statusseite ist unter `http://127.0.0.1:8787/` erreichbar und zeigt keine Feed-URLs oder Secrets.

## Deploy

```bash
npm run deploy
```

Nach dem Deployment:

```bash
npm run db:migrate:remote
curl -X POST https://<worker-url>/run \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Danach die Worker-URL öffnen und die Statusseite prüfen. Der Cron Trigger `*/15 * * * *` ist in `wrangler.jsonc` konfiguriert.

## Endpunkte

- `GET /` öffentliche HTML-Statusseite ohne Secrets und ohne Feed-URLs, mit letzten Event-Akten
- `GET /events/:id` öffentliche Event-Akte mit Quellenliste
- `GET /status` geschützter JSON-Debugstatus
- `POST /run` geschützter manueller Workflow-Start
- `GET /recent` geschützte letzte 20 Items
- `POST /admin/events/:id/merge` geschütztes Merge von Event `:id` in `target_event_id`
- `POST /admin/events/:id/dismiss` geschütztes Dismiss eines Events
- `POST /admin/events/:id/corroborate` geschütztes Markieren als `corroborated`
- `POST /admin/events/:id/research` geschützte manuelle Recherche via Exa, kleine Result-Sets, Snapshots in R2, vorsichtige AI-Anreicherung

Geschützte Endpunkte verlangen:

```http
Authorization: Bearer <ADMIN_TOKEN>
```

Admin-Action-Beispiele:

```bash
curl -X POST https://outage.ch/admin/events/2/merge \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"target_event_id":1,"admin_note":"Same Wohlen incident"}'

curl -X POST https://outage.ch/admin/events/4/dismiss \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"admin_note":"Only incidental mention"}'

curl -X POST https://outage.ch/admin/events/5/corroborate \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"admin_note":"Manual source check"}'

curl -X POST https://outage.ch/admin/events/1/research \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"admin_note":"Manuelle Zusatzrecherche"}'
```

## Bekannte Limitierungen

- Google Alerts ist nicht garantiert realtime.
- KI-Ergebnis ist nur eine Vorprüfung.
- Keine offizielle Verifikation.
- geo.admin.ch-Ortsnormalisierung ist eine Datenhilfe, kein Pflichtpfad; bei Fehlern läuft der Radar mit lokalem Fallback weiter.
- Markdown-Snapshots werden intern in R2 gesichert, aber öffentlich nicht vollständig angezeigt.
- Manuelle Exa-Recherche ist eine Vorprüfung, keine offizielle Bestätigung.
- RSS-Parsing ist robust genug für RSS/Atom-Grundfelder, aber kein vollständiger XML-Validator.
