import { DEMO_LOGS, type DemoLog } from "./data";

export type RedFlag = {
  id: string;
  label: { en: string; es: string };
  patterns: RegExp[];
};

export const RED_FLAGS: RedFlag[] = [
  {
    id: "prolonged-confusion",
    label: { en: "Prolonged confusion through the day", es: "Confusión prolongada durante el día" },
    patterns: [/prolonged confusion|confused (most|all) of the day|confus(ed|ión) (toda|casi todo) el día|confusión prolongada/i],
  },
  {
    id: "not-recognizing",
    label: { en: "New difficulty recognizing a caregiver", es: "Nueva dificultad para reconocer a una cuidadora" },
    patterns: [/did(?:n'?t| not) recognize|no reconoció|no me reconoce|didn'?t know who/i],
  },
  {
    id: "hygiene",
    label: { en: "Sudden decline in hygiene or grooming", es: "Caída repentina en higiene o aseo" },
    patterns: [/decline in (hygiene|grooming|self[- ]care)|refuses? (to bathe|to shower)|no quiere bañarse|abandono del aseo/i],
  },
  {
    id: "hallucinations",
    label: { en: "Unusual hallucinations", es: "Alucinaciones inusuales" },
    patterns: [/hallucinat|alucina|saw (people|things) that weren'?t there|vio (gente|cosas) que no estab/i],
  },
];

export type RedFlagMatch = { flag: RedFlag; log: DemoLog };

export function scanLogsForRedFlags(logs: DemoLog[] = DEMO_LOGS): RedFlagMatch[] {
  const matches: RedFlagMatch[] = [];
  for (const log of logs) {
    const blob = [
      log.notes.en, log.notes.es,
      ...log.symptoms.flatMap((s) => [s.name.en, s.name.es]),
    ].join(" \n ");
    for (const flag of RED_FLAGS) {
      if (flag.patterns.some((re) => re.test(blob))) {
        matches.push({ flag, log });
      }
    }
  }
  // dedupe by flag id, keep first (most recent log — DEMO_LOGS is recent-first)
  const seen = new Set<string>();
  return matches.filter((m) => (seen.has(m.flag.id) ? false : (seen.add(m.flag.id), true)));
}
