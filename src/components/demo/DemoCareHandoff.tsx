import { localISODate } from "@/lib/demo/dates";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Clock, ArrowRightLeft, Check, X, ChevronRight, UserPlus, Sparkles } from "lucide-react";
import { DEMO_PEOPLE, ROSA } from "@/lib/demo/data";

type Lang = "en" | "es";
type Mode = "short" | "full";
type Step = "pick" | "who" | "summary" | "done";

const T = {
  title: { en: "Care handoff", es: "Transferencia de cuidado" },
  subtitle: {
    en: "Hand off Rosa's care — cleanly and simply.",
    es: "Transfiere el cuidado de Rosa — de forma simple y clara.",
  },
  short: { en: "Short-term cover", es: "Cobertura temporal" },
  shortDesc: {
    en: "A respite worker or relative watches Rosa for a short time. They see her essentials. Access ends automatically.",
    es: "Un cuidador de relevo o familiar cuida a Rosa por poco tiempo. Ven lo esencial. El acceso termina solo.",
  },
  full: { en: "Complete handover", es: "Traspaso completo" },
  fullDesc: {
    en: "New primary caregiver or facility. Two years of context transfers — profile, logs, triggers, insights.",
    es: "Nuevo cuidador principal o residencia. Se transfieren dos años de contexto — perfil, registros, desencadenantes, ideas.",
  },
  whoTitle: { en: "Who is taking over?", es: "¿Quién asumirá el cuidado?" },
  newPerson: { en: "Someone new", es: "Alguien nuevo" },
  namePh: { en: "Their name", es: "Su nombre" },
  rolePh: { en: "Relationship (e.g. respite worker)", es: "Relación (ej. cuidador de relevo)" },
  until: { en: "Access until", es: "Acceso hasta" },
  summaryTitle: { en: "They will see", es: "Verán" },
  shortItems: {
    en: [
      "What calms Rosa (music, photos, gentle voice)",
      "Daily routines (morning, meals, rest, evening)",
      "Her cues — early signs she's getting tired or upset",
      "Her favorite songs and family photos",
      "Clear steps for if she becomes agitated",
    ],
    es: [
      "Lo que calma a Rosa (música, fotos, voz suave)",
      "Rutinas diarias (mañana, comidas, descanso, noche)",
      "Sus señales — primeros signos de cansancio o malestar",
      "Sus canciones favoritas y fotos familiares",
      "Pasos claros si se agita",
    ],
  },
  fullItems: {
    en: [
      "Full profile and medical context",
      "All logs and notes (last 2 years)",
      "Trigger fingerprint — patterns Companion Care learned",
      "Insights, summaries, and physician reports",
      "Photos, music, routines, and care circle",
      "Ongoing reminders and care plan",
    ],
    es: [
      "Perfil completo y contexto médico",
      "Todos los registros y notas (últimos 2 años)",
      "Huella de desencadenantes — patrones que Companion Care aprendió",
      "Resúmenes, ideas e informes médicos",
      "Fotos, música, rutinas y círculo de cuidado",
      "Recordatorios y plan de cuidado continuos",
    ],
  },
  confirm: { en: "Confirm handoff", es: "Confirmar transferencia" },
  back: { en: "Back", es: "Atrás" },
  next: { en: "Continue", es: "Continuar" },
  done: { en: "Done", es: "Listo" },
  doneTitle: (name: string, l: Lang) =>
    l === "es"
      ? `El cuidado de Rosa está listo para ${name}.`
      : `Rosa's care is ready for ${name}.`,
  doneSub: {
    en: "Everything Companion Care learned about her goes with her.",
    es: "Todo lo que Companion Care aprendió sobre ella va con ella.",
  },
  openBtn: { en: "Hand off care", es: "Transferir cuidado" },
};

export function DemoCareHandoffButton({ L }: { L: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition p-4 flex items-center gap-3 text-left"
      >
        <span className="h-10 w-10 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center shrink-0">
          <ArrowRightLeft size={20} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">{T.openBtn[L]}</span>
          <span className="block text-xs text-muted-foreground">{T.subtitle[L]}</span>
        </span>
        <ChevronRight size={18} className="text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open && <DemoCareHandoff L={L} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function DemoCareHandoff({ L, onClose }: { L: Lang; onClose: () => void }) {
  const [step, setStep] = useState<Step>("pick");
  const [mode, setMode] = useState<Mode>("short");
  const [personId, setPersonId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [until, setUntil] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return localISODate(d);
  });

  const chosenName =
    personId === "new"
      ? newName.trim() || (L === "es" ? "la nueva persona" : "the new person")
      : DEMO_PEOPLE.find((p) => p.id === personId)?.name ?? "";

  const canPickNext = !!personId && (personId !== "new" || newName.trim().length > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-background/95 border-b border-border px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-primary" /> {T.title[L]}
          </h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-md hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {step === "pick" && (
            <>
              <p className="text-sm text-muted-foreground">{T.subtitle[L]}</p>
              <button
                onClick={() => { setMode("short"); setStep("who"); }}
                className="w-full text-left rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 p-5 transition"
              >
                <div className="flex items-start gap-3">
                  <span className="h-11 w-11 rounded-full bg-tint text-tint-foreground inline-flex items-center justify-center shrink-0">
                    <Clock size={22} />
                  </span>
                  <div>
                    <p className="font-semibold text-lg">{T.short[L]}</p>
                    <p className="text-sm text-muted-foreground mt-1">{T.shortDesc[L]}</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setMode("full"); setStep("who"); }}
                className="w-full text-left rounded-2xl border border-border hover:border-primary/50 hover:bg-primary/5 p-5 transition"
              >
                <div className="flex items-start gap-3">
                  <span className="h-11 w-11 rounded-full bg-tint text-tint-foreground inline-flex items-center justify-center shrink-0">
                    <Shield size={22} />
                  </span>
                  <div>
                    <p className="font-semibold text-lg">{T.full[L]}</p>
                    <p className="text-sm text-muted-foreground mt-1">{T.fullDesc[L]}</p>
                  </div>
                </div>
              </button>
            </>
          )}

          {step === "who" && (
            <>
              <h4 className="font-semibold">{T.whoTitle[L]}</h4>
              <div className="grid gap-2">
                {DEMO_PEOPLE.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPersonId(p.id)}
                    className={`text-left rounded-xl border p-3 flex items-center justify-between ${personId === p.id ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.relationship[L]}</p>
                    </div>
                    {personId === p.id && <Check size={18} className="text-primary" />}
                  </button>
                ))}
                <button
                  onClick={() => setPersonId("new")}
                  className={`text-left rounded-xl border p-3 flex items-center gap-2 ${personId === "new" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <UserPlus size={18} className="text-primary" />
                  <span className="font-medium">{T.newPerson[L]}</span>
                </button>
                {personId === "new" && (
                  <div className="space-y-2 pl-2">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={T.namePh[L]}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
                    />
                    <input
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      placeholder={T.rolePh[L]}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
                    />
                  </div>
                )}
              </div>

              {mode === "short" && (
                <label className="block">
                  <span className="text-sm font-medium">{T.until[L]}</span>
                  <input
                    type="date"
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                    min={localISODate()}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
                  />
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep("pick")} className="flex-1 rounded-xl border border-border py-3 font-medium">
                  {T.back[L]}
                </button>
                <button
                  disabled={!canPickNext}
                  onClick={() => setStep("summary")}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 font-medium disabled:opacity-50"
                >
                  {T.next[L]}
                </button>
              </div>
            </>
          )}

          {step === "summary" && (
            <>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">
                  {mode === "short" ? T.short[L] : T.full[L]} ·{" "}
                  <span className="font-medium text-foreground">{chosenName}</span>
                  {mode === "short" && (
                    <>
                      {" · "}
                      {L === "es" ? "hasta" : "until"}{" "}
                      <span className="font-medium text-foreground">
                        {new Date(until + "T00:00:00").toLocaleDateString(L === "es" ? "es-ES" : "en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">{T.summaryTitle[L]}</h4>
                <ul className="space-y-2">
                  {(mode === "short" ? T.shortItems[L] : T.fullItems[L]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check size={16} className="mt-0.5 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep("who")} className="flex-1 rounded-xl border border-border py-3 font-medium">
                  {T.back[L]}
                </button>
                <button
                  onClick={() => setStep("done")}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 font-medium"
                >
                  {T.confirm[L]}
                </button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-tint text-tint-foreground inline-flex items-center justify-center">
                <Check size={32} />
              </div>
              <div>
                <p className="text-lg font-semibold">{T.doneTitle(chosenName, L)}</p>
                <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1 justify-center">
                  <Sparkles size={14} className="text-primary" /> {T.doneSub[L]}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {L === "es"
                  ? `Paciente: ${ROSA.name}`
                  : `Patient: ${ROSA.name}`}
              </p>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-medium"
              >
                {T.done[L]}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
