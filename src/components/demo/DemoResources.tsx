import { useMemo, useState } from "react";
import { MapPin, Phone, ExternalLink, Calendar, Heart, Users, Sparkles, Search } from "lucide-react";
import { HOUSTON_RESOURCES, filterResourcesByZip, type Resource } from "@/lib/demo/resources";

type Lang = "en" | "es";

const T = {
  title: { en: "Resources near you", es: "Recursos cerca de ti" },
  sub: {
    en: "Trusted local help for caregivers and for Rosa.",
    es: "Ayuda local de confianza para cuidadores y para Rosa.",
  },
  zipLabel: { en: "ZIP code", es: "Código postal" },
  groups: {
    support: { en: "Support for you (caregiver)", es: "Apoyo para ti (cuidador/a)" },
    programs: { en: "Programs for Rosa", es: "Programas para Rosa" },
    events: { en: "Events nearby", es: "Eventos cerca" },
  },
  empty: { en: "No matches — showing all Houston-area resources.", es: "Sin coincidencias — mostrando todos los recursos del área de Houston." },
  call: { en: "Call", es: "Llamar" },
  visit: { en: "Visit", es: "Ver sitio" },
};

const ICONS: Record<Resource["category"], React.ReactNode> = {
  support: <Heart size={16} />,
  programs: <Sparkles size={16} />,
  events: <Calendar size={16} />,
};

function formatDate(iso: string, L: Lang) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(L === "es" ? "es-ES" : "en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  } catch { return iso; }
}

function ResourceCard({ r, L }: { r: Resource; L: Lang }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
          {ICONS[r.category]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-snug">{r.name}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{r.description[L]}</p>
          {(r.date || r.address) && (
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {r.date && (
                <p className="inline-flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(r.date, L)}{r.time ? ` · ${r.time}` : ""}
                </p>
              )}
              {r.address && (
                <p className="inline-flex items-start gap-1">
                  <MapPin size={12} className="mt-0.5 shrink-0" /> <span>{r.address}</span>
                </p>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {r.phone && (
              <a
                href={`tel:${r.phone.replace(/\D/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium"
              >
                <Phone size={12} /> {T.call[L]} {r.phone}
              </a>
            )}
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                <ExternalLink size={12} /> {T.visit[L]}
              </a>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function DemoResources({ L }: { L: Lang }) {
  const [zip, setZip] = useState("77019");
  const filtered = useMemo(() => filterResourcesByZip(zip), [zip]);
  const usingAll = filtered.length === HOUSTON_RESOURCES.length && zip && !/^\d{5}$/.test(zip);

  const grouped: Record<Resource["category"], Resource[]> = {
    support: filtered.filter((r) => r.category === "support"),
    programs: filtered.filter((r) => r.category === "programs"),
    events: filtered.filter((r) => r.category === "events").sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Users size={18} className="text-primary" /> {T.title[L]}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{T.sub[L]}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <span className="text-muted-foreground text-xs">{T.zipLabel[L]}</span>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
              inputMode="numeric"
              placeholder="77019"
              className="w-28 rounded-lg border border-border bg-background pl-7 pr-2 py-1.5 text-sm"
            />
          </div>
        </label>
      </div>

      {usingAll && (
        <p className="text-xs text-muted-foreground italic">{T.empty[L]}</p>
      )}

      {(["support", "programs", "events"] as const).map((cat) =>
        grouped[cat].length > 0 ? (
          <div key={cat}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              {ICONS[cat]} {T.groups[cat][L]}
            </h4>
            <ul className="grid sm:grid-cols-2 gap-2">
              {grouped[cat].map((r) => <ResourceCard key={r.id} r={r} L={L} />)}
            </ul>
          </div>
        ) : null
      )}
    </section>
  );
}
