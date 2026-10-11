import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Phone, ShieldAlert, Check, X, MapPin, Clock, Users, Bell } from "lucide-react";
import { DEMO_PEOPLE, ROSA, DEMO_LOGS } from "@/lib/demo/data";
import { scanLogsForRedFlags } from "@/lib/demo/red-flags";

type Lang = "en" | "es";

// ───────────────────────────── Red-flag banner ─────────────────────────────

export function DemoRedFlagBanner({ L }: { L: Lang }) {
  const matches = scanLogsForRedFlags(DEMO_LOGS);
  const [dismissed, setDismissed] = useState(false);
  if (matches.length === 0 || dismissed) return null;
  const doctor = DEMO_PEOPLE.find((p) => p.id === "alvarez");

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-destructive bg-card p-5"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="h-11 w-11 rounded-full bg-destructive/10 text-destructive inline-flex items-center justify-center shrink-0">
          <AlertTriangle size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground">
            {L === "es" ? "Estas señales pueden ser serias." : "These signs can be serious."}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {L === "es"
              ? `Por favor contacta al médico de ${ROSA.preferredName}. Companion Care no diagnostica — solo te avisa.`
              : `Please contact ${ROSA.preferredName}'s doctor. Companion Care never diagnoses — it only flags.`}
          </p>
          <ul className="mt-3 space-y-1">
            {matches.map((m) => (
              <li key={m.flag.id} className="text-sm text-foreground flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                <span>{m.flag.label[L]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {doctor && (
              <a
                href={`tel:${doctor.phone}`}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive text-destructive-foreground px-4 py-2.5 text-base font-semibold"
              >
                <Phone size={18} />
                {L === "es" ? `Llamar a ${doctor.name}` : `Call ${doctor.name}`}
              </a>
            )}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card text-foreground px-3 py-2.5 text-sm"
            >
              {L === "es" ? "Ocultar por ahora" : "Hide for now"}
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// ───────────────────────────── Emergency button ────────────────────────────

export function DemoEmergencyButton({
  L,
  variant = "card",
}: {
  L: Lang;
  variant?: "card" | "pill" | "patient";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"confirm" | "sending" | "done">("confirm");

  const start = () => {
    setStep("confirm");
    setOpen(true);
  };
  const trigger = () => {
    setStep("sending");
    window.setTimeout(() => setStep("done"), 1200);
  };

  const Btn =
    variant === "pill" ? (
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-1.5 rounded-full bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-semibold"
      >
        <ShieldAlert size={14} /> {L === "es" ? "Emergencia" : "Emergency"}
      </button>
    ) : variant === "patient" ? (
      <button
        type="button"
        onClick={start}
        className="w-full rounded-2xl bg-destructive text-destructive-foreground px-4 py-3 font-semibold inline-flex items-center justify-center gap-2"
      >
        <ShieldAlert size={20} />
        {L === "es" ? "Pedir ayuda" : "Get help"}
      </button>
    ) : (
      <button
        type="button"
        onClick={start}
        className="w-full rounded-2xl border-2 border-destructive bg-card hover:bg-muted transition p-4 flex items-center gap-3 text-left"
      >
        <span className="h-10 w-10 rounded-full bg-destructive text-destructive-foreground inline-flex items-center justify-center shrink-0">
          <ShieldAlert size={20} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-foreground">
            {L === "es" ? "Pedir ayuda · Avisar a mi círculo" : "Get help · Notify my circle"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {L === "es"
              ? "Alerta a todos los contactos cercanos para que vengan a ver a Rosa."
              : "Alerts everyone close to come check on Rosa."}
          </span>
        </span>
      </button>
    );

  return (
    <>
      {Btn}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => step !== "sending" && setOpen(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="font-semibold inline-flex items-center gap-2">
                  <ShieldAlert size={18} className="text-destructive" />
                  {L === "es" ? "Alerta de emergencia" : "Emergency alert"}
                </h3>
                {step !== "sending" && (
                  <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-muted" aria-label="Close">
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="p-5 space-y-4">
                {step === "confirm" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {L === "es"
                        ? `Esto avisará a todos los contactos cercanos para que vengan a ver a ${ROSA.preferredName}.`
                        : `This will alert everyone close to come check on ${ROSA.preferredName}.`}
                    </p>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 inline-flex items-center gap-1">
                        <Users size={12} /> {L === "es" ? "Se avisará a" : "Will alert"}
                      </p>
                      <ul className="space-y-1.5">
                        {DEMO_PEOPLE.map((p) => (
                          <li key={p.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.relationship[L]}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{p.phone}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={trigger}
                      className="w-full rounded-2xl bg-destructive text-destructive-foreground py-4 text-lg font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <Bell size={20} />
                      {L === "es" ? "Avisar ahora a mi círculo" : "Alert my circle now"}
                    </button>
                    <p className="text-xs text-center text-muted-foreground">
                      {L === "es"
                        ? "Para una emergencia médica grave, llama al 911."
                        : "For a serious medical emergency, call 911."}
                    </p>
                  </>
                )}
                {step === "sending" && (
                  <div className="py-10 text-center">
                    <div className="mx-auto h-14 w-14 rounded-full border-4 border-border border-t-destructive animate-spin" />
                    <p className="mt-4 font-medium">
                      {L === "es" ? "Avisando a tu círculo…" : "Alerting your circle…"}
                    </p>
                  </div>
                )}
                {step === "done" && (
                  <div className="py-6 text-center space-y-4">
                    <div className="mx-auto h-16 w-16 rounded-full bg-tint text-tint-foreground inline-flex items-center justify-center">
                      <Check size={32} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">
                        {L === "es"
                          ? `Tu círculo ha sido avisado para venir a ver a ${ROSA.preferredName}.`
                          : `Your circle has been alerted to check on ${ROSA.preferredName}.`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {L === "es"
                          ? `${DEMO_PEOPLE.length} personas notificadas`
                          : `${DEMO_PEOPLE.length} people notified`}
                      </p>
                    </div>
                    <button
                      onClick={() => setOpen(false)}
                      className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-medium"
                    >
                      {L === "es" ? "Listo" : "Done"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ───────────────────────────── Where is Rosa (caregiver only) ──────────────

export function DemoWhereIsRosa({ L }: { L: Lang }) {
  // Synthetic location: home address-ish; "last seen" minutes ago is stable per session
  const minutesAgo = 12;
  const place = L === "es" ? "Cerca de casa · Jardín trasero" : "Near home · Back garden";
  const address = "1428 Olive St, Houston, TX";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-primary" />
          <h3 className="font-semibold">{L === "es" ? `Dónde está ${ROSA.preferredName}` : `Where is ${ROSA.preferredName}`}</h3>
        </div>
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Clock size={12} />
          {L === "es" ? `Visto hace ${minutesAgo} min` : `Last seen ${minutesAgo} min ago`}
        </span>
      </div>

      {/* Static stylized map */}
      <div className="relative h-56 bg-muted">
        <svg viewBox="0 0 400 220" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {/* park / green */}
          <rect x="20" y="20" width="140" height="90" rx="10" fill="#EDE6DD" />
          <rect x="240" y="120" width="140" height="80" rx="10" fill="#EDE6DD" />
          {/* blocks */}
          <rect x="180" y="30" width="60" height="60" rx="4" fill="#F4EFE9" stroke="#E6DED5" />
          <rect x="180" y="120" width="60" height="60" rx="4" fill="#F4EFE9" stroke="#E6DED5" />
          {/* roads */}
          <line x1="0" y1="110" x2="400" y2="110" stroke="#CFC4B9" strokeWidth="10" />
          <line x1="170" y1="0" x2="170" y2="220" stroke="#CFC4B9" strokeWidth="10" />
          <line x1="0" y1="110" x2="400" y2="110" stroke="#fff" strokeWidth="1" strokeDasharray="6 8" />
          <line x1="170" y1="0" x2="170" y2="220" stroke="#fff" strokeWidth="1" strokeDasharray="6 8" />
        </svg>
        {/* Pin with pulse */}
        <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inset-0 -m-3 rounded-full bg-destructive/30 animate-ping" />
          <span className="relative h-7 w-7 rounded-full bg-destructive border-2 border-white flex items-center justify-center text-primary-foreground">
            <MapPin size={14} />
          </span>
        </div>
        <div className="absolute bottom-2 left-2 right-2 bg-white/85 rounded-lg px-3 py-2 text-xs">
          <p className="font-medium text-foreground">{place}</p>
          <p className="text-muted-foreground">{address}</p>
        </div>
      </div>

      <div className="px-4 py-3 text-xs text-muted-foreground">
        {L === "es"
          ? "Solo visible para el círculo de cuidado — nunca para el paciente."
          : "Visible to the care circle only — never to the patient."}
      </div>
    </div>
  );
}
