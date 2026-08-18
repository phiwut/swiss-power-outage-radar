import type { KnowledgeArticle } from "./knowledge";
import { publicOperatorProfiles } from "./operators";

const operatorRows = publicOperatorProfiles().map((operator) => [operator.name, operator.area]);

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    slug: "stromausfall-was-tun",
    title: "Stromausfall: Was tun? Checkliste für Haushalte in der Schweiz",
    shortTitle: "Was tun bei Stromausfall?",
    seoTitle: "Stromausfall: Was tun? Checkliste Schweiz | outage.ch",
    description:
      "Was Sie in den ersten Minuten eines Stromausfalls prüfen, welche Geräte Sie ausschalten und wann Sie den Netzbetreiber oder den Notruf brauchen.",
    definition:
      "Bei einem Stromausfall klären Sie zuerst, ob nur Ihre Wohnung oder ein grösseres Gebiet betroffen ist. Ist nur der eigene Haushalt dunkel, prüfen Sie Sicherungen. Betrifft es Nachbarn oder die Strasse, gilt die Meldung des Verteilnetzbetreibers – nicht des Stromlieferanten.",
    intro:
      "Wenn Licht, Herd und Router gleichzeitig ausfallen, zählt die Reihenfolge: Gefahr ausschliessen, Umfang klären, dann Informationen holen. Diese Checkliste gilt für Haushalte in der Schweiz und ersetzt weder den Netzbetreiber noch den Notruf.",
    publishedAt: "2026-07-30",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
    relatedSlugs: [
      "stromausfall-melden",
      "lebensmittel-kuehlschrank-stromausfall",
      "stromausfall-dauer-ursachen"
    ],
    howto: {
      name: "Was tun bei einem Stromausfall in der Schweiz",
      steps: [
        { title: "Umfang prüfen", text: "Kontrollieren Sie Treppenhaus, Nachbarwohnungen und Strassenbeleuchtung." },
        { title: "Sicherungen nur im eigenen Haushalt betätigen", text: "Ist nur Ihre Wohnung betroffen, prüfen Sie Sicherungen und FI-Schalter einmal. Löst der Schutz erneut aus, bleibt er aus." },
        { title: "Gefahrenquellen ausschalten", text: "Herd, Bügeleisen, Maschinen und empfindliche Elektronik vom Netz nehmen. Eine Lampe eingeschaltet lassen." },
        { title: "Kühlgeräte geschlossen halten", text: "Kühlschrank und Gefrierfach zu lassen, damit die Kälte länger hält." },
        { title: "Offizielle Quelle suchen", text: "Die Störungsseite des Verteilnetzbetreibers oder den Radar auf outage.ch prüfen. Bei Lebensgefahr 112 wählen." }
      ]
    },
    sections: [
      {
        heading: "Die ersten fünf Minuten",
        lead:
          "Zuerst den Umfang klären: nur die eigene Wohnung oder auch Umgebung und Strasse? Danach Sicherungen nur prüfen, wenn eindeutig der Haushalt betroffen ist.",
        steps: [
          { title: "Nachbarschaft und Strasse", text: "Sehen Sie, ob Treppenhaus, Gegenüber oder Strassenbeleuchtung ebenfalls dunkel sind." },
          { title: "Sicherungskasten", text: "Nur wenn ausschliesslich Ihr Haushalt betroffen ist: Leitungs- und Fehlerstromschutzschalter prüfen. Nicht wiederholt einschalten, wenn er sofort wieder auslöst." },
          { title: "Herde und Maschinen", text: "Schaltbare Wärmegeräte und Werkzeuge aus. Eine Lampe bleibt an, damit die Rückkehr der Versorgung sichtbar ist." },
          { title: "Elektronik", text: "Rechner, Router-Peripherie und empfindliche Geräte nach Möglichkeit trennen, sobald Sie sicher stehen." },
          { title: "Kühlung", text: "Kühl- und Gefriergeräte geschlossen halten." }
        ]
      },
      {
        heading: "Wenn die ganze Umgebung betroffen ist",
        paragraphs: [
          "Dann liegt die Ursache im Netz, nicht in Ihrer Wohnung. Zuständig ist der Verteilnetzbetreiber Ihres Standorts. Dessen Störungsseite oder Pikettdienst ist verbindlich. outage.ch bündelt öffentliche Meldungen, ersetzt diese Auskunft aber nicht.",
          "Unnötige Anrufe und Fahrten vermeiden. Mobilfunkzellen, Ampeln, Aufzüge, Tankstellen und Kartenzahlung können je nach Ausmass ebenfalls betroffen sein. Bargeld und eine geladene Powerbank helfen mehr als ein überlastetes Netz."
        ]
      },
      {
        heading: "Bei einem längeren Ausfall",
        bullets: [
          "Taschenlampen statt Kerzen, wo immer möglich. Offenes Feuer in Wohnräumen ist ein vermeidbares Risiko.",
          "Akkus schonen. Radio, Alertswiss-App oder die Störungsseite des Betreibers sind die zuverlässigeren Kanäle als Gerüchte in Chats.",
          "Personen mit elektrischen medizinischen Hilfsmitteln, im Lift oder ohne Unterstützung priorisieren.",
          "Kühlgeräte nur öffnen, wenn Sie Lebensmittel entnehmen. Leicht Verderbliches zuerst verbrauchen.",
          "Anweisungen von Gemeinde, Kanton, Alertswiss und Einsatzorganisationen haben Vorrang vor inoffiziellen Tipps."
        ]
      },
      {
        heading: "Wann ist es ein Notfall?",
        lead:
          "Ein Stromausfall allein ist kein Grund für den Notruf. Bei Feuer, Rauch, herunterhängenden Leitungen oder einem medizinischen Notfall gelten die offiziellen Alarmierungswege.",
        paragraphs: [
          "Nähern Sie sich niemals beschädigten oder hängenden Leitungen. Der Sicherheitsabstand bleibt, bis Fachleute die Stelle freigeben. Für lebensbedrohliche Lagen ist 112 der Einstieg; der Netzbetreiber ist für die Netzinstandsetzung zuständig, nicht für Rettung."
        ]
      }
    ],
    faqs: [
      {
        question: "Soll ich bei einem Stromausfall die Sicherung wieder einschalten?",
        answer:
          "Nur wenn eindeutig nur Ihr Haushalt betroffen ist und keine Brandgerüche, Funken oder ungewöhnlichen Geräusche vorhanden sind. Löst die Sicherung erneut aus, bleibt sie aus. Dann eine Elektrofachperson beiziehen."
      },
      {
        question: "Funktioniert das Handy während eines Stromausfalls?",
        answer:
          "Das Gerät selbst ja, solange der Akku reicht. Mobilfunkantennen haben oft nur begrenzte Notstromreserve. Bei einem grösseren Ausfall können Anrufe und Datenverbindungen daher später ebenfalls wegfallen."
      },
      {
        question: "Liefert eine Photovoltaikanlage im Stromausfall weiter Strom?",
        answer:
          "Eine gewöhnliche netzgekoppelte PV-Anlage schaltet ab, sobald das öffentliche Netz fehlt. Das ist eine Schutzfunktion. Insel- oder Notstrombetrieb braucht eine dafür ausgelegte und abgenommene Installation."
      },
      {
        question: "Wen rufe ich an, wenn die ganze Strasse dunkel ist?",
        answer:
          "Den Pikettdienst des Verteilnetzbetreibers, nicht den Stromlieferanten und nicht outage.ch. Den Betreiber finden Sie auf der Stromrechnung unter Netznutzung."
      }
    ],
    sources: [
      { label: "Bundesamt für wirtschaftliche Landesversorgung: Elektrizität", url: "https://www.bwl.admin.ch/de/elektrizitaet" },
      { label: "Kanton Zürich: Merkblatt Stromausfall", url: "https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/umwelt-tiere/energie/energieversorgung/merkblatt_stromausfall.pdf" },
      { label: "Alertswiss", url: "https://www.alert.swiss/" }
    ]
  },
  {
    slug: "stromausfall-dauer-ursachen",
    title: "Wie lange dauert ein Stromausfall – und welche Ursachen sind typisch?",
    shortTitle: "Dauer und Ursachen",
    seoTitle: "Wie lange dauert ein Stromausfall? | outage.ch",
    description:
      "Warum Netzbetreiber oft keine Endzeit nennen, welche Ursachen in Schweizer Verteilnetzen häufig sind und was «behoben» auf outage.ch bedeutet.",
    definition:
      "Die Dauer eines Stromausfalls hängt von der Fehlerstelle ab. Kann der Betreiber umschalten, kehrt der Strom oft nach Minuten zurück. Ist ein Kabel, eine Freileitung oder ein Transformator beschädigt, dauert die Lokalisierung und Reparatur Stunden. Eine Durchschnittszahl sagt für den konkreten Fall wenig.",
    intro:
      "Direkt nach einem Ausfall fehlt fast immer die belastbare Endzeit. Zuerst muss der Netzbetreiber den betroffenen Abschnitt erkennen, die Fehlerstelle eingrenzen und entscheiden, ob Umschalten reicht oder ob vor Ort repariert wird.",
    publishedAt: "2026-07-30",
    updatedAt: "2026-08-18",
    readingMinutes: 7,
    relatedSlugs: ["stromausfall-was-tun", "geplanter-stromunterbruch", "stromausfall-strommangellage-blackout"],
    sections: [
      {
        heading: "Warum die Dauer anfangs unbekannt ist",
        lead:
          "Eine veröffentlichte Endzeit ist nur so belastbar wie die aktuelle Betreiberinformation. outage.ch zeigt keine geschätzte Dauer als Tatsache.",
        paragraphs: [
          "Viele Mittelspannungsnetze sind so gebaut, dass sich ein Abschnitt auf einen anderen Speisepfad legen lässt. Dann ist die Unterbrechung kurz. Fehlt dieser Pfad oder ist die Stelle selbst beschädigt, braucht es eine Suche entlang der Leitung, oft mit Grabung, Kabelmessung oder Freileitungsbegehung.",
          "Wetter, Nacht, unzugängliches Gelände und parallele Störungen verlängern das. Darum ist «Ende unbekannt» keine Ausrede, sondern der ehrliche Zwischenstand."
        ]
      },
      {
        heading: "Typische Ursachen im Schweizer Verteilnetz",
        table: {
          headers: ["Ursachengruppe", "Beispiele", "Was das für die Dauer bedeutet"],
          rows: [
            ["Natur", "Gewitter, Blitz, Sturm, Schnee, Äste, Tiere", "Oft lokal; Freileitungen können länger brauchen"],
            ["Technik", "Kurzschluss, Alterung, Trafodefekt, Überlast", "Hängt von Ersatzmaterial und Schaltmöglichkeit ab"],
            ["Fremdeinwirkung", "Bagger, beschädigtes Kabel, Unfall, Brand", "Reparatur erst nach Freigabe der Stelle"],
            ["Betrieb", "Fehlschaltung, Montagefehler", "Meist rasch behebbar, sobald erkannt"],
            ["Geplant", "Unterhalt, Netzbau, Hausanschluss", "Angekündigtes Fenster, verschiebbar"]
          ]
        }
      },
      {
        heading: "Was «behoben» auf outage.ch bedeutet",
        paragraphs: [
          "«Behoben» heisst: Die öffentliche Quelle bezeichnet die Versorgung als wiederhergestellt. Bei gestaffeltem Zuschalten können einzelne Anschlüsse später folgen.",
          "Fehlt eine eindeutige Endmeldung, schliesst outage.ch einen alten Eintrag nach 24 Stunden ohne neue Bestätigung automatisch ab. Das ist kein Nachweis, dass der Strom zurück ist – nur dass keine frische Bestätigung mehr vorliegt."
        ]
      },
      {
        heading: "Stromausfall ist nicht Strommangellage",
        paragraphs: [
          "Ein Stromausfall ist ein konkreter Unterbruch an einem Ort. Eine Strommangellage ist eine länger andauernde Knappheit verfügbarer Energie mit anderen Zuständigkeiten und Massnahmen. Die beiden Lagen nicht vermischen: Wer lokal ohne Strom ist, braucht den Netzbetreiber. Wer eine Mangellage einordnen will, braucht die offiziellen Kanäle von Bund und OSTRAL."
        ]
      }
    ],
    faqs: [
      {
        question: "Wie lange dauert ein durchschnittlicher Stromausfall in der Schweiz?",
        answer:
          "Kennzahlen der ElCom beschreiben die Versorgungsqualität über ein ganzes Jahr, nicht Ihren konkreten Fall. Viele Störungen dauern Minuten, Reparaturen an Kabeln oder Freileitungen mehrere Stunden."
      },
      {
        question: "Warum nennt der Netzbetreiber keine Endzeit?",
        answer:
          "Weil Ursache und Schaden zuerst lokalisiert sein müssen. Eine früh genannte Uhrzeit wäre oft falsch. Belastbarer sind bestätigte Zwischenstände und die tatsächliche Wiederherstellung."
      },
      {
        question: "Was ist der Unterschied zwischen geplant und ungeplant?",
        answer:
          "Geplante Unterbrüche werden für Arbeiten angekündigt und haben ein Zeitfenster. Ungeplante Ausfälle entstehen durch Störung oder Beschädigung und haben zu Beginn selten eine belastbare Endzeit."
      },
      {
        question: "Kann outage.ch die Dauer schätzen?",
        answer:
          "Nein. Die Seite übernimmt nur belegte Angaben und kennzeichnet fehlende Zeiten als offen."
      }
    ],
    sources: [
      { label: "ElCom: Versorgungssicherheit und Versorgungsqualität", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" },
      { label: "Bundesamt für wirtschaftliche Landesversorgung: Elektrizität", url: "https://www.bwl.admin.ch/de/elektrizitaet" }
    ]
  },
  {
    slug: "geplanter-stromunterbruch",
    title: "Geplanter Stromunterbruch: so bereiten sich Haushalt und Betrieb vor",
    shortTitle: "Geplanter Unterbruch",
    seoTitle: "Geplanter Stromunterbruch: Vorbereitung | outage.ch",
    description:
      "Was ein geplanter Stromunterbruch bedeutet, wie Sie das Zeitfenster prüfen und welche Schritte Haushalte und Betriebe vor, während und nach den Arbeiten brauchen.",
    definition:
      "Ein geplanter Stromunterbruch ist ein angekündigtes, begrenztes Abschalten für Arbeiten am Verteilnetz. Verbindlich sind Datum, Adresse und aktuelle Verschiebungen beim Netzbetreiber. Mit einem kontrollierten Herunterfahren lassen sich Datenverlust und blockierte Tore vermeiden.",
    intro:
      "Leitungen, Trafostationen und Hausanschlüsse müssen unterhalten oder erweitert werden. Dafür schalten Netzbetreiber gezielt ab und kündigen das Fenster an. Die Ankündigung ist nützlich – aber nur die jeweils letzte Mitteilung gilt.",
    publishedAt: "2026-07-30",
    updatedAt: "2026-08-18",
    readingMinutes: 7,
    relatedSlugs: ["photovoltaik-notstrom-stromausfall", "stromausfall-betrieb", "stromausfall-was-tun"],
    sections: [
      {
        heading: "Vor dem angekündigten Beginn",
        bullets: [
          "Datum, Zeitfenster, betroffene Adresse und allfällige Verschiebungen direkt beim Netzbetreiber prüfen.",
          "Computer, Server und Steuerungen kontrolliert herunterfahren, nicht einfach den Netzstecker ziehen.",
          "Tore, Aufzüge, Zutritt, Kassen, Kühlung, Heizung und Telefonie durchgehen: Was braucht Strom, was hat Notstrom?",
          "Handys und notwendige Akkus vorher laden.",
          "Mitarbeitende, Mitbewohnende, Dienstleister und besonders betroffene Personen informieren."
        ]
      },
      {
        heading: "Für Unternehmen und technische Anlagen",
        paragraphs: [
          "Ein vorhandenes Aggregat oder eine Batterie bedeutet nicht, dass jeder Verbraucher versorgt ist. Klären Sie, welche Stromkreise notstromberechtigt sind und ob die Umschaltung automatisch oder manuell erfolgt.",
          "Prozesse mit Sicherheits-, Kühl- oder Datenpflicht brauchen ein eigenes Wiederanlaufkonzept. Ein angekündigter Unterbruch ist der richtige Moment, dieses Konzept zu prüfen statt im ungeplanten Ausfall."
        ]
      },
      {
        heading: "Nach der Wiedereinschaltung",
        bullets: [
          "Grosse Verbraucher nacheinander zuschalten, nicht alle gleichzeitig.",
          "Uhren, Steuerungen, Netzwerkgeräte und Störmelder kontrollieren.",
          "Bleibt ein Anschluss dunkel, den Netzbetreiber mit genauer Adresse informieren – nicht pauschal «es hat noch keinen Strom»."
        ]
      }
    ],
    faqs: [
      {
        question: "Kann ein geplanter Stromunterbruch verschoben werden?",
        answer:
          "Ja. Wetter, Netzlage oder der Bauablauf können das Fenster verschieben. Verbindlich ist nur die aktuelle Mitteilung des Netzbetreibers."
      },
      {
        question: "Läuft die PV-Anlage während des Unterbruchs?",
        answer:
          "Eine gewöhnliche netzgekoppelte Anlage schaltet ab. Nur eine ausdrücklich für Insel- oder Ersatzstrom ausgelegte Anlage darf definierte Verbraucher weiter versorgen."
      },
      {
        question: "Muss ich alle Geräte ausstecken?",
        answer:
          "Nicht zwingend. Wärmegeräte, Werkzeuge und empfindliche Anlagen sollten Sie kontrolliert ausschalten. Herstellerangaben gehen vor."
      },
      {
        question: "Wo sehe ich geplante Unterbrüche in meiner Region?",
        answer:
          "Zuerst auf der Störungs- oder Baustelleninfo Ihres Netzbetreibers. outage.ch zeigt öffentlich gemeldete geplante Unterbrüche zusätzlich im Radar, sobald die Quellenregel erfüllt ist."
      }
    ],
    sources: [
      { label: "ElCom: Versorgungssicherheit", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" },
      { label: "Bundesamt für Energie: Stromversorgungssicherheit", url: "https://www.bfe.admin.ch/bfe/de/home/versorgung/stromversorgung/stromversorgungssicherheit.html" }
    ]
  },
  {
    slug: "stromausfall-melden",
    title: "Stromausfall melden: so finden Sie den zuständigen Netzbetreiber",
    shortTitle: "Stromausfall melden",
    seoTitle: "Stromausfall melden in der Schweiz | outage.ch",
    description:
      "Wann Sie einen Stromausfall melden sollten, welche Angaben der Pikettdienst braucht und warum in der Schweiz der Verteilnetzbetreiber zuständig ist – nicht der Lieferant.",
    definition:
      "Für die Behebung eines lokalen Stromausfalls ist der Verteilnetzbetreiber zuständig, nicht der Stromlieferant, nicht die Gemeindeverwaltung und nicht outage.ch. Welcher Betreiber zuständig ist, steht in der Regel auf der Stromrechnung unter Netznutzung und hängt von der Adresse ab.",
    intro:
      "Viele rufen zuerst den Stromlieferanten an, dessen Logo auf der Rechnung steht. Für Leitungen, Sicherungen im Netz und den Pikettdienst ist aber der Verteilnetzbetreiber verantwortlich. Die beiden Rollen fallen in der Grundversorgung oft zusammen, müssen es aber nicht.",
    publishedAt: "2026-07-30",
    updatedAt: "2026-08-18",
    readingMinutes: 6,
    relatedSlugs: ["netzbetreiber-finden", "stromausfall-was-tun", "alertswiss-stromausfall"],
    sections: [
      {
        heading: "Zuerst den Umfang prüfen",
        bullets: [
          "Nur einzelne Steckdosen: Sicherungen und FI-Schalter im Verteiler prüfen.",
          "Nur die eigene Wohnung: Hauswartung oder Elektrofachperson, nicht den Netz-Pikettdienst für interne Defekte.",
          "Mehrere Gebäude oder dunkle Strasse: Störungsseite des Netzbetreibers prüfen und den Ausfall dort melden, falls noch keine Meldung existiert.",
          "Beschädigte oder hängende Leitung: Abstand halten und über die offiziellen Gefahrenwege melden."
        ]
      },
      {
        heading: "So finden Sie den Betreiber",
        paragraphs: [
          "Auf der Stromrechnung oder dem Netznutzungsnachweis steht der Verteilnetzbetreiber. Auf dessen Website nach «Störung», «Netzstatus» oder «Pikettdienst» suchen. In einer Mietwohnung kennt oft auch die Verwaltung den Betreiber.",
          "Keine allgemeine Nummer aus einer anderen Region wählen. Netzgebiete folgen nicht immer der Gemeindegrenze. Eine Übersicht der von outage.ch beobachteten Betreiber findet sich im Netzbetreiber-Verzeichnis."
        ]
      },
      {
        heading: "Diese Angaben helfen bei der Meldung",
        bullets: [
          "Genaue Adresse und betroffene Gebäudeteile",
          "Uhrzeit, seit der der Strom fehlt",
          "Ob Nachbarn oder die Strassenbeleuchtung ebenfalls betroffen sind",
          "Auffälligkeiten wie Knall, Rauch, Funken oder laufende Bauarbeiten",
          "Eine Rückrufnummer"
        ]
      },
      {
        heading: "Was outage.ch nicht tut",
        paragraphs: [
          "outage.ch sammelt öffentliche Betreiber-, Behörden- und Medienmeldungen. Die Plattform nimmt keine Störungsmeldungen entgegen, schickt keine Monteure und garantiert keine Wiederherstellungszeit."
        ]
      }
    ],
    faqs: [
      {
        question: "Soll ich jeden kurzen Stromausfall melden?",
        answer:
          "Wenn keine Betreiberinformation sichtbar ist und mehrere Anschlüsse betroffen scheinen, ja. Wiederholte sehr kurze Unterbrüche ebenfalls dem Betreiber melden – sie können auf ein Netzproblem hinweisen."
      },
      {
        question: "Ist die Gemeinde für den Stromausfall zuständig?",
        answer:
          "Meist nein. Zuständig ist der Verteilnetzbetreiber. In manchen Orten gehört das Werk zur Gemeinde, entscheidend bleibt trotzdem das Netzgebiet, nicht das Gemeindeamt."
      },
      {
        question: "Kann ich einen Stromausfall bei outage.ch melden?",
        answer:
          "Nein. Melden Sie den Ausfall direkt beim zuständigen Netzbetreiber."
      },
      {
        question: "Ändert sich der Netzbetreiber, wenn ich den Lieferanten wechsle?",
        answer:
          "Nein. Die physische Versorgung und der Pikettdienst bleiben beim Verteilnetzbetreiber. Ein Lieferantenwechsel ändert das nicht."
      }
    ],
    sources: [
      { label: "ElCom: Versorgungssicherheit", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" },
      { label: "Bundesamt für wirtschaftliche Landesversorgung: Elektrizität", url: "https://www.bwl.admin.ch/de/elektrizitaet" }
    ]
  },
  {
    slug: "stromausfall-strommangellage-blackout",
    title: "Stromausfall, Strommangellage, Blackout: die Unterschiede in der Schweiz",
    shortTitle: "Ausfall, Mangellage, Blackout",
    seoTitle: "Stromausfall vs Strommangellage vs Blackout | outage.ch",
    description:
      "Was ein lokaler Stromausfall von einer Strommangellage und einem Blackout unterscheidet, wer zuständig ist und welche Massnahmen jeweils gelten.",
    definition:
      "Ein Stromausfall ist ein konkreter, meist lokaler Unterbruch im Verteilnetz. Eine Strommangellage ist eine länger andauernde Knappheit von Energie. Ein Blackout ist ein grossflächiger, unkontrollierter Netzzusammenbruch. Die drei Lagen haben unterschiedliche Ursachen, Zuständige und Verhaltensregeln.",
    intro:
      "Die Begriffe werden in Chats oft gleichgesetzt. Für das richtige Handeln ist die Unterscheidung entscheidend: Beim lokalen Ausfall zählt der Netzbetreiber. Bei einer Mangellage zählen Sparappelle und mögliche Kontingentierung. Ein europäischer Netzzusammenbruch wäre eine andere Lage als ein defektes Kabel in der Seitenstrasse.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
    relatedSlugs: ["stromausfall-was-tun", "alertswiss-stromausfall", "stromausfall-dauer-ursachen"],
    sections: [
      {
        heading: "Die drei Lagen im Vergleich",
        lead:
          "Lokal, knapp oder zusammengebrochen: Ursache, Fläche und Zuständigkeit unterscheiden sich. Die Tabelle fasst den Unterschied ohne Dramatisierung.",
        table: {
          headers: ["Lage", "Was passiert", "Zuständig", "Typische Dauer"],
          rows: [
            ["Stromausfall", "Konkreter Unterbruch an einem Ort oder in einer Region", "Verteilnetzbetreiber, bei Übertragungsnetz Swissgrid", "Minuten bis Stunden"],
            ["Strommangellage", "Zu wenig verfügbare Energie über Tage oder länger", "Bund, BWL, OSTRAL, Kantone", "Tage bis Wochen"],
            ["Blackout", "Grossflächiger, unkontrollierter Netzzusammenbruch", "Übertragungsnetzbetreiber und betroffene EVU gemeinsam", "Länger als ein lokaler Ausfall, Wiederaufbau gestaffelt"]
          ]
        }
      },
      {
        heading: "Was ein lokaler Stromausfall ist",
        paragraphs: [
          "Ein Baum auf einer Freileitung, ein Bagger im Kabel, ein defekter Transformator: Das Netz vor Ort ist unterbrochen, das restliche Land arbeitet weiter. Genau das zeigt outage.ch, sobald öffentliche Quellen die Meldung tragen.",
          "Die Schweiz war laut Betreiberangaben bisher nicht von einem landesweiten Blackout betroffen. Das ändert nichts daran, dass lokale Ausfälle regelmässig vorkommen und ernst zu nehmen sind – nur gehört die Einordnung zur richtigen Schublade."
        ]
      },
      {
        heading: "Was eine Strommangellage ist",
        paragraphs: [
          "Eine Mangellage entsteht, wenn über eine längere Zeit weniger elektrische Energie zur Verfügung steht als nachgefragt wird – etwa in einem trockenen Winter mit wenig Wasser in den Speichern und knappen Importen. Sie beginnt nicht mit einem Knall in der Nachbarstrasse, sondern mit Warnungen, Sparaufrufen und, falls nötig, angeordneten Massnahmen.",
          "OSTRAL bereitet im Auftrag der wirtschaftlichen Landesversorgung Abstufungen vor, darunter Verbrauchssenkungen und als letzte Stufe Abschaltungen. Das ist ein anderes Instrument als der Pikettdienst nach einem Kabelbruch."
        ]
      },
      {
        heading: "Was «Blackout» im Netzjargon meint",
        paragraphs: [
          "Fachleute meinen damit einen grossflächigen, unkontrollierten Zusammenbruch. Schutzsysteme können Regionen absichtlich trennen, um Schlimmeres zu verhindern. Der Wiederaufbau erfolgt gestaffelt, nicht mit einem einzigen Schalter für das ganze Land.",
          "Für den Alltag bleibt die Regel: Was Sie vor Ort ohne Strom erleben, behandeln Sie zuerst als lokalen Ausfall und prüfen die Betreiberinformation. Erst offizielle Warnungen von Alertswiss, Bund oder Kanton machen aus einem lokalen Ereignis eine andere Lage."
        ]
      }
    ],
    faqs: [
      {
        question: "Ist jeder grosse Stromausfall ein Blackout?",
        answer:
          "Nein. Auch eine ganze Gemeinde ohne Strom kann ein lokaler oder regionaler Verteilnetzfehler sein. Blackout bezeichnet den unkontrollierten, grossflächigen Netzzusammenbruch."
      },
      {
        question: "Wer informiert bei einer Strommangellage?",
        answer:
          "Bund, Kantone und OSTRAL über offizielle Kanäle, ergänzt durch Alertswiss. outage.ch ist auf konkrete, belegte Unterbrüche ausgerichtet, nicht auf die Steuerung einer Mangellage."
      },
      {
        question: "Helfen gefüllte Badewannen bei einem lokalen Ausfall?",
        answer:
          "Für einen kurzen lokalen Unterbruch selten. Trinkwasser aus dem Hahn bleibt in den meisten lokalen Ausfällen verfügbar, solange Pumpen und Aufbereitung nicht selbst ohne Strom sind. Massnahmen an die tatsächliche Lage koppeln, nicht an das Wort Blackout."
      }
    ],
    sources: [
      { label: "Bundesamt für wirtschaftliche Landesversorgung: Elektrizität", url: "https://www.bwl.admin.ch/de/elektrizitaet" },
      { label: "OSTRAL", url: "https://www.ostral.ch/" },
      { label: "Swissgrid: Versorgungssicherheit", url: "https://www.swissgrid.ch/de/home/operation/power-grid/security-of-supply.html" }
    ]
  },
  {
    slug: "lebensmittel-kuehlschrank-stromausfall",
    title: "Kühlschrank und Lebensmittel bei Stromausfall: was haltbar bleibt",
    shortTitle: "Lebensmittel im Ausfall",
    seoTitle: "Kühlschrank ohne Strom: Lebensmittel | outage.ch",
    description:
      "Wie lange Kühlschrank und Gefrierfach ohne Strom kalt bleiben, welche Lebensmittel zuerst verbraucht werden und woran Sie Verderb erkennen.",
    definition:
      "Ein geschlossener Kühlschrank hält Lebensmittel stundenweise kühl, ein volles Gefrierfach länger als ein halbleeres. Die genaue Zeit hängt von Gerät, Füllstand und Zimmertemperatur ab. Leicht Verderbliches nach dem Ausfall nicht nach Geruch allein beurteilen, wenn die Kühlkette unklar ist.",
    intro:
      "Nach dem Licht geht die Sorge oft an Milch, Fleisch und Tiefkühlware. Die nützlichste Massnahme ist unspektakulär: Türen zu lassen. Jedes Öffnen tauscht Kälte gegen Zimmerluft.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 7,
    relatedSlugs: ["stromausfall-was-tun", "geplanter-stromunterbruch", "stromausfall-betrieb"],
    sections: [
      {
        heading: "Was Sie sofort tun",
        bullets: [
          "Kühlschrank und Gefrierfach geschlossen halten.",
          "Nicht «kurz nachschauen», ausser Sie entnehmen etwas zum sofortigen Verzehr.",
          "Kühlakkus oder gefrorene PET-Flaschen, die Sie ohnehin haben, ins Kühlfach legen – nicht erst auftauen lassen, um Platz zu schaffen.",
          "Den Ausfall nicht mit dem Backofen als Wärmequelle kompensieren."
        ]
      },
      {
        heading: "Ungefähre Haltbarkeit ohne Garantie",
        lead:
          "Es gibt keine Uhr, die für jedes Gerät gilt. Voll, geschlossen und in einem kühlen Raum hält länger als leer, oft geöffnet und neben der Heizung.",
        table: {
          headers: ["Gerät", "Wenn geschlossen", "Praktische Regel"],
          rows: [
            ["Kühlschrank", "mehrere Stunden, nicht einen ganzen Tag", "Tür zu; leicht Verderbliches nach dem Ausfall prüfen"],
            ["Gefrierfach, gut gefüllt", "rund 24 Stunden als grobe Orientierung", "Klumpen und Eiskristalle an Teilaufgetautem ernst nehmen"],
            ["Gefrierfach, fast leer", "deutlich kürzer", "Waren zusammenstellen, Lücken vergrössern die Wärmeaufnahme"]
          ]
        },
        paragraphs: [
          "Diese Orientierungen ersetzen keine Laborgrenze. Wer unsicher ist, entsorgt leicht verderbliche Ware statt ein Gesundheitsrisiko einzugehen. Offizielle Hinweise der Lebensmittelkontrolle und der Hersteller Ihres Geräts gehen vor."
        ]
      },
      {
        heading: "Was zuerst verbraucht oder entsorgt wird",
        bullets: [
          "Zuerst: Hackfleisch, Geflügel, Fisch, offene Milchprodukte, gekochte Reste.",
          "Oft länger unkritisch: ungeschnittenes Hartkäse, Butter, Senf, viele Konfitüren – sofern sie nicht warm standen.",
          "Tiefgekühltes, das vollständig aufgetaut ist und über 4 °C lag, nicht wieder einfrieren.",
          "Konserven und Trockenware sind vom Stromausfall nicht betroffen."
        ]
      },
      {
        heading: "Was outage.ch dazu beiträgt",
        paragraphs: [
          "Wenn der Radar ein Ereignis in Ihrer Gemeinde zeigt, sehen Sie den öffentlich belegten Beginn. Daraus folgt keine automatische Freigabe Ihrer Lebensmittel. Die Zeitangabe hilft nur, grob abzuschätzen, wie lange die Geräte schon ohne Netz sind."
        ]
      }
    ],
    faqs: [
      {
        question: "Darf ich aufgetautes Fleisch wieder einfrieren?",
        answer:
          "Nicht, wenn es vollständig aufgetaut ist und warm stand. Nur Ware, die noch fest gefroren ist, gehört zurück ins Fach. Im Zweifel entsorgen."
      },
      {
        question: "Reicht der Geruchstest?",
        answer:
          "Nein. Manche Keime sind geruchlos. Bei unklarer Kühlkette leicht Verderbliches nicht über den Geruch «freigeben»."
      },
      {
        question: "Hilft ein Generator im Keller für den Kühlschrank?",
        answer:
          "Nur wenn er fachgerecht, im Freien oder mit Abgasführung betrieben wird und die Leistung zum Anschluss passt. Ein Generator im geschlossenen Keller ist ein Kohlenmonoxidrisiko."
      }
    ],
    sources: [
      { label: "Kanton Zürich: Merkblatt Stromausfall", url: "https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/umwelt-tiere/energie/energieversorgung/merkblatt_stromausfall.pdf" },
      { label: "Bundesamt für Lebensmittelsicherheit und Veterinärwesen", url: "https://www.blv.admin.ch/" }
    ]
  },
  {
    slug: "photovoltaik-notstrom-stromausfall",
    title: "Photovoltaik bei Stromausfall: warum die Anlage abschaltet",
    shortTitle: "PV und Notstrom",
    seoTitle: "Photovoltaik bei Stromausfall | outage.ch",
    description:
      "Warum netzgekoppelte Solaranlagen bei einem Stromausfall abschalten, was Inselbetrieb voraussetzt und welche Notstromlösungen in der Schweiz üblich sind.",
    definition:
      "Eine normale netzgekoppelte Photovoltaikanlage liefert im Stromausfall keinen Strom. Der Wechselrichter trennt sich vom Netz, damit auf Leitungen keine gefährliche Spannung zurückspeist. Nur Anlagen mit zertifiziertem Not- oder Inselbetrieb können ausgewählte Verbraucher weiter versorgen.",
    intro:
      "Viele Haushalte mit Solarmodulen auf dem Dach erwarten im Ausfall trotzdem Licht. Technisch ist das Gegenteil der Normalfall: Ohne Netz fährt der Wechselrichter herunter. Das schützt Monteure, die an einer vermeintlich toten Leitung arbeiten.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 7,
    relatedSlugs: ["geplanter-stromunterbruch", "stromausfall-was-tun", "stromausfall-betrieb"],
    sections: [
      {
        heading: "Warum die Anlage abschaltet",
        lead:
          "Rückspeisung ins tote Netz wäre lebensgefährlich. Deshalb ist das Abschalten bei netzgekoppelten Anlagen keine Fehlfunktion, sondern Vorschrift.",
        paragraphs: [
          "Der Wechselrichter überwacht Spannung und Frequenz des öffentlichen Netzes. Fehlen diese, geht er in den sicheren Zustand. Module können trotzdem Spannung führen – das Dach ist damit nicht «aus», nur das Hausnetz ist ohne bestimmungsgemässe Einspeisung."
        ]
      },
      {
        heading: "Welche Lösungen wirklich versorgen",
        table: {
          headers: ["Lösung", "Was sie kann", "Was sie nicht kann"],
          rows: [
            ["Netzgekoppelte PV ohne Notstrom", "Normalbetrieb am intakten Netz", "Kein Hausstrom im Ausfall"],
            ["PV mit Notstromsteckdose oder Ersatzstrom", "Definierte Verbraucher, oft begrenzt", "Nicht automatisch das ganze Haus"],
            ["Insel- oder Hybridanlage mit Speicher", "Ausgewählte Stromkreise unabhängig vom Netz", "Nur was installiert, eingestellt und abgenommen ist"],
            ["Mobiles Aggregat", "Zeitlich begrenzte Leistung für angeschlossene Geräte", "Kein Ersatz für eine Hausinstallation, Abgasrisiko"]
          ]
        }
      },
      {
        heading: "Was vor einem geplanten Unterbruch zu klären ist",
        bullets: [
          "In der Anlagendokumentation nach «Notstrom», «Backup», «Ersatzstrom» oder «Insel» suchen.",
          "Welche Steckdosen oder Sicherungskreise wirklich versorgt werden – oft nur eine Steckdose oder ein kleiner Verteiler.",
          "Ob die Umschaltung automatisch oder per Schalter erfolgt.",
          "Ob die Installation durch eine berechtigte Fachperson und gemäss den geltenden Niederspannungsregeln erfolgt ist."
        ]
      },
      {
        heading: "Sicherheit",
        paragraphs: [
          "Keine Notstromquelle mit dem Hausnetz verbinden, ohne dass eine Freischaltung vom öffentlichen Netz existiert. Rückspeisung gefährdet Personen am Netz. Generatoren gehören nicht in geschlossene Räume."
        ]
      }
    ],
    faqs: [
      {
        question: "Warum produziert meine PV bei Sonne und Stromausfall nichts?",
        answer:
          "Weil der netzgekoppelte Wechselrichter ohne Netzspannung abschaltet. Sonne auf den Modulen reicht nicht; es braucht eine Not- oder Inselkonfiguration."
      },
      {
        question: "Reicht ein Balkonkraftwerk im Ausfall?",
        answer:
          "In der Regel nein. Auch kleine Einspeisegeräte sind auf ein vorhandenes Netz angewiesen, sofern sie nicht ausdrücklich als Inselgerät gebaut und betrieben werden."
      },
      {
        question: "Kann outage.ch sagen, ob meine Anlage Notstrom hat?",
        answer:
          "Nein. Das steht in Ihrer Anlagendokumentation oder bei der Installationsfirma."
      }
    ],
    sources: [
      { label: "Bundesamt für Energie: Stromversorgungssicherheit", url: "https://www.bfe.admin.ch/bfe/de/home/versorgung/stromversorgung/stromversorgungssicherheit.html" },
      { label: "ElCom: Versorgungssicherheit", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" }
    ]
  },
  {
    slug: "netzbetreiber-finden",
    title: "Netzbetreiber finden: wer in der Schweiz für Störungen zuständig ist",
    shortTitle: "Netzbetreiber finden",
    seoTitle: "Netzbetreiber finden Schweiz | outage.ch",
    description:
      "Wie Sie Ihren Verteilnetzbetreiber erkennen, welche Störungsseiten outage.ch beobachtet und warum der Lieferant nicht der Pikettdienst ist.",
    definition:
      "Der Verteilnetzbetreiber betreibt Leitungen und Trafostationen bis zum Hausanschluss und unterhält den Störungspikettdienst. Den Namen finden Sie auf der Stromrechnung unter Netznutzung. outage.ch beobachtet ausgewählte offizielle Störungsquellen dieser Betreiber, ersetzt ihre Hotline aber nicht.",
    intro:
      "In der Schweiz gibt es hunderte Verteilnetzbetreiber, von städtischen Werken bis zu kleinen Elektra-Genossenschaften. outage.ch kann nicht jedes Werk abdecken. Die beobachteten Quellen sind öffentlich und in diesem Ratgeber sowie im Verzeichnis nachgeschlagen.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
    relatedSlugs: ["stromausfall-melden", "stromausfall-was-tun", "geplanter-stromunterbruch"],
    showOperatorDirectory: true,
    sections: [
      {
        heading: "Lieferant und Netzbetreiber sind nicht dasselbe",
        lead:
          "Der Lieferant verkauft Energie. Der Verteilnetzbetreiber betreibt das physische Netz. Nur der zweite schickt Monteure bei einem Ausfall.",
        paragraphs: [
          "In der Grundversorgung sind beide Rollen oft beim lokalen Werk. Sobald Sie Strom von einem anderen Lieferanten beziehen könnten oder die Rechnung die Rollen trennt, ist die Netznutzungszeile massgebend – nicht das Marketinglogo oben auf dem Briefbogen."
        ]
      },
      {
        heading: "So lesen Sie die Rechnung",
        bullets: [
          "Zeile «Netznutzung», «Verteilnetz» oder «Anschlussnetz»: das ist der Betreiber.",
          "Website des genannten Unternehmens, Suche nach Störung oder Pikettdienst.",
          "Falls die Rechnung fehlt: Hausverwaltung, Eigentümergemeinschaft oder die Gemeindewerke fragen – nicht eine zufällige Nummer aus einem anderen Kanton."
        ]
      },
      {
        heading: "Welche Betreiber outage.ch beobachtet",
        paragraphs: [
          "Die folgende Liste sind offizielle Quellen, die der Radar regelmässig prüft. Sie ist unvollständig gegenüber der Gesamtheit Schweizer Werke. Fehlt Ihr Werk, gilt trotzdem dessen eigene Störungsseite. Neue Quellen kommen hinzu, sobald ein belastbarer Adapter existiert."
        ],
        table: {
          headers: ["Netzbetreiber", "Versorgungsgebiet laut Quelle"],
          rows: operatorRows
        }
      }
    ],
    faqs: [
      {
        question: "Warum fehlt mein lokales Werk in der Liste?",
        answer:
          "Weil outage.ch nur Quellen aufnimmt, für die ein nachvollziehbarer Adapter und eine öffentliche Seite existieren. Ihr Werk bleibt trotzdem zuständig. Melden Sie Störungen dort."
      },
      {
        question: "Reicht outage.ch statt der Betreiber-Website?",
        answer:
          "Nein. Der Radar ist eine Zweitansicht öffentlicher Meldungen. Die Betreiberseite oder der Pikettdienst bleibt verbindlich."
      },
      {
        question: "Sind Westschweizer Quellen dabei?",
        answer:
          "Ja, unter anderem Romande Energie und Viteos. Deren Originalseiten sind teilweise französisch; outage.ch führt öffentliche Ereignisse trotzdem im deutschsprachigen Radar, sobald die Quellenregel erfüllt ist."
      }
    ],
    sources: [
      { label: "ElCom: Versorgungssicherheit", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" },
      { label: "outage.ch Netzbetreiber-Verzeichnis", url: "https://outage.ch/netzbetreiber/" }
    ]
  },
  {
    slug: "alertswiss-stromausfall",
    title: "Alertswiss und Stromausfall: wann die offizielle Warnung kommt",
    shortTitle: "Alertswiss",
    seoTitle: "Alertswiss bei Stromausfall | outage.ch",
    description:
      "Wann Alertswiss bei einem Stromereignis warnt, wie sich das von der Störungsseite des Netzbetreibers unterscheidet und welche Kanäle verbindlich sind.",
    definition:
      "Alertswiss ist der offizielle Warnkanal von Bund, Kantonen und Betreibern kritischer Infrastruktur für die Bevölkerung. Ein lokaler Stromausfall erscheint dort nur, wenn die zuständigen Stellen eine Warnung auslösen. Die Störungsseite des Netzbetreibers bleibt für alltägliche Netzfehler der erste Ort.",
    intro:
      "Wer im Dunkeln sitzt, öffnet oft zuerst die Warn-App. Das ist richtig bei grossen Lagen – und oft leer bei einem Kabelbruch in einer Seitenstrasse. Die Kanäle haben unterschiedliche Aufträge.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 6,
    relatedSlugs: ["stromausfall-strommangellage-blackout", "stromausfall-was-tun", "stromausfall-melden"],
    sections: [
      {
        heading: "Was Alertswiss leistet",
        paragraphs: [
          "Alertswiss bündelt Warnungen und Verhaltensanweisungen der zuständigen Behörden. Dazu gehören Unwetter, Chemieereignisse, grosse Infrastrukturereignisse und – wenn ausgelöst – Hinweise zu Strom. Die App, die Website alert.swiss und angeschlossene Kanäle sind dafür da, eine Lage einzuordnen, nicht jede Trafostation zu protokollieren."
        ]
      },
      {
        heading: "Was der Netzbetreiber leistet",
        paragraphs: [
          "Der Verteilnetzbetreiber veröffentlicht geplante Unterbrüche und aktuelle Störungen in seinem Netzgebiet. Das ist die Quelle für «läuft der Strom in meiner Strasse?». outage.ch liest genau solche öffentlichen Seiten. Alertswiss wird zusätzlich als Entdeckungsquelle für strombezogene Warnungen gelesen, ohne die amtlichen Volltexte zu übernehmen. Das ersetzt weder die Betreiberakte noch Alertswiss selbst."
        ]
      },
      {
        heading: "Welchen Kanal Sie wann nutzen",
        table: {
          headers: ["Situation", "Erster Kanal", "Warum"],
          rows: [
            ["Wohnung oder Quartier ohne Strom", "Störungsseite / Pikettdienst des Netzbetreibers", "Dort liegt die Zuständigkeit für die Behebung"],
            ["Unklare grosse Lage, Unwetter, behördliche Anweisung", "Alertswiss", "Verhaltensregeln und amtliche Warnungen"],
            ["Lebensgefahr, Feuer, hängende Leitung", "112", "Rettung und Gefahrenabwehr zuerst"],
            ["Öffentliche Übersicht mehrerer Meldungen", "outage.ch", "Zweitansicht belegter Quellen, kein Notruf"]
          ]
        }
      },
      {
        heading: "Warum eine Warnung fehlen kann",
        paragraphs: [
          "Kein Eintrag in Alertswiss bedeutet nicht, dass Ihr Ausfall eingebildet ist. Es bedeutet, dass keine Warnung mit dieser Reichweite ausgelöst wurde. Umgekehrt ist eine Alertswiss-Meldung kein Ersatz für die genaue Adressauskunft des lokalen Werks."
        ]
      }
    ],
    faqs: [
      {
        question: "Muss ich Alertswiss installieren?",
        answer:
          "Es ist der offizielle Kanal für Warnungen der Bevölkerung. Für den alltäglichen Quartierausfall brauchen Sie zusätzlich die Störungsinfo des Netzbetreibers."
      },
      {
        question: "Wertet outage.ch Alertswiss als Beweis für einen Stromausfall?",
        answer:
          "Alertswiss ist eine offizielle Entdeckungsquelle. outage.ch liest den öffentlichen Feed und behält nur strombezogene Warnungen, mit Quellenangabe www.alertswiss.ch. Veröffentlicht wird ein Ereignis erst, wenn die Quellenregel erfüllt ist – also offizielle Netz- oder Behördeninformation oder zwei unabhängige glaubwürdige Quellen. Die Alertswiss-Volltexte werden nicht übernommen."
      },
      {
        question: "Ersetzt Twitter oder ein Dorfchat Alertswiss?",
        answer:
          "Nein. Nachbarschaftschats sind schnell und oft falsch. Für Verhalten in einer amtlichen Lage gilt der offizielle Kanal."
      }
    ],
    sources: [
      { label: "Alertswiss", url: "https://www.alert.swiss/" },
      { label: "Bundesamt für wirtschaftliche Landesversorgung: Elektrizität", url: "https://www.bwl.admin.ch/de/elektrizitaet" }
    ]
  },
  {
    slug: "stromausfall-betrieb",
    title: "Stromausfall im Betrieb: Checkliste für KMU in der Schweiz",
    shortTitle: "Ausfall im Betrieb",
    seoTitle: "Stromausfall im Betrieb: KMU-Checkliste | outage.ch",
    description:
      "Wie kleine und mittlere Betriebe einen Stromausfall oder geplanten Unterbruch vorbereiten: Sicherheit, Daten, Kühlung, Kunden und Wiederanlauf.",
    definition:
      "Im Betrieb zählt beim Stromausfall zuerst Personensicherheit, dann das kontrollierte Herunterfahren kritischer Prozesse. Notstrom versorgt nur die Stromkreise, die dafür gebaut sind. Ein geplanter Unterbruch ist die Probe für genau diesen Ablauf.",
    intro:
      "Kassen, Zutritt, Kühlräume, Server und Werkstattmaschinen fallen nicht nacheinander aus, sondern gleichzeitig. Wer die Reihenfolge vorher festlegt, verliert weniger Daten und setzt niemanden in den Lift.",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    readingMinutes: 8,
    relatedSlugs: ["geplanter-stromunterbruch", "photovoltaik-notstrom-stromausfall", "stromausfall-was-tun"],
    sections: [
      {
        heading: "Die ersten Minuten im Betrieb",
        steps: [
          { title: "Personen", text: "Aufzüge, dunkle Treppen, Maschinenauslauf und Kunden im Laden klären. Niemand sucht im Dunkeln den Sicherungskasten ohne Licht." },
          { title: "Gefährliche Prozesse", text: "Wärme, Druck, Chemie, fahrende Anlagen: in den sicheren Zustand, soweit ohne Netz möglich." },
          { title: "IT und Kasse", text: "Geräte an USV kontrolliert herunterfahren. Offene Buchungen nicht durch Ziehen des Steckers beenden." },
          { title: "Information", text: "Störungsseite des Netzbetreibers und, falls vorhanden, die interne Notfallnummer. Kundschaft kurz und wahr informieren." }
        ]
      },
      {
        heading: "Was vorher dokumentiert sein sollte",
        bullets: [
          "Name und Pikett des Verteilnetzbetreibers, nicht nur des Stromlieferanten.",
          "Welche Sicherungen Notstrom haben, welche nicht.",
          "Wo Taschenlampen, ein analoges Schloss und ein Offline-Zahlungsweg liegen.",
          "Wer Mitarbeitende und Schlüssellieferanten informiert.",
          "Wie Kühlräume, Serverraum und Alarmanlage sich im Ausfall verhalten."
        ]
      },
      {
        heading: "Nach dem Zuschalten",
        paragraphs: [
          "Nicht alle Maschinen gleichzeitig anfahren. Steuerungen und Computer zuerst, danach Produktions- und Kältelasten. Störungen nach dem Unterbruch (fehlende Phase, ausgefallene SPS, falsche Uhrzeiten) dem Betreiber oder der Elektrofachperson zuordnen – nicht raten.",
          "Ein geplanter Unterbruch eignet sich als Übung: dieselbe Checkliste, ohne den Stress eines Gewitters. Wenn dabei Lücken auffallen, sind sie billiger als im ungeplanten Fall."
        ]
      }
    ],
    faqs: [
      {
        question: "Muss ein KMU ein Notstromaggregat haben?",
        answer:
          "Es gibt keine allgemeine Pflicht für jedes Kleingewerbe. Wer Kühlkette, Medizin oder sicherheitsrelevante Prozesse betreibt, braucht eine eigene Risikoabschätzung und oft eine fachgerecht installierte Ersatzstromlösung."
      },
      {
        question: "Haftet der Netzbetreiber für den Umsatzausfall?",
        answer:
          "Das hängt vom konkreten Fall, vom Anschlussvertrag und von der Ursache ab. outage.ch gibt keine Rechtsauskunft. Dokumentation von Beginn, Ende und Quelle hilft später, den Sachverhalt festzuhalten."
      },
      {
        question: "Kann ich den geplanten Unterbruch verschieben lassen?",
        answer:
          "Manchmal, wenn der Betreiber das Fenster aus betrieblichen Gründen anpassen kann. Es gibt keinen Anspruch darauf. Früh kommunizieren, nicht am Vorabend."
      }
    ],
    sources: [
      { label: "ElCom: Versorgungssicherheit", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" },
      { label: "Bundesamt für Energie: Stromversorgungssicherheit", url: "https://www.bfe.admin.ch/bfe/de/home/versorgung/stromversorgung/stromversorgungssicherheit.html" }
    ]
  }
];
