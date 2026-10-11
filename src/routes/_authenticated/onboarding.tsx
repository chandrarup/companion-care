import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BrandLink } from "@/components/BrandLink";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useT, type Lang } from "@/i18n/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DemoBanner } from "@/components/DemoBanner";
import {
  getIntakeState,
  startIntake,
  saveIntakeStep,
  setCaptureMode,
  attachPhotos,
} from "@/lib/intake.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  AudioRecorder,
  ChipInput,
  Field,
  KeyPeopleInput,
  LanguageMulti,
  StagePicker,
  TextArea,
  TextInput,
  btnGhost,
  btnPrimary,
  btnSecondary,
  type KeyPerson,
} from "@/components/intake/IntakeFields";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Set up — Companion Care" }] }),
  component: OnboardingPage,
});

type Progress = { step1: boolean; step2: boolean; step3: boolean };
type Mode = "guided" | "form";

function OnboardingPage() {
  const { t, lang, setLang } = useT();
  const navigate = useNavigate();
  const stateFn = useServerFn(getIntakeState);
  const captureModeFn = useServerFn(setCaptureMode);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Progress>({ step1: false, step2: false, step3: false });
  const [captureMode, setMode] = useState<Mode>("guided");
  const [patient, setPatient] = useState<any>(null);
  const [view, setView] = useState<"loading" | "step1" | "step2" | "step3" | "dashboard">(
    "loading",
  );

  async function refresh() {
    const s = await stateFn();
    setProgress(s.progress as Progress);
    setMode(s.captureMode);
    setPatient(s.patient ?? null);
    if (!s.hasHousehold || !s.progress.step1) setView("step1");
    else setView("dashboard");
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patientName: string =
    patient?.preferred_name || patient?.display_name || t("intake.fields.displayName");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <DemoBanner />
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <BrandLink size={24} name={t("app.name")} nameClassName="font-semibold" />
          <LanguageToggle />
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-6 pb-32">
        {loading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : view === "step1" ? (
          <Step1
            onDone={async () => {
              setLang(lang);
              await refresh();
              navigate({ to: "/patient" });
            }}
          />
        ) : view === "dashboard" ? (
          <Dashboard
            progress={progress}
            onOpen={(s) => setView(`step${s}` as any)}
            onGoApp={() => navigate({ to: "/today" })}
          />
        ) : (
          <StepEditor
            step={view === "step2" ? 2 : 3}
            patient={patient}
            captureMode={captureMode}
            patientName={patientName}
            onCaptureMode={async (m) => {
              setMode(m);
              await captureModeFn({ data: { mode: m } });
            }}
            onClose={async () => {
              await refresh();
              setView("dashboard");
            }}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Dashboard
// ============================================================================
function Dashboard({
  progress,
  onOpen,
  onGoApp,
}: {
  progress: Progress;
  onOpen: (step: 2 | 3) => void;
  onGoApp: () => void;
}) {
  const { t } = useT();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">{t("intake.dashboard.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("intake.dashboard.lead")}</p>
      </header>

      <div className="rounded-md border border-border bg-card p-4 flex items-center justify-between">
        <div>
          <div className="font-medium">✓ {t("intake.step1.complete")}</div>
        </div>
        <button onClick={onGoApp} className={btnPrimary} data-touch>
          {t("intake.dashboard.goToApp")}
        </button>
      </div>

      {([2, 3] as const).map((s) => (
        <div
          key={s}
          className="rounded-md border border-border bg-card p-4 flex items-center justify-between gap-3"
        >
          <div>
            <div className="font-medium">{t(`intake.step${s}.title`)}</div>
            <div className="text-sm text-muted-foreground">{t(`intake.step${s}.lead`)}</div>
            {progress[`step${s}` as "step2" | "step3"] && (
              <div className="text-sm text-primary mt-1">✓ {t("intake.dashboard.done")}</div>
            )}
          </div>
          <button onClick={() => onOpen(s)} className={btnSecondary} data-touch>
            {progress[`step${s}` as "step2" | "step3"]
              ? t("intake.dashboard.edit")
              : t("intake.dashboard.start")}
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Step 1 — required, creates household
// ============================================================================
function Step1({ onDone }: { onDone: () => void }) {
  const { t, lang } = useT();
  const start = useServerFn(startIntake);
  const attach = useServerFn(attachPhotos);
  const save = useServerFn(saveIntakeStep);
  const [householdName, setHouseholdName] = useState("");
  const [pref, setPref] = useState<Lang>(lang);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [addressAs, setAddressAs] = useState("");
  const [languages, setLanguages] = useState<Lang[]>([lang]);
  const [photos, setPhotos] = useState<{ file: File; caption: string }[]>([]);
  const [music, setMusic] = useState<string[]>([]);
  const [greeting, setGreeting] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!householdName.trim()) return setErr(t("intake.errors.householdName"));
    if (!/^\d{4}$/.test(pin)) return setErr(t("intake.errors.pinFormat"));
    if (pin !== pin2) return setErr(t("intake.errors.pinMismatch"));
    if (!displayName.trim()) return setErr(t("intake.errors.patientName"));
    setBusy(true);
    try {
      const res = await start({
        data: {
          householdName,
          preferredLanguage: pref,
          pin,
          patient: {
            displayName,
            preferredName,
            addressAs,
            languages: languages.length ? languages : [pref],
          },
        },
      });
      const householdId = res.householdId;

      // Photos
      const uploaded: { path: string; caption: string }[] = [];
      for (const p of photos) {
        const safe = p.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${householdId}/${crypto.randomUUID()}-${safe}`;
        const up = await supabase.storage.from("family-photos").upload(path, p.file, {
          contentType: p.file.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) throw new Error(up.error.message);
        uploaded.push({ path, caption: p.caption });
      }
      if (uploaded.length > 0) {
        await attach({ data: { items: uploaded } });
      }

      // Greeting audio
      let greetingPath: string | null = null;
      if (greeting) {
        const ext = (greeting.type.split("/")[1] || "webm").split(";")[0];
        const path = `${householdId}/greeting-${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("family-photos").upload(path, greeting, {
          contentType: greeting.type || "audio/webm",
          upsert: false,
        });
        if (up.error) throw new Error(up.error.message);
        greetingPath = path;
      }

      // Music + greeting via saveIntakeStep (no markComplete; step1 already true)
      const patch: Record<string, any> = {};
      if (music.length) patch.music_preferences = music;
      if (greetingPath) patch.greeting_audio_path = greetingPath;
      if (Object.keys(patch).length) {
        await save({ data: { step: 1, patch } });
      }

      onDone();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">{t("intake.step1.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("intake.step1.lead")}</p>
      </header>

      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <Field label={t("intake.fields.householdName")} help={t("intake.fields.householdNameHelp")}>
          <TextInput value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
        </Field>
        <Field label={t("intake.fields.preferredLanguage")}>
          <LanguageMulti value={[pref]} onChange={(v) => v[0] && setPref(v[0])} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("intake.fields.pin")}>
            <TextInput
              inputMode="numeric"
              maxLength={4}
              className="tracking-[0.5em] text-center"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label={t("intake.fields.pinConfirm")}>
            <TextInput
              inputMode="numeric"
              maxLength={4}
              className="tracking-[0.5em] text-center"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <Field label={t("intake.fields.displayName")}>
          <TextInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={t("intake.fields.preferredName")}>
            <TextInput value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
          </Field>
          <Field label={t("intake.fields.addressAs")} help={t("intake.fields.addressAsHelp")}>
            <TextInput value={addressAs} onChange={(e) => setAddressAs(e.target.value)} />
          </Field>
        </div>
        <Field label={t("intake.fields.languages")}>
          <LanguageMulti value={languages} onChange={setLanguages} />
        </Field>
      </section>

      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <Field label={t("intake.fields.photos")} help={t("intake.fields.photosHelp")}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) =>
              setPhotos(Array.from(e.target.files ?? []).map((file) => ({ file, caption: "" })))
            }
            className="block"
          />
        </Field>
        {photos.length > 0 && (
          <ul className="space-y-2">
            {photos.map((p, i) => (
              <li key={i} className="border border-border rounded-md p-2 flex gap-2 items-center">
                <span className="flex-1 truncate text-sm">{p.file.name}</span>
                <TextInput
                  placeholder={t("intake.fields.caption")}
                  value={p.caption}
                  onChange={(e) => {
                    const next = [...photos];
                    next[i] = { ...next[i], caption: e.target.value };
                    setPhotos(next);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <Field label={t("intake.fields.music")} help={t("intake.fields.musicHelp")}>
          <ChipInput items={music} setItems={setMusic} />
        </Field>
        <Field label={t("intake.fields.greeting")} help={t("intake.fields.greetingHelp")}>
          <AudioRecorder value={greeting} onBlob={setGreeting} />
        </Field>
      </section>

      {err && (
        <p role="alert" className="text-destructive">
          ✕ {err}
        </p>
      )}

      <div className="flex justify-end">
        <button onClick={submit} disabled={busy} className={btnPrimary} data-touch>
          {busy ? t("common.loading") : t("intake.step1.submit")}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2 / 3 editor — shared shell with Guided + Form toggle
// ============================================================================

type FieldKind =
  | "text"
  | "longtext"
  | "chips"
  | "people"
  | "stage"
  | "date"
  | "bool"
  | "zip";

type FieldSpec = {
  key: string; // column on patient_profile
  kind: FieldKind;
  labelKey: string;
  helpKey?: string;
  promptKey: string;
};

const STEP2_FIELDS: FieldSpec[] = [
  {
    key: "daily_routines",
    kind: "longtext",
    labelKey: "intake.fields.wakeMealsSleep",
    helpKey: "intake.fields.wakeMealsSleepHelp",
    promptKey: "intake.guided.wakeMealsSleep",
  },
  {
    key: "life_events_historical",
    kind: "chips",
    labelKey: "intake.fields.historicalRoutine",
    helpKey: "intake.fields.historicalRoutineHelp",
    promptKey: "intake.guided.historicalRoutine",
  },
  { key: "likes", kind: "chips", labelKey: "intake.fields.likes", promptKey: "intake.guided.likes" },
  {
    key: "dislikes",
    kind: "chips",
    labelKey: "intake.fields.dislikes",
    promptKey: "intake.guided.dislikes",
  },
  {
    key: "calming_strategies",
    kind: "chips",
    labelKey: "intake.fields.calming",
    promptKey: "intake.guided.calming",
  },
  {
    key: "key_people",
    kind: "people",
    labelKey: "intake.fields.keyPeople",
    helpKey: "intake.fields.keyPeopleHelp",
    promptKey: "intake.guided.keyPeople",
  },
];

const STEP3_FIELDS: FieldSpec[] = [
  {
    key: "culture_faith",
    kind: "text",
    labelKey: "intake.fields.cultureFaith",
    promptKey: "intake.guided.cultureFaith",
  },
  {
    key: "profession",
    kind: "text",
    labelKey: "intake.fields.profession",
    promptKey: "intake.guided.profession",
  },
  {
    key: "hometown",
    kind: "text",
    labelKey: "intake.fields.hometown",
    promptKey: "intake.guided.hometown",
  },
  {
    key: "life_events",
    kind: "chips",
    labelKey: "intake.fields.lifeEvents",
    helpKey: "intake.fields.lifeEventsHelp",
    promptKey: "intake.guided.lifeEvents",
  },
  {
    key: "diagnosis_type",
    kind: "text",
    labelKey: "intake.fields.diagnosisType",
    promptKey: "intake.guided.diagnosisType",
  },
  {
    key: "diagnosis_date",
    kind: "date",
    labelKey: "intake.fields.diagnosisDate",
    promptKey: "intake.guided.diagnosisDate",
  },
  {
    key: "stage_self_select",
    kind: "stage",
    labelKey: "intake.fields.stage",
    promptKey: "intake.guided.stage",
  },
  {
    key: "medication_names",
    kind: "chips",
    labelKey: "intake.fields.medications",
    helpKey: "intake.fields.medicationsHelp",
    promptKey: "intake.guided.medications",
  },
  {
    key: "conditions",
    kind: "chips",
    labelKey: "intake.fields.conditions",
    promptKey: "intake.guided.conditions",
  },
  { key: "zip_code", kind: "zip", labelKey: "intake.fields.zip", promptKey: "intake.guided.zip" },
  {
    key: "referral_consent",
    kind: "bool",
    labelKey: "intake.fields.referral",
    promptKey: "intake.guided.referral",
  },
];

function StepEditor({
  step,
  patient,
  captureMode,
  patientName,
  onCaptureMode,
  onClose,
}: {
  step: 2 | 3;
  patient: any;
  captureMode: Mode;
  patientName: string;
  onCaptureMode: (m: Mode) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const save = useServerFn(saveIntakeStep);
  const specs = step === 2 ? STEP2_FIELDS : STEP3_FIELDS;

  // local state mirrors patient values for these fields
  const initial = useMemo(() => {
    const v: Record<string, any> = {};
    for (const s of specs) {
      if (s.key === "life_events_historical") {
        v[s.key] = (patient?.life_events ?? []).filter((x: string) => /\b(year|años|year[s]?|PM|AM)\b/i.test(x));
        // Practical: keep historical patterns merged into life_events; we just expose a chip input.
        // Initialize empty so user adds new ones; existing life_events still shown in step 3.
        v[s.key] = [];
      } else if (s.kind === "chips" || s.kind === "people") {
        v[s.key] = patient?.[s.key] ?? [];
      } else if (s.kind === "bool") {
        v[s.key] = patient?.[s.key] ?? false;
      } else {
        v[s.key] = patient?.[s.key] ?? "";
      }
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, step]);

  const [values, setValues] = useState<Record<string, any>>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setOne(key: string, v: any) {
    setValues((p) => ({ ...p, [key]: v }));
  }

  function buildPatch(markComplete: boolean) {
    const patch: Record<string, any> = {};
    for (const s of specs) {
      const v = values[s.key];
      if (s.key === "life_events_historical") {
        // Merge into life_events as additional entries
        if (Array.isArray(v) && v.length > 0) {
          const existing = (patient?.life_events ?? []) as string[];
          patch.life_events = Array.from(new Set([...existing, ...v]));
        }
        continue;
      }
      if (s.kind === "chips" || s.kind === "people") {
        if (Array.isArray(v)) patch[s.key] = v;
      } else if (s.kind === "bool") {
        patch[s.key] = !!v;
      } else if (s.kind === "date") {
        patch[s.key] = v ? v : null;
      } else {
        const str = typeof v === "string" ? v.trim() : v;
        patch[s.key] = str === "" ? null : str;
      }
    }
    return { step, patch, markComplete };
  }

  async function saveAll(markComplete: boolean) {
    setBusy(true);
    setErr(null);
    try {
      await save({ data: buildPatch(markComplete) });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t(`intake.step${step}.title`)}</h1>
        <p className="text-muted-foreground">{t(`intake.step${step}.lead`)}</p>
        <ModeToggle value={captureMode} onChange={onCaptureMode} />
      </header>

      {captureMode === "guided" ? (
        <GuidedFlow
          specs={specs}
          values={values}
          setOne={setOne}
          patientName={patientName}
          onFinish={() => saveAll(true)}
          onSaveLater={() => saveAll(false)}
          busy={busy}
        />
      ) : (
        <FormFlow
          specs={specs}
          values={values}
          setOne={setOne}
          onSubmit={() => saveAll(true)}
          onSaveLater={() => saveAll(false)}
          busy={busy}
        />
      )}

      {err && <p className="text-destructive">✕ {err}</p>}
    </div>
  );
}

function ModeToggle({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const { t } = useT();
  return (
    <div role="radiogroup" className="inline-flex rounded-md border border-border overflow-hidden">
      {(["guided", "form"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={"px-3 py-2 text-sm " + (value === m ? "bg-primary text-primary-foreground" : "bg-card")}
        >
          {t(`intake.modeToggle.${m}`)}
        </button>
      ))}
    </div>
  );
}

function FormFlow({
  specs,
  values,
  setOne,
  onSubmit,
  onSaveLater,
  busy,
}: {
  specs: FieldSpec[];
  values: Record<string, any>;
  setOne: (k: string, v: any) => void;
  onSubmit: () => void;
  onSaveLater: () => void;
  busy: boolean;
}) {
  const { t } = useT();
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      {specs.map((s) => (
        <Field key={s.key} label={t(s.labelKey)} help={s.helpKey ? t(s.helpKey) : undefined}>
          <FieldRenderer spec={s} value={values[s.key]} onChange={(v) => setOne(s.key, v)} />
        </Field>
      ))}
      <div className="flex justify-between pt-2 gap-2 flex-wrap">
        <button onClick={onSaveLater} disabled={busy} className={btnSecondary} data-touch>
          {t("intake.saveContinueLater")}
        </button>
        <button onClick={onSubmit} disabled={busy} className={btnPrimary} data-touch>
          {busy ? t("common.loading") : t("common.save")}
        </button>
      </div>
    </div>
  );
}

function GuidedFlow({
  specs,
  values,
  setOne,
  patientName,
  onFinish,
  onSaveLater,
  busy,
}: {
  specs: FieldSpec[];
  values: Record<string, any>;
  setOne: (k: string, v: any) => void;
  patientName: string;
  onFinish: () => void;
  onSaveLater: () => void;
  busy: boolean;
}) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const spec = specs[i];
  const isLast = i === specs.length - 1;

  function skip() {
    if (isLast) onFinish();
    else setI(i + 1);
  }
  function next() {
    if (isLast) onFinish();
    else setI(i + 1);
  }
  function back() {
    if (i > 0) setI(i - 1);
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <div className="text-sm text-muted-foreground">
        {i + 1} / {specs.length}
      </div>
      <h2 className="text-xl font-semibold">{t(spec.promptKey, { name: patientName })}</h2>
      {spec.helpKey && <p className="text-sm text-muted-foreground">{t(spec.helpKey)}</p>}

      <FieldRenderer
        spec={spec}
        value={values[spec.key]}
        onChange={(v) => setOne(spec.key, v)}
        autoFocus
      />

      <div className="flex flex-wrap gap-2 justify-between pt-2">
        <button onClick={back} disabled={i === 0} className={btnGhost} data-touch>
          ← {t("intake.back")}
        </button>
        <div className="flex flex-wrap gap-2">
          <button onClick={skip} className={btnGhost} data-touch>
            {t("intake.skipQuestion")}
          </button>
          <button onClick={onSaveLater} disabled={busy} className={btnSecondary} data-touch>
            {t("intake.saveContinueLater")}
          </button>
          <button onClick={next} disabled={busy} className={btnPrimary} data-touch>
            {isLast ? t("common.save") : t("intake.next")} →
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRenderer({
  spec,
  value,
  onChange,
  autoFocus,
}: {
  spec: FieldSpec;
  value: any;
  onChange: (v: any) => void;
  autoFocus?: boolean;
}) {
  const { t } = useT();
  switch (spec.kind) {
    case "text":
      return (
        <TextInput autoFocus={autoFocus} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "longtext":
      return (
        <TextArea
          rows={4}
          autoFocus={autoFocus}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "chips":
      return <ChipInput items={Array.isArray(value) ? value : []} setItems={onChange} />;
    case "people":
      return (
        <KeyPeopleInput items={(value ?? []) as KeyPerson[]} setItems={onChange as any} />
      );
    case "stage":
      return <StagePicker value={value ?? null} onChange={onChange} />;
    case "date":
      return (
        <TextInput type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "zip":
      return (
        <TextInput
          inputMode="numeric"
          maxLength={10}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "bool":
      return (
        <div className="flex gap-2">
          {[
            { v: true, l: t("common.yes") },
            { v: false, l: t("common.no") },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange(o.v)}
              className={
                "px-4 py-2 rounded-md border min-h-12 " +
                (value === o.v ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card")
              }
            >
              {o.l}
            </button>
          ))}
        </div>
      );
  }
}
