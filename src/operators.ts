import { SOURCE_REGISTRY_SEEDS, type SourceRegistrySeed } from "./source-registry-seeds";
import { publicEventSlug } from "./public-url";

export interface OperatorProfile {
  slug: string;
  name: string;
  area: string;
  officialUrl: string;
  sourceCategory: SourceRegistrySeed["source_category"];
  language: "de" | "fr" | "it";
  checkMinutes: number;
  sourceKey: string;
}

const EXCLUDED_KEYS = new Set(["alertswiss"]);

export function operatorProfileUrl(operator: Pick<OperatorProfile, "slug">): string {
  return `/netzbetreiber/${operator.slug}/`;
}

export function toOperatorProfile(seed: SourceRegistrySeed): OperatorProfile {
  return {
    slug: publicEventSlug(seed.operator_name),
    name: seed.operator_name,
    area: seed.area_text,
    officialUrl: seed.url,
    sourceCategory: seed.source_category,
    language: seed.adapter_config.language ?? "de",
    checkMinutes: seed.check_interval_minutes,
    sourceKey: seed.source_key
  };
}

export function publicOperatorProfiles(): OperatorProfile[] {
  const profiles = SOURCE_REGISTRY_SEEDS
    .filter((seed) => seed.trust_level === "official" && !EXCLUDED_KEYS.has(seed.source_key))
    .map(toOperatorProfile);
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (seen.has(profile.slug)) return false;
    seen.add(profile.slug);
    return true;
  });
}

export function operatorBySlug(slug: string): OperatorProfile | null {
  return publicOperatorProfiles().find((profile) => profile.slug === slug) ?? null;
}

export function findOperatorProfile(name: string | null | undefined): OperatorProfile | null {
  if (!name) return null;
  const needle = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (!needle) return null;
  const profiles = publicOperatorProfiles();
  return profiles.find((profile) => profile.name.toLowerCase() === needle)
    ?? profiles.find((profile) => needle === profile.slug || needle.replace(/\s+/g, "-") === profile.slug)
    ?? profiles.find((profile) => needle.includes(profile.name.toLowerCase()) && profile.name.length > 3)
    ?? null;
}

export function sourceCategoryLabel(category: OperatorProfile["sourceCategory"]): string {
  if (category === "outage_map") return "Störungskarte oder Lagebild";
  if (category === "live_status") return "aktuelle Störungsseite";
  if (category === "news_feed") return "News- oder Betriebsmeldungen";
  return "öffentliche Hinweisquelle";
}

export function operatorDefinition(operator: OperatorProfile): string {
  return `${operator.name} ist Verteilnetzbetreiber für ${operator.area}. Verbindliche Angaben zu Stromausfällen und geplanten Unterbrüchen veröffentlicht ${operator.name} auf der offiziellen Störungsseite. outage.ch beobachtet diese Quelle, ersetzt den Pikettdienst aber nicht.`;
}

export function operatorLanguageNote(operator: OperatorProfile): string | null {
  if (operator.language === "fr") {
    return `Die Originalquelle von ${operator.name} ist französischsprachig. outage.ch führt öffentlich belegte Ereignisse trotzdem im deutschsprachigen Radar, sobald die Quellenregel erfüllt ist.`;
  }
  if (operator.language === "it") {
    return `Die Originalquelle von ${operator.name} ist italienischsprachig. Öffentlich belegte Ereignisse erscheinen im Radar auf Deutsch, sobald die Quellenregel erfüllt ist.`;
  }
  return null;
}

export function operatorSourceExplanation(operator: OperatorProfile): string {
  if (operator.sourceCategory === "outage_map") {
    return `${operator.name} veröffentlicht Störungen über eine ${sourceCategoryLabel(operator.sourceCategory)}. outage.ch prüft diese Quelle etwa alle ${operator.checkMinutes} Minuten und übernimmt nur Einträge, die sich als Stromereignis belegen lassen.`;
  }
  if (operator.sourceCategory === "news_feed") {
    return `${operator.name} kommuniziert Störungen vor allem über ${sourceCategoryLabel(operator.sourceCategory)}. Solche Seiten mischen oft Archiv, Medienmitteilungen und aktuelle Hinweise. Der Radar filtert deshalb strenger und veröffentlicht nicht jeden Seitentext.`;
  }
  if (operator.sourceCategory === "live_status") {
    return `${operator.name} führt eine ${sourceCategoryLabel(operator.sourceCategory)}. outage.ch ruft sie etwa alle ${operator.checkMinutes} Minuten ab. Negative Meldungen wie «keine Störung» werden nicht als Ausfall dargestellt.`;
  }
  return `${operator.name} hat eine öffentliche Hinweisquelle. outage.ch nutzt sie zur Einordnung, nicht als alleinigen Beweis für einen Ausfall.`;
}

export function operatorFaqs(operator: OperatorProfile): Array<{ question: string; answer: string }> {
  return [
    {
      question: `Wer ist bei einem Stromausfall im Gebiet von ${operator.name} zuständig?`,
      answer: `Für die Behebung ist ${operator.name} als Verteilnetzbetreiber zuständig, nicht der Stromlieferant und nicht outage.ch. Das Versorgungsgebiet umfasst ${operator.area}.`
    },
    {
      question: `Wo veröffentlicht ${operator.name} aktuelle Störungen?`,
      answer: `Auf der offiziellen Seite ${operator.officialUrl}. Das ist die verbindliche Auskunft.`
    },
    {
      question: `Kann ich eine Störung im Netz von ${operator.name} bei outage.ch melden?`,
      answer: `Nein. Melden Sie den Ausfall direkt bei ${operator.name}. outage.ch zeigt nur öffentlich nachvollziehbare Meldungen.`
    },
    {
      question: `Wie oft prüft outage.ch die Quelle von ${operator.name}?`,
      answer: `Etwa alle ${operator.checkMinutes} Minuten, sofern die Quelle erreichbar ist. Eine öffentliche Meldung auf outage.ch erscheint erst, wenn die Veröffentlichungsregel erfüllt ist.`
    }
  ];
}
