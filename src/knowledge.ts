export interface KnowledgeSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface KnowledgeFaq {
  question: string;
  answer: string;
}

export interface KnowledgeSource {
  label: string;
  url: string;
}

export interface KnowledgeArticle {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  intro: string;
  updatedAt: string;
  readingMinutes: number;
  sections: KnowledgeSection[];
  faqs: KnowledgeFaq[];
  sources: KnowledgeSource[];
}

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    slug: "stromausfall-was-tun",
    title: "Stromausfall: Was tun? Die praktische Checkliste für die Schweiz",
    shortTitle: "Was tun bei Stromausfall?",
    description: "Was Sie bei einem Stromausfall zuerst prüfen, welche Geräte Sie ausschalten sollten und wie Sie sich bei einem längeren Unterbruch verhalten.",
    intro: "Wenn plötzlich Licht, Herd und Internet ausfallen, ist zuerst zu klären, ob nur die eigene Wohnung oder ein grösseres Gebiet betroffen ist. Diese Checkliste führt ohne Panik durch die ersten Minuten und die Zeit danach.",
    updatedAt: "2026-07-30",
    readingMinutes: 6,
    sections: [
      {
        heading: "Die ersten fünf Minuten",
        bullets: [
          "Prüfen Sie, ob auch Treppenhaus, Strassenbeleuchtung oder Nachbargebäude ohne Strom sind.",
          "Ist nur Ihr Haushalt betroffen, kontrollieren Sie Sicherungen und Fehlerstromschutzschalter. Schalten Sie einen ausgelösten Schutz nicht wiederholt ein, wenn er sofort erneut abschaltet.",
          "Schalten Sie Herd, Backofen, Bügeleisen, Maschinen und andere mögliche Gefahrenquellen aus.",
          "Trennen Sie empfindliche Elektronik möglichst vom Netz. Lassen Sie eine Lampe eingeschaltet, damit Sie die Rückkehr der Versorgung bemerken.",
          "Halten Sie Kühl- und Gefriergeräte geschlossen."
        ]
      },
      {
        heading: "Wenn die ganze Umgebung betroffen ist",
        paragraphs: [
          "Suchen Sie zuerst nach einer Meldung Ihres lokalen Netzbetreibers. Dessen Störungsseite oder Pikettdienst ist für verbindliche Angaben zuständig. outage.ch bündelt öffentliche Meldungen, ersetzt den Netzbetreiber aber nicht.",
          "Vermeiden Sie unnötige Telefonate und Fahrten. Mobilfunk, Ampeln, Aufzüge, Tankstellen und Kartenzahlung können je nach Ausmass ebenfalls beeinträchtigt sein."
        ]
      },
      {
        heading: "Bei einem längeren Ausfall",
        bullets: [
          "Nutzen Sie Taschenlampen statt offener Flammen, wenn dies möglich ist.",
          "Gehen Sie sparsam mit Akkus um und verwenden Sie Radio oder offizielle Warnkanäle für Informationen.",
          "Kontrollieren Sie Personen, die auf elektrische medizinische Hilfsmittel, Aufzüge oder Unterstützung angewiesen sind.",
          "Öffnen Sie Kühlgeräte nur wenn nötig und verbrauchen Sie leicht verderbliche Lebensmittel zuerst.",
          "Beachten Sie Anweisungen von Gemeinde, Kanton, Alertswiss und Einsatzorganisationen."
        ]
      },
      {
        heading: "Wann ist es ein Notfall?",
        paragraphs: [
          "Ein Stromausfall allein ist kein Grund für einen Notruf. Bei akuter Gefahr für Menschen, Feuer, Rauch, beschädigten Leitungen oder einem medizinischen Notfall gelten die offiziellen Notfallwege. Nähern Sie sich niemals herunterhängenden Leitungen."
        ]
      }
    ],
    faqs: [
      { question: "Soll ich bei einem Stromausfall die Sicherung einschalten?", answer: "Nur wenn ausschliesslich Ihr Haushalt betroffen ist und keine Schäden, Gerüche oder ungewöhnlichen Geräusche erkennbar sind. Löst die Sicherung erneut aus, lassen Sie sie ausgeschaltet und ziehen Sie eine Elektrofachperson bei." },
      { question: "Wie lange bleiben Lebensmittel im Kühlschrank kalt?", answer: "Das hängt von Gerät, Füllstand und Raumtemperatur ab. Halten Sie Kühlschrank und Gefrierfach geschlossen und beurteilen Sie leicht verderbliche Lebensmittel nach dem Ausfall sorgfältig." },
      { question: "Funktioniert eine Photovoltaikanlage bei Stromausfall weiter?", answer: "Eine normale netzgekoppelte PV-Anlage schaltet sich aus Sicherheitsgründen ab. Versorgung im Inselbetrieb ist nur mit einer dafür ausgelegten und korrekt installierten Not- oder Ersatzstromlösung möglich." }
    ],
    sources: [
      { label: "Bundesamt für wirtschaftliche Landesversorgung: Elektrizität", url: "https://www.bwl.admin.ch/de/elektrizitaet" },
      { label: "Kanton Zürich: Merkblatt Stromausfall", url: "https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/umwelt-tiere/energie/energieversorgung/merkblatt_stromausfall.pdf" },
      { label: "Alertswiss", url: "https://www.alert.swiss/" }
    ]
  },
  {
    slug: "stromausfall-dauer-ursachen",
    title: "Wie lange dauert ein Stromausfall – und was sind typische Ursachen?",
    shortTitle: "Dauer und Ursachen",
    description: "Wie Netzbetreiber Stromausfälle eingrenzen, warum genaue Endzeiten oft fehlen und welche Ursachen in Schweizer Stromnetzen typisch sind.",
    intro: "Eine seriöse Endzeit lässt sich unmittelbar nach einem Stromausfall oft nicht nennen. Zuerst muss der Netzbetreiber erkennen, welcher Netzabschnitt betroffen ist, die Fehlerstelle eingrenzen und entscheiden, ob umgeschaltet oder repariert werden muss.",
    updatedAt: "2026-07-30",
    readingMinutes: 5,
    sections: [
      {
        heading: "Warum die Dauer anfangs unbekannt ist",
        paragraphs: [
          "Bei manchen Störungen kann die Versorgung durch Schalthandlungen rasch auf einen anderen Netzpfad gelegt werden. Ist dagegen ein Kabel, Transformator oder eine Freileitung beschädigt, braucht es eine Lokalisierung vor Ort und gegebenenfalls Reparaturarbeiten.",
          "Darum ist eine veröffentlichte Endzeit immer nur so belastbar wie die aktuelle Betreiberinformation. outage.ch zeigt keine geschätzte Dauer als Tatsache an."
        ]
      },
      {
        heading: "Typische Ursachen",
        bullets: [
          "Naturereignisse wie Gewitter, Sturm, Blitzschlag, Schnee, umgestürzte Bäume oder Tiere",
          "Betriebliche und technische Ursachen wie Kurzschluss, Materialalterung, Überlastung oder ein Defekt in einer Trafostation",
          "Fremdeinwirkungen wie Tiefbauarbeiten, beschädigte Kabel, Fahrzeuge oder Brand",
          "Fehlschaltungen oder Montagefehler",
          "Geplante Arbeiten für Unterhalt, Erneuerung oder Netzausbau"
        ]
      },
      {
        heading: "Was bedeutet «behoben»?",
        paragraphs: [
          "«Behoben» bedeutet, dass die öffentliche Quelle die Versorgung als wiederhergestellt meldet. Einzelne Anschlüsse können bei gestaffelten Zuschaltungen später folgen. Fehlt eine eindeutige Endmeldung, kennzeichnet outage.ch einen alten Eintrag als historische Meldung statt ihn unbegrenzt als aktiv darzustellen."
        ]
      },
      {
        heading: "Stromausfall ist nicht gleich Strommangellage",
        paragraphs: [
          "Ein Stromausfall ist ein konkreter, meist lokaler oder regionaler Unterbruch. Eine Strommangellage ist dagegen eine länger anhaltende Knappheit von verfügbarer Energie. Die Ursachen, Zuständigkeiten und Massnahmen unterscheiden sich."
        ]
      }
    ],
    faqs: [
      { question: "Wie lange dauert ein durchschnittlicher Stromausfall?", answer: "Ein Durchschnittswert sagt für einen konkreten Vorfall wenig aus. Je nach Ursache kann die Versorgung nach Minuten zurückkehren oder eine Reparatur mehrere Stunden benötigen." },
      { question: "Warum nennt der Netzbetreiber keine Endzeit?", answer: "Weil Ursache und Schaden zuerst lokalisiert werden müssen. Eine vorschnelle Endzeit wäre irreführend; belastbarer sind bestätigte Zwischenstände und die tatsächliche Wiederherstellung." },
      { question: "Was ist der Unterschied zwischen geplant und ungeplant?", answer: "Geplante Unterbrüche werden für Arbeiten angekündigt und haben normalerweise ein definiertes Zeitfenster. Ungeplante Ausfälle entstehen durch eine Störung oder Beschädigung." }
    ],
    sources: [
      { label: "ElCom: Versorgungssicherheit und Versorgungsqualität", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" },
      { label: "Bundesamt für wirtschaftliche Landesversorgung: Elektrizität", url: "https://www.bwl.admin.ch/de/elektrizitaet" }
    ]
  },
  {
    slug: "geplanter-stromunterbruch",
    title: "Geplanter Stromunterbruch: Vorbereitung für Haushalt und Betrieb",
    shortTitle: "Geplanter Unterbruch",
    description: "Was ein geplanter Stromunterbruch bedeutet und wie sich Haushalte sowie Betriebe auf das angekündigte Zeitfenster vorbereiten.",
    intro: "Netzbetreiber müssen Leitungen, Trafostationen und Schaltanlagen unterhalten oder erweitern. Dafür kann ein klar begrenzter Stromunterbruch nötig sein. Mit wenigen Vorbereitungen lassen sich Datenverlust, blockierte Zufahrten und unnötige Betriebsprobleme vermeiden.",
    updatedAt: "2026-07-30",
    readingMinutes: 5,
    sections: [
      {
        heading: "Vor dem angekündigten Beginn",
        bullets: [
          "Prüfen Sie Datum, Zeitfenster, betroffene Adresse und allfällige Aktualisierungen direkt beim Netzbetreiber.",
          "Speichern Sie Arbeiten und fahren Sie Computer, Server, Maschinen und sensible Prozesse kontrolliert herunter.",
          "Planen Sie für Tore, Aufzüge, Zutrittssysteme, Kassen, Kühlung, Heizung und Kommunikation.",
          "Laden Sie Mobilgeräte und notwendige Akkus.",
          "Informieren Sie Mitarbeitende, Bewohnerinnen, Dienstleister oder besonders betroffene Personen."
        ]
      },
      {
        heading: "Für Unternehmen und technische Anlagen",
        paragraphs: [
          "Ein vorhandenes Notstromaggregat oder eine Batterie bedeutet nicht automatisch, dass alle Verbraucher versorgt werden. Prüfen Sie, welche Stromkreise tatsächlich notstromberechtigt sind und ob ein automatischer oder manueller Umschaltvorgang vorgesehen ist.",
          "Prozesse mit Sicherheits-, Kühl- oder Datenanforderungen benötigen eine eigene Betriebsplanung. Ein angekündigter Unterbruch ist eine gute Gelegenheit, vorhandene Notstrom- und Wiederanlaufkonzepte kontrolliert zu prüfen."
        ]
      },
      {
        heading: "Nach der Wiedereinschaltung",
        bullets: [
          "Nehmen Sie grössere Verbraucher und Anlagen kontrolliert wieder in Betrieb.",
          "Prüfen Sie Uhren, Steuerungen, Netzwerkgeräte und Anlagenmeldungen.",
          "Melden Sie einen weiterhin bestehenden Ausfall dem zuständigen Netzbetreiber."
        ]
      }
    ],
    faqs: [
      { question: "Kann ein geplanter Stromunterbruch verschoben werden?", answer: "Ja. Arbeiten können etwa wegen Wetter, Netzlage oder Bauablauf verschoben werden. Verbindlich ist die aktuelle Mitteilung des Netzbetreibers." },
      { question: "Ist während des Unterbruchs die PV-Anlage aktiv?", answer: "Eine gewöhnliche netzgekoppelte Anlage schaltet ab. Nur eine ausdrücklich für Insel- oder Ersatzstrombetrieb ausgelegte Anlage kann definierte Verbraucher weiter versorgen." },
      { question: "Muss ich alle Geräte ausstecken?", answer: "Nicht zwingend. Kritische Geräte und mögliche Gefahrenquellen sollten jedoch kontrolliert ausgeschaltet werden. Beachten Sie die Herstellerangaben Ihrer Anlagen." }
    ],
    sources: [
      { label: "ElCom: Versorgungssicherheit", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" },
      { label: "Bundesamt für Energie: Stromversorgungssicherheit", url: "https://www.bfe.admin.ch/bfe/de/home/versorgung/stromversorgung/stromversorgungssicherheit.html" }
    ]
  },
  {
    slug: "stromausfall-melden",
    title: "Stromausfall melden: So finden Sie den zuständigen Netzbetreiber",
    shortTitle: "Stromausfall melden",
    description: "Wann Sie einen Stromausfall melden sollten, welche Angaben helfen und warum der lokale Netzbetreiber die richtige Anlaufstelle ist.",
    intro: "Für die Behebung eines lokalen Stromausfalls ist der Verteilnetzbetreiber zuständig – nicht der Stromlieferant, die Gemeinde oder outage.ch. Welcher Betreiber zuständig ist, hängt von Ihrer Adresse ab.",
    updatedAt: "2026-07-30",
    readingMinutes: 4,
    sections: [
      {
        heading: "Zuerst den Umfang prüfen",
        bullets: [
          "Nur einzelne Steckdosen betroffen: Sicherungen und Fehlerstromschutzschalter prüfen.",
          "Nur die eigene Wohnung betroffen: Hausverwaltung, Elektrofachperson oder zuständige interne Stelle kontaktieren.",
          "Mehrere Gebäude oder die Strassenbeleuchtung betroffen: Störungsseite des Netzbetreibers prüfen und den Ausfall dort melden.",
          "Beschädigte oder herunterhängende Leitung: Abstand halten und unverzüglich über die offiziellen Gefahren- oder Notfallwege melden."
        ]
      },
      {
        heading: "So finden Sie den Betreiber",
        paragraphs: [
          "Der Netzbetreiber steht meist auf Ihrer Stromrechnung oder Ihrem Netznutzungsnachweis. Suchen Sie auf dessen offizieller Website nach «Störung», «Netzstatus» oder «Pikettdienst». Bei einer Mietwohnung kann auch die Verwaltung den zuständigen Betreiber nennen.",
          "Verwenden Sie keine allgemeine Telefonnummer aus einer fremden Region. Netzgebiete folgen nicht immer Gemeinde- oder Kantonsgrenzen."
        ]
      },
      {
        heading: "Diese Angaben helfen bei der Meldung",
        bullets: [
          "Genaue Adresse und betroffene Gebäudeteile",
          "Zeitpunkt, seit dem der Strom fehlt",
          "Ob Nachbargebäude oder Strassenbeleuchtung ebenfalls betroffen sind",
          "Auffälligkeiten wie Knall, Rauch, Geruch, Funken oder Bauarbeiten",
          "Eine erreichbare Rückrufmöglichkeit, falls der Betreiber Rückfragen hat"
        ]
      },
      {
        heading: "Was outage.ch leisten kann",
        paragraphs: [
          "outage.ch sammelt öffentlich zugängliche Betreiber-, Behörden- und Medienmeldungen und verknüpft sie mit Quellen. Die Plattform nimmt keine Störungsmeldungen entgegen und kann keine Wiederherstellungszeit garantieren."
        ]
      }
    ],
    faqs: [
      { question: "Soll ich jeden kurzen Stromausfall melden?", answer: "Wenn keine Betreiberinformation vorhanden ist und mehrere Anschlüsse betroffen scheinen, kann eine Meldung sinnvoll sein. Wiederholte sehr kurze Unterbrüche sollten ebenfalls dem Betreiber gemeldet werden." },
      { question: "Ist die Gemeinde für den Stromausfall zuständig?", answer: "Meist ist der lokale Verteilnetzbetreiber zuständig. In einzelnen Gemeinden kann dieser zwar zur Gemeinde gehören, entscheidend bleibt aber das konkrete Netzgebiet." },
      { question: "Kann ich einen Stromausfall bei outage.ch melden?", answer: "Nein. outage.ch ist ein Informationsradar und kein Störungsdienst. Melden Sie den Ausfall direkt beim zuständigen Netzbetreiber." }
    ],
    sources: [
      { label: "Bundesamt für wirtschaftliche Landesversorgung: Elektrizität", url: "https://www.bwl.admin.ch/de/elektrizitaet" },
      { label: "ElCom: Versorgungssicherheit", url: "https://www.elcom.admin.ch/de/versorgungssicherheit" }
    ]
  }
];

export const knowledgeArticlePaths = [
  "/ratgeber/",
  ...knowledgeArticles.map((article) => `/ratgeber/${article.slug}/`)
];

export function knowledgeArticleUrl(article: Pick<KnowledgeArticle, "slug">): string {
  return `/ratgeber/${article.slug}/`;
}

export function relatedKnowledgeArticles(limit = 3): KnowledgeArticle[] {
  return knowledgeArticles.slice(0, Math.max(1, limit));
}
