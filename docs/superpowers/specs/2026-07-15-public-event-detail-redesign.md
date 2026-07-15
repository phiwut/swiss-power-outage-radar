# Ganzheitliche öffentliche Ereignis-Detailseite

## Ziel

Die Detailseite beantwortet ohne internes Vokabular vier Fragen:

1. Wo ist der Stromausfall?
2. Was ist passiert?
3. Was ist zeitlich und sachlich belegt?
4. Wer meldet beziehungsweise betreibt das betroffene Netz?

Die Seite darf reichhaltig wirken, aber niemals leere oder als unbekannt markierte Felder zeigen. Fehlende Daten führen zum Weglassen eines Moduls, nicht zu Platzhaltern.

## Bewertete Ansätze

### A: Statische dekorative Karte

Eine vorgerenderte Kartenfläche wäre leicht und robust, aber ohne belastbare Koordinate nur eine Illustration. Sie könnte einen falschen Ortsbezug suggerieren und wäre für Strassenereignisse zu ungenau.

### B: Geokodierung im Browser bei jedem Aufruf

Die Umsetzung wäre schnell, würde aber jeden Detailaufruf von einem zusätzlichen Drittanbieter-Request abhängig machen. Das verschlechtert Ladezeit, Datenschutz und Fehlertoleranz und erzeugt wiederholte identische Suchen.

### C: Amtliche, serverseitig gecachte Ortsauflösung mit Light Vector Map

Gewählt. Der Worker löst den bereinigten Ereignisort einmalig über den offiziellen GeoAdmin SearchServer auf und speichert das Resultat in D1. Das Frontend rendert die offizielle swisstopo Light Base Map über MapLibre. Bei fehlender Koordinate bleibt ein ruhiger typografischer Hero erhalten; es erscheint keine leere Karte.

## Informationsarchitektur

### 1. Karten-Hero

- Swisstopo Light Base Map als vollflächiger Hintergrund.
- Ein klarer outage.ch-Ortspunkt ohne Gefahrenzonen- oder Radius-Simulation.
- Ein dunkler, links unten auslaufender Lesbarkeitsverlauf trägt Eingang, Vertrauensstatus, Ort und Kurzfassung.
- Keine Zoomtasten, Suche, Layerwahl oder Popups. Drag und Scroll-Zoom sind deaktiviert; die Karte ist Orientierung, nicht ein zweites Produkt.
- Quellenangabe bleibt sichtbar.

### 2. Ereignisüberblick

Direkt unter dem Hero steht ein kurzer Satz zur Einordnung. Danach folgt eine horizontale Faktenleiste mit maximal vier tatsächlich belegten Informationen:

- Beginn
- Behoben
- Art: geplant oder ungeplant
- Status: aktiv oder behoben
- betroffenes Gebiet
- Ursache

Ort, Eingang und Quellenstatus werden nicht redundant als Faktenkarte wiederholt. Fakten mit `unknown`, `unclear`, `null`, widersprüchlichen Werten oder zu geringer Konfidenz werden ausgelassen.

### 3. Netzbetreiber und Quellen

Wenn eine Quelle mit einem Eintrag in `source_registry` oder `source_authorities` verbunden ist, erscheint ein prominenter Betreiberblock mit Name, Rolle, Netzgebiet und direktem Link. `area_text` wird nur als Betreibergebiet bezeichnet und niemals als Ereignisort verwendet.

Daneben beziehungsweise darunter erscheint „Meldung & Quellen“:

- offizieller Betreiber oder Behörde;
- unabhängige Bestätigung;
- einzelne Medienmeldung.

Nur kanonische Original-URLs werden ausgegeben. Doppelte Domains, Google-Redirects und nicht evidenztragende Quellen werden entfernt.

### 4. Zeitliche Einordnung

Der Eingang bei outage.ch wird deutlich von einem belegten Ereignisbeginn getrennt. Wenn nur der Eingang bekannt ist, erscheint keine leere Timeline. Bei zwei oder mehr Zeitpunkten entsteht eine kompakte vertikale Abfolge.

## Backend

### Persistenz

Eine neue Tabelle `event_public_locations` speichert pro Ereignis:

- `outage_event_id`
- bereinigter Suchtext
- Bezeichnung
- Breitengrad und Längengrad
- Genauigkeit beziehungsweise Herkunftstyp
- Provider und Auflösungszeitpunkt

Die Werte werden ausschließlich innerhalb plausibler Schweizer Grenzen akzeptiert. Die Auflösung ist idempotent und kann bei Fehlern ohne Änderung wiederholt werden.

### Öffentlicher Detailvertrag

`GET /api/public/events/:id` liefert zusätzlich zum bestehenden `item`:

- `map` oder `null`
- `facts` als bereits übersetzte, gefilterte Label-Wert-Paare
- `operator` oder `null`
- `sources` als kanonische öffentliche Quellen
- `timeline` mit ausschließlich vorhandenen Zeitpunkten

Interne Scores, Konfidenzen, Roh-Facts, Evidence-Auszüge und Review-Zustände bleiben ausgeschlossen.

### Geokodierungsfluss

1. Cache in D1 lesen.
2. Falls leer: Ortsbezeichnung von Präfixen und Landzusätzen bereinigen.
3. GeoAdmin SearchServer mit `type=locations` abfragen.
4. Schweizer Treffer nach Textüberlappung, Ursprung und Gewicht bewerten.
5. Besten Treffer speichern und zurückgeben.
6. Bei Netzwerk- oder Matchingfehler `map: null` liefern; die Detailseite bleibt vollständig nutzbar.

## Frontend

Die bestehende Astro-Seite und das aktuelle Designsystem bleiben erhalten. MapLibre wird als lokale npm-Abhängigkeit gebündelt; es gibt keine unversionierte CDN-Laufzeitabhängigkeit. Der Hero wird erst nach erfolgreichem API-Load initialisiert. Bei reduziertem Bewegungswunsch gibt es keine Kamerafahrt.

Desktop nutzt einen breiteren, asymmetrischen Aufbau. Mobil stapelt sich alles in Lesereihenfolge, die Karte bleibt kompakt und der Quellenlink füllt die verfügbare Breite. Die Seite enthält keine fixierten Bedienelemente und erzeugt keinen horizontalen Overflow.

## Fehler- und Leerzustände

- Keine Koordinate: typografischer Hero ohne Kartencontainer.
- Kein Betreiber: Betreiberblock entfällt vollständig.
- Keine zusätzlichen Fakten: Zusammenfassung und Quellen bleiben, keine leere Überschrift.
- Kartenfehler: Kartenfläche wird als ruhiger Hintergrund belassen; Inhalt und Links funktionieren weiter.
- API-Fehler: bestehender klarer Fehlerzustand mit Rückweg.

## Verifikation

- Unit-Tests für Ortsbereinigung, GeoAdmin-Auswahl, Faktenfilter und Betreiberauflösung.
- API-Vertragstest für ein reiches offizielles Event und ein schmales Medienevent.
- Migration lokal und remote prüfen.
- Typecheck, vollständige Tests und Produktionsbuild.
- Browser-Smokes für 375, 768 und 1440 Pixel.
- Live-Fälle: Primeo/Lostorf mit Betreiber und Karte; Winterthur als Medienmeldung ohne erfundenen Betreiber; Bettwil ohne Unsicherheitsfelder.
- Keine internen Begriffe, keine leeren Module, keine Google-Redirects und kein horizontaler Overflow.
