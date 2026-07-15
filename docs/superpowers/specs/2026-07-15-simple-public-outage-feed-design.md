# Einfacher öffentlicher Stromausfall-Feed

## Ziel

`outage.ch` beantwortet in wenigen Sekunden nur eine Frage: Welche belastbaren Schweizer Stromausfall-Meldungen sind zuletzt eingegangen?

Die öffentliche Seite ist kein Qualitäts-Dashboard. Interne Zustände, Scores, Parserprobleme und fehlende Fakten bleiben intern. Öffentlich erscheinen ausschließlich konkrete, ausreichend belegte Ereignisse als kompakter chronologischer Feed.

## Gewählte Lösung

Die bestehende Pipeline aus `source_registry`, `source_observations`, `alert_items`, `outage_candidates`, `outage_facts` und `outage_events` bleibt bestehen. Ergänzt wird eine einzige autoritative Publikationsentscheidung und ein schmaler öffentlicher Read-Contract. Es entsteht keine parallele Ereignisarchitektur.

### Publikationsinvariante

Ein Ereignis ist öffentlich, wenn alle Bedingungen erfüllt sind:

1. Konkreter Schweizer Ort; leere, landesweite oder generische Orte sind ausgeschlossen.
2. Beleg für einen tatsächlichen, geplanten oder behobenen Stromunterbruch; negative, historische und beiläufige Erwähnungen sind ausgeschlossen.
3. Verständliche, nicht widersprüchliche Kurzfassung.
4. Eine exakt verifizierte offizielle Ursprungsdomain oder eine etablierte glaubwürdige Medienquelle; zwei unabhängige Medienquellen werden zusätzlich als bestätigt gekennzeichnet.
5. Keine schwache Evidenz und kein nur intern prüfbarer Kandidatenstatus.

Google Alerts ist Transport und Discovery, niemals selbst Evidenz. Google-Redirects werden auf die eingebettete Original-URL kanonisiert. Offizielle Identität wird nicht aus Wörtern wie `energie`, `stadt` oder `gemeinde` abgeleitet.

## Daten- und API-Modell

Die vorhandene Source Registry wird um explizite Authority-Hosts und getrennte Health-Dimensionen erweitert. Jede öffentliche Quelle behält ihre Provenienz über `source_registry_id` beziehungsweise `source_observation_id`.

Der öffentliche Feed liefert höchstens zehn `PublicFeedItem`-Objekte:

- `id`
- `location`
- `received_at`
- optional `started_at`
- optional `resolved_at`
- `summary`
- optional `status` mit ausschließlich belegten Werten
- `trust`: `official`, `corroborated` oder `reported`
- `source`: Publishername, kanonische Original-URL und Domain

Nicht enthalten sind interne Event-Scores, Quality-Gründe, `unknown`, `needs_review`, QA-Metriken, Merge-Suggestions, Roh-Facts oder komplette Snapshots.

`received_at` bezeichnet den Eingang bei `outage.ch`. `started_at` und `resolved_at` bezeichnen nur belegte Ereigniszeiten. Die Sortierung erfolgt immer nach `received_at`.

## Revalidierung

Bestehende öffentliche Ereignisse werden mit derselben Funktion bewertet wie neue Ereignisse. Ein Dry Run listet alte und neue Entscheidung mit Gründen. Erst nach einem D1-Recovery-Punkt werden nicht mehr gültige Ereignisse auf `hidden`/`candidate_only` gesetzt; Beobachtungen, Fakten und Quellen bleiben erhalten.

## Quellenpipeline

Source Health wird getrennt in:

- Transport: erreichbar oder HTTP-/Fetch-Fehler.
- Parser: bereit, keine aktuelle Störung oder Adapter erforderlich.
- Freshness: letzte erfolgreiche Prüfung und letzte Observation.

`parser_needs_adapter` ist kein gesunder Parserzustand. Für priorisierte Betreiber werden item-spezifische Adapter mit positiven und negativen Fixtures abgesichert. Der generische Parser bleibt fail-closed.

## Oberfläche

Die Startseite verwendet einen ruhigen, schweizerisch-editorialen Meldungsfeed:

- kompakter Kopf mit `outage.ch`, Aktualisierungszeit und kurzer Erklärung;
- zehn vollständig klickbare Zeilen;
- Zeitspalte, Ort, maximal zweizeilige Zusammenfassung und genau ein Vertrauenssignal;
- sekundäre Suche, kein festes mobiles Bedienfeld;
- `Weitere laden` für ältere Meldungen;
- kein Kennzahlenband, keine Heatmap, keine Lesart-Box und kein Badge-Teppich.

Die Detailseite zeigt nur vorhandene Fakten. Rohwerte werden übersetzt, doppelte Zeitpunkte zusammengefasst und widersprüchliche Angaben nicht veröffentlicht. Originalquelle und echter Publisher sind sichtbar.

## Fehlerverhalten

- Liefert die API keine Meldungen, erklärt die Seite ruhig, dass aktuell keine belastbaren Meldungen vorliegen.
- Scheitert das Laden, bleibt die letzte statische Seitenstruktur verständlich und zeigt eine einzelne Wiederholen-Aktion.
- Parserprobleme beeinflussen die öffentliche Seite nur dadurch, dass unsichere Ereignisse fehlen; interne Fehlertexte werden nie ausgeliefert.

## Verifikation

Pflichtfälle: Marktbericht, negative Kein-Störung-Seite, Selectra- und Nau-Falschklassifikation, Google-Redirect, offizielle Betreiberquelle, zwei unabhängige glaubwürdige Quellen, widersprüchliche Ursache, Revalidierung alter Ereignisse, Public-DTO-Vertrag, leere Ansicht sowie responsive Browser-Smokes bei 375 und 1440 Pixeln.

## Selbstprüfung

- Keine Platzhalter oder offenen Produktentscheidungen.
- Architektur, Datenvertrag und Oberfläche verwenden dieselbe Publikationsinvariante.
- Scope bleibt auf öffentlicher Datenqualität und Feed-Erfahrung begrenzt.
- „Neueste“ bedeutet ausdrücklich Eingang bei `outage.ch`, nicht vermuteter Ereignisbeginn.
