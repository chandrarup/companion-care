import { localISODate } from "./dates";
export type ResourceCategory = "support" | "programs" | "events";

export type Resource = {
  id: string;
  category: ResourceCategory;
  name: string;
  description: { en: string; es: string };
  zips: string[]; // serving ZIPs (broad match)
  phone?: string;
  url?: string;
  address?: string;
  date?: string; // ISO for events
  time?: string;
};

// Houston-area dementia & senior resources (real organizations; synthetic events)
export const HOUSTON_RESOURCES: Resource[] = [
  // Support for caregivers
  {
    id: "alz-houston",
    category: "support",
    name: "Alzheimer's Association — Houston & SE Texas",
    description: {
      en: "24/7 helpline, caregiver education, and local support groups.",
      es: "Línea de ayuda 24/7, educación para cuidadores y grupos de apoyo.",
    },
    zips: ["77002","77004","77005","77006","77007","77019","77024","77027","77056"],
    phone: "800-272-3900",
    url: "https://www.alz.org/texas",
    address: "2242 W Holcombe Blvd, Houston, TX",
  },
  {
    id: "carepartners",
    category: "support",
    name: "CarePartners",
    description: {
      en: "Free caregiver support groups, respite care, and faith-based programs.",
      es: "Grupos de apoyo gratuitos, cuidado de relevo y programas comunitarios.",
    },
    zips: ["77002","77006","77019","77027","77056","77098"],
    phone: "832-573-3600",
    url: "https://www.care-partners.org",
    address: "5430 Westheimer Rd, Houston, TX",
  },
  {
    id: "hhd-aging",
    category: "support",
    name: "Houston Health Department — Aging Services",
    description: {
      en: "City programs for older adults: meals, wellness, and caregiver help.",
      es: "Programas municipales para adultos mayores: comidas, bienestar y apoyo.",
    },
    zips: ["77002","77004","77019","77023","77026","77033","77051","77093"],
    phone: "832-393-4301",
    url: "https://www.houstonhealth.org",
    address: "8000 N Stadium Dr, Houston, TX",
  },

  // Programs for the patient
  {
    id: "amazing-place",
    category: "programs",
    name: "Amazing Place",
    description: {
      en: "Day program for adults with mild-to-moderate dementia — engagement, art, and music.",
      es: "Programa diurno para adultos con demencia leve a moderada — actividades, arte y música.",
    },
    zips: ["77005","77006","77019","77024","77025","77027","77098"],
    phone: "713-552-0420",
    url: "https://www.amazingplacehouston.org",
    address: "3735 Drexel Dr, Houston, TX",
  },
  {
    id: "sheltering-arms",
    category: "programs",
    name: "Sheltering Arms Senior Services",
    description: {
      en: "Adult day centers across Harris County with dementia-friendly activities.",
      es: "Centros diurnos para adultos mayores en Harris County con actividades amigables.",
    },
    zips: ["77002","77004","77026","77033","77051","77093"],
    phone: "713-685-6577",
    url: "https://shelteringarms.org",
    address: "3838 Aberdeen Way, Houston, TX",
  },
  {
    id: "metropolitan-multi",
    category: "programs",
    name: "Metropolitan Multi-Service Center (Senior)",
    description: {
      en: "City-run senior center: fitness, classes, lunch, and social activities.",
      es: "Centro municipal para mayores: ejercicio, clases, almuerzo y actividades sociales.",
    },
    zips: ["77019","77006","77098","77027"],
    phone: "832-393-4301",
    url: "https://www.houstontx.gov/parks/seniorprograms.html",
    address: "1475 W Gray St, Houston, TX",
  },
  {
    id: "third-ward-multi",
    category: "programs",
    name: "Third Ward Multi-Service Center (Senior)",
    description: {
      en: "Senior programs, hot meals, and community events on the east side.",
      es: "Programas para mayores, comidas calientes y eventos comunitarios.",
    },
    zips: ["77004","77023","77026","77033","77051"],
    phone: "832-393-4501",
    address: "3611 Ennis St, Houston, TX",
  },

  // Events (synthetic, near-term)
  {
    id: "evt-caregiver-circle",
    category: "events",
    name: "Caregiver Support Circle",
    description: {
      en: "Weekly group for family caregivers — share, vent, and learn. Free.",
      es: "Grupo semanal para cuidadores familiares — comparte y aprende. Gratis.",
    },
    zips: ["77002","77004","77006","77019","77027"],
    phone: "800-272-3900",
    address: "Alzheimer's Association, 2242 W Holcombe Blvd",
    date: isoDaysFromNow(3),
    time: "6:30 PM",
  },
  {
    id: "evt-memory-cafe",
    category: "events",
    name: "Memory Café at Amazing Place",
    description: {
      en: "A relaxed social hour for people with dementia and their care partners.",
      es: "Una hora social tranquila para personas con demencia y sus cuidadores.",
    },
    zips: ["77005","77006","77019","77025","77027","77098"],
    phone: "713-552-0420",
    address: "3735 Drexel Dr, Houston, TX",
    date: isoDaysFromNow(6),
    time: "10:00 AM",
  },
  {
    id: "evt-senior-activity",
    category: "events",
    name: "Senior Activity Day — Metropolitan Center",
    description: {
      en: "Music, light exercise, and lunch. Free for adults 60+.",
      es: "Música, ejercicio suave y almuerzo. Gratis para adultos de 60+.",
    },
    zips: ["77019","77006","77098","77027"],
    phone: "832-393-4301",
    address: "1475 W Gray St, Houston, TX",
    date: isoDaysFromNow(9),
    time: "11:00 AM",
  },
];

function isoDaysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localISODate(d);
}

export function filterResourcesByZip(zip: string): Resource[] {
  const clean = zip.trim();
  if (!/^\d{5}$/.test(clean)) return HOUSTON_RESOURCES;
  // Loose match: same first 3 digits = nearby in Houston
  const prefix = clean.slice(0, 3);
  const exact = HOUSTON_RESOURCES.filter((r) => r.zips.includes(clean));
  if (exact.length >= 3) return exact;
  const nearby = HOUSTON_RESOURCES.filter((r) => r.zips.some((z) => z.startsWith(prefix)));
  return nearby.length ? nearby : HOUSTON_RESOURCES;
}
