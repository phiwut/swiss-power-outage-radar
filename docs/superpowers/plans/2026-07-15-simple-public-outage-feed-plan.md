# Refactor-Plan: Einfacher öffentlicher Stromausfall-Feed

## Aktueller Zustand

Die öffentliche API liefert rohe Event- und Betriebsdaten. Drei Quality-Pfade treffen teilweise widersprüchliche Publikationsentscheidungen. Offizielle Quellen werden durch breite Text-/Host-Teilstrings erkannt. Die direkte Registry-Pipeline ist überwiegend fail-closed, während Google Alerts weiterhin öffentliche Ereignisse erzeugt. Bestehende Ereignisse werden nach Regeländerungen nicht systematisch revalidiert.

## Zielzustand

Eine zentrale, testbare Publikationsfunktion entscheidet fail-closed. API und UI konsumieren einen kleinen Feed-DTO. Alte Ereignisse werden sicher revalidiert. Die direkte Quellenpipeline weist Transport-, Parser- und Freshness-Zustand getrennt aus. Die Startseite ist eine kompakte Liste der zehn neuesten belastbaren Meldungen.

## Betroffene Dateien

| Datei | Änderung | Abhängigkeiten |
|---|---|---|
| `src/publication.ts` | neu: Publikationsentscheidung, Public DTO, Quellenkanonisierung | `types.ts`, `intelligence.ts` |
| `src/types.ts` | Public-/Authority-/Health-Typen | blockiert Backend und API |
| `src/intelligence.ts` | breite Official-Heuristik entfernen | Publication-Tests |
| `src/db.ts` | Authority-, Feed-, Revalidierungs- und Health-Queries | Migration |
| `src/runner.ts` | zentrale Entscheidung und Provenienz verwenden | DB, Publication |
| `src/source-adapters.ts` | Parserstatus und priorisierte Adapter | Registry-Tests |
| `src/index.ts` | schmaler öffentlicher API-Vertrag, Revalidation-Route intern | DB, Publication |
| `src/pages/index.astro` | kompakter Meldungsfeed | Public API |
| `src/pages/events/index.astro` | bereinigte öffentliche Detaildarstellung | Public Detail API |
| `src/styles/global.css` | Feed- und Responsive-Stile | Astro-Seiten |
| `migrations/0011_public_feed_quality.sql` | Authority, Decisions, Health | DB-Code |
| `scripts/revalidate-public-events.ts` | Dry Run / Revalidierung | Publication, DB |
| `test/*` | Regressionen und Verträge | neue öffentliche Interfaces |

## Ausführungsplan

### Phase 1: Vertrag und Quellenidentität

- Public-Typen und kanonische Source Identity definieren.
- Failing Tests für Google-Redirect, Selectra, Nau/Stadtwerk, offizielle Authority und zwei unabhängige Quellen.
- Zentrale Publikationsentscheidung minimal implementieren.
- Bestehenden fehlgeschlagenen Intelligence-Test anhand der gewünschten Evidenzregel korrigieren.
- Verifikation: gezielte Tests und `npm run typecheck`.

### Phase 2: Schema, Health und Revalidierung

- Migration für Authority-Hosts, Publication Decisions und Parser-/Freshness-Health.
- DB-Queries und Runner an zentrale Entscheidung anbinden.
- Priorisierte Adapter mit Fixtures fail-closed absichern.
- Revalidierungs-Dry-Run und Apply-Modus implementieren.
- Verifikation: lokale Migration, DB-Integrationstests, vollständige Unit-Suite.

### Phase 3: Public API und UI

- `/api/public/status` auf Feed-Metadaten plus maximal zehn DTOs reduzieren; Cursor/Offset für `Weitere laden`.
- Detail-API auf öffentliche Felder reduzieren.
- Startseite und Detailseite umbauen.
- Verifikation: API-Vertragstests, Build und lokale Browser-Smokes.

### Phase 4: Produktion

- D1-Time-Travel-Bookmark und SQL-Export sichern.
- Remote-Migration anwenden.
- Dry Run prüfen, dann Revalidierung ausführen.
- Deploy, Workflow triggern und `outage.ch` plus APIs bei Desktop/Mobil prüfen.

## Rollback

1. Vor dem ersten Remote-Write Bookmark und Export protokollieren.
2. Revalidierung verändert nur Publikationsfelder; ein inverser Apply kann Entscheidungen zurücksetzen.
3. Bei Schema-/Datenfehler D1 über den protokollierten Bookmark wiederherstellen.
4. Worker auf vorherige Version zurückrollen, sofern das neue Schema abwärtskompatibel bleibt.

## Risiken

- Zu strenges Gate kann den Feed leeren: korrekte leere Ansicht akzeptieren; niemals schwache Meldungen als Ersatz veröffentlichen.
- Betreiberseiten ändern Markup: fixture-basierte Adapter und Parserstatus `needs_adapter` statt generischer Positiv-Erkennung.
- Zwei Medien können denselben Text syndizieren: Unabhängigkeit nach kanonischer Ursprungsdomain und Evidenzauszug bewerten.
- Migration und Worker-Version können kurz auseinanderlaufen: additive nullable Spalten und Migration vor Deploy.
