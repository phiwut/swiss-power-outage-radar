export interface ElcomOperatorFacts {
  elcomId: number;
  elcomName: string;
  municipalityCount: number;
  totalRp: number;
  energyRp: number;
  gridRp: number;
}

export const ELCOM_H4_YEAR = 2026;
export const ELCOM_H4_ANNUAL_KWH = 4500;
export const ELCOM_H4_SWISS_MEAN_RP = 28.29;
export const ELCOM_SNAPSHOT_DATE = "2026-08-18";
export const ELCOM_PRICE_URL = "https://www.strompreis.elcom.admin.ch/";
export const ELCOM_OPEN_DATA_URL = "https://ld.admin.ch/query";

const FACTS_BY_SLUG: Record<string, ElcomOperatorFacts> = {
  bkw: { elcomId: 36, elcomName: "BKW Energie AG", municipalityCount: 318, totalRp: 27.55, energyRp: 10.89, gridRp: 11.25 },
  "romande-energie": { elcomId: 669, elcomName: "Romande Energie SA", municipalityCount: 262, totalRp: 29.79, energyRp: 14.04, gridRp: 10.59 },
  "groupe-e": { elcomId: 609, elcomName: "Groupe E SA", municipalityCount: 143, totalRp: 27.6, energyRp: 14.55, gridRp: 8.78 },
  ekz: { elcomId: 486, elcomName: "EKZ", municipalityCount: 132, totalRp: 24.14, energyRp: 12.11, gridRp: 8.23 },
  aew: { elcomId: 5, elcomName: "AEW Energie AG", municipalityCount: 75, totalRp: 27.89, energyRp: 11.4, gridRp: 12.23 },
  ckw: { elcomId: 37, elcomName: "CKW AG", municipalityCount: 71, totalRp: 25.41, energyRp: 12, gridRp: 8.73 },
  ail: { elcomId: 31, elcomName: "AIL SA", municipalityCount: 50, totalRp: 25.13, energyRp: 8.95, gridRp: 10.33 },
  ebl: { elcomId: 113, elcomName: "EBL", municipalityCount: 50, totalRp: 30.2, energyRp: 11.74, gridRp: 14.31 },
  "primeo-energie": { elcomId: 70, elcomName: "Primeo Energie", municipalityCount: 48, totalRp: 31.98, energyRp: 13.73, gridRp: 14.26 },
  sig: { elcomId: 692, elcomName: "SIG", municipalityCount: 44, totalRp: 24.88, energyRp: 9.67, gridRp: 9.88 },
  sak: { elcomId: 727, elcomName: "SAK", municipalityCount: 40, totalRp: 29.05, energyRp: 13.97, gridRp: 10.91 },
  ses: { elcomId: 712, elcomName: "SES", municipalityCount: 38, totalRp: 29.96, energyRp: 11.31, gridRp: 12.49 },
  repower: { elcomId: 662, elcomName: "Repower AG", municipalityCount: 33, totalRp: 30.29, energyRp: 9.6, gridRp: 15.3 },
  eks: { elcomId: 426, elcomName: "EKS", municipalityCount: 26, totalRp: 32.2, energyRp: 12.63, gridRp: 15.48 },
  oiken: { elcomId: 853, elcomName: "OIKEN", municipalityCount: 24, totalRp: 26.87, energyRp: 14, gridRp: 7.73 },
  wwz: { elcomId: 788, elcomName: "WWZ", municipalityCount: 11, totalRp: 22.22, energyRp: 6.3, gridRp: 11.12 },
  ewz: { elcomId: 565, elcomName: "ewz (Stadt Zürich)", municipalityCount: 9, totalRp: 24.36, energyRp: 7.88, gridRp: 10.73 },
  "sil-lausanne": { elcomId: 675, elcomName: "SIL Lausanne", municipalityCount: 7, totalRp: 27.83, energyRp: 9.35, gridRp: 11.93 },
  ebs: { elcomId: 425, elcomName: "ebs", municipalityCount: 7, totalRp: 26.27, energyRp: 10, gridRp: 10.73 },
  "ibb-brugg": { elcomId: 616, elcomName: "IBB Strom AG", municipalityCount: 8, totalRp: 26.82, energyRp: 12.11, gridRp: 10.16 },
  viteos: { elcomId: 773, elcomName: "Viteos SA", municipalityCount: 5, totalRp: 28.85, energyRp: 13.2, gridRp: 12.51 },
  evolon: { elcomId: 901, elcomName: "Evolon", municipalityCount: 4, totalRp: 34.05, energyRp: 14.6, gridRp: 14.26 },
  iwb: { elcomId: 624, elcomName: "IWB", municipalityCount: 3, totalRp: 33.25, energyRp: 10.89, gridRp: 11.41 },
  "regio-energie-solothurn": { elcomId: 664, elcomName: "Regio Energie Solothurn", municipalityCount: 12, totalRp: 30.16, energyRp: 13.93, gridRp: 11.8 },
  "st-galler-stadtwerke": { elcomId: 672, elcomName: "St.Galler Stadtwerke", municipalityCount: 2, totalRp: 30.06, energyRp: 12.99, gridRp: 11.25 },
  "regionalwerke-baden": { elcomId: 667, elcomName: "Regionalwerke Baden", municipalityCount: 2, totalRp: 27.27, energyRp: 10.5, gridRp: 12.6 },
  "energie-wasser-bern": { elcomId: 519, elcomName: "Energie Wasser Bern", municipalityCount: 1, totalRp: 33.26, energyRp: 13.2, gridRp: 13.03 },
  "esb-biel": { elcomId: 510, elcomName: "ESB", municipalityCount: 1, totalRp: 29.54, energyRp: 12.15, gridRp: 11.25 },
  "energie-uster": { elcomId: 518, elcomName: "Energie Uster", municipalityCount: 1, totalRp: 28.55, energyRp: 16.1, gridRp: 9.08 },
  "energie-kreuzlingen": { elcomId: 751, elcomName: "Energie Kreuzlingen", municipalityCount: 1, totalRp: 28.88, energyRp: 11.69, gridRp: 13.16 },
  "stadtwerke-gossau": { elcomId: 737, elcomName: "Stadtwerke Gossau", municipalityCount: 1, totalRp: 27.87, energyRp: 15.42, gridRp: 8.65 },
  "energie-thun": { elcomId: 511, elcomName: "Energie Thun", municipalityCount: 1, totalRp: 29.35, energyRp: 13.76, gridRp: 9.15 },
  "technische-betriebe-wil": { elcomId: 758, elcomName: "Technische Betriebe Wil", municipalityCount: 1, totalRp: 31.12, energyRp: 14.88, gridRp: 9.78 },
  "tb-flawil": { elcomId: 747, elcomName: "TB Flawil", municipalityCount: 1, totalRp: 27.9, energyRp: 13.08, gridRp: 10.64 },
  "elektra-fislisbach": { elcomId: 599, elcomName: "Elektra Fislisbach", municipalityCount: 1, totalRp: 25.01, energyRp: 11.95, gridRp: 9.7 },
  "stadtwerk-winterthur": { elcomId: 735, elcomName: "Stadtwerk Winterthur", municipalityCount: 1, totalRp: 30.48, energyRp: 14.17, gridRp: 11.16 },
  thurplus: { elcomId: 784, elcomName: "Thurplus", municipalityCount: 1, totalRp: 29.49, energyRp: 12.9, gridRp: 12 },
  "ew-neuenhof": { elcomId: 590, elcomName: "EW Neuenhof", municipalityCount: 1, totalRp: 26.21, energyRp: 12.4, gridRp: 9.56 },
  "ew-urnasch": { elcomId: 476, elcomName: "EW Urnäsch", municipalityCount: 1, totalRp: 29.98, energyRp: 10.95, gridRp: 15.13 },
  tbgn: { elcomId: 825, elcomName: "TBGN", municipalityCount: 1, totalRp: 32.85, energyRp: 13.2, gridRp: 15.4 }
};

export function formatRpPerKwh(value: number): string {
  return `${value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rp./kWh`;
}

export function elcomFactsForSlug(slug: string): ElcomOperatorFacts | null {
  return FACTS_BY_SLUG[slug] ?? null;
}

export function elcomMappedSlugs(): string[] {
  return Object.keys(FACTS_BY_SLUG);
}

function municipalityPhrase(count: number): string {
  return count === 1 ? "einer Gemeinde" : `${count} Gemeinden`;
}

export function elcomComparisonText(facts: ElcomOperatorFacts): string {
  const delta = facts.totalRp - ELCOM_H4_SWISS_MEAN_RP;
  const abs = Math.abs(delta).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mean = formatRpPerKwh(ELCOM_H4_SWISS_MEAN_RP);
  if (Math.abs(delta) < 0.15) {
    return `liegt nahe am Mittel der ElCom-H4-Beobachtungen ${ELCOM_H4_YEAR} von ${mean}`;
  }
  if (delta < 0) {
    return `liegt ${abs} Rp. unter dem Mittel der ElCom-H4-Beobachtungen ${ELCOM_H4_YEAR} von ${mean}`;
  }
  return `liegt ${abs} Rp. über dem Mittel der ElCom-H4-Beobachtungen ${ELCOM_H4_YEAR} von ${mean}`;
}

export function elcomFactsInsight(operatorName: string, facts: ElcomOperatorFacts): string {
  return `Die ElCom weist für ${facts.elcomName} im H4-Standardprodukt ${ELCOM_H4_YEAR} (Haushalt mit ${ELCOM_H4_ANNUAL_KWH} kWh/Jahr) einen Mittelwert von ${formatRpPerKwh(facts.totalRp)} über ${municipalityPhrase(facts.municipalityCount)} aus. Davon entfallen ${formatRpPerKwh(facts.energyRp)} auf die Energie und ${formatRpPerKwh(facts.gridRp)} auf die Netznutzung. Dieser Wert ${elcomComparisonText(facts)}. Das ist kein individueller Rechnungsbetrag von ${operatorName}: Gemeinde, Produkt, Leistung und ob Lieferant und Netzbetreiber identisch sind, können abweichen.`;
}

export function elcomFactsDisclaimer(): string {
  return `Quelle: ElCom-Strompreisdaten via LINDAS, H4-Standardprodukt ${ELCOM_H4_YEAR}, Auswertung ${new Date(`${ELCOM_SNAPSHOT_DATE}T12:00:00+02:00`).toLocaleDateString("de-CH")}. outage.ch speichert einen Snapshot, nicht den Live-Tarifrechner.`;
}

export function elcomFaq(operatorName: string, facts: ElcomOperatorFacts): { question: string; answer: string } {
  return {
    question: `Was sagt die ElCom zu den Strompreisen von ${operatorName}?`,
    answer: `${elcomFactsInsight(operatorName, facts)} Die Originaldaten stehen auf ${ELCOM_PRICE_URL}.`
  };
}

export function elcomFactsRows(facts: ElcomOperatorFacts): Array<[string, string]> {
  return [
    [`H4-Total ${ELCOM_H4_YEAR}`, formatRpPerKwh(facts.totalRp)],
    ["Energie", formatRpPerKwh(facts.energyRp)],
    ["Netznutzung", formatRpPerKwh(facts.gridRp)],
    ["Gemeinden in der ElCom-Auswertung", String(facts.municipalityCount)],
    [`Schweizer H4-Mittel ${ELCOM_H4_YEAR}`, formatRpPerKwh(ELCOM_H4_SWISS_MEAN_RP)]
  ];
}

export function elcomDatasetJsonLd(
  operatorName: string,
  facts: ElcomOperatorFacts,
  canonical: string
): Record<string, unknown> {
  return {
    "@type": "Dataset",
    "@id": `${canonical}#elcom`,
    name: `ElCom H4-Strompreis ${operatorName} ${ELCOM_H4_YEAR}`,
    description: elcomFactsInsight(operatorName, facts),
    creator: { "@type": "Organization", name: "Eidgenössische Elektrizitätskommission ElCom" },
    isBasedOn: ELCOM_PRICE_URL,
    license: ELCOM_PRICE_URL,
    temporalCoverage: String(ELCOM_H4_YEAR),
    variableMeasured: elcomFactsRows(facts).map(([name, value]) => ({
      "@type": "PropertyValue",
      name,
      value
    }))
  };
}
