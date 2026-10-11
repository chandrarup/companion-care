import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/I18nProvider";

const inputCls = "w-full px-3 py-3 border border-input rounded-md bg-background";
export const btnPrimary =
  "px-5 py-3 rounded-md bg-primary text-primary-foreground disabled:opacity-50 min-h-12";
export const btnSecondary =
  "px-5 py-3 rounded-md border border-border bg-background disabled:opacity-50 min-h-12";
export const btnGhost = "px-4 py-2 rounded-md text-foreground/80 hover:bg-muted min-h-12";

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1 font-medium">{label}</span>
      {children}
      {help && <span className="block mt-1 text-sm text-muted-foreground">{help}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls + " " + (props.className ?? "")} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputCls + " " + (props.className ?? "")} />;
}

export function ChipInput({
  items,
  setItems,
  placeholder,
}: {
  items: string[];
  setItems: (v: string[]) => void;
  placeholder?: string;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v || items.includes(v)) return setDraft("");
    setItems([...items, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add} className={btnSecondary} data-touch>
          +
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((it) => (
            <li
              key={it}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground"
            >
              <span>{it}</span>
              <button
                type="button"
                aria-label={t("intake.skip") + " " + it}
                onClick={() => setItems(items.filter((x) => x !== it))}
                className="text-foreground/70"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type KeyPerson = {
  name: string;
  relationship?: string;
  contact_method?: string;
  contact_value?: string;
};

export function KeyPeopleInput({
  items,
  setItems,
}: {
  items: KeyPerson[];
  setItems: (v: KeyPerson[]) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState<KeyPerson>({ name: "" });
  function add() {
    if (!draft.name.trim()) return;
    setItems([...items, draft]);
    setDraft({ name: "" });
  }
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          className={inputCls}
          placeholder={t("intake.fields.personName")}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder={t("intake.fields.personRelationship")}
          value={draft.relationship ?? ""}
          onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
        />
        <input
          className={inputCls + " sm:col-span-2"}
          placeholder={t("intake.fields.personContact")}
          value={draft.contact_value ?? ""}
          onChange={(e) => setDraft({ ...draft, contact_value: e.target.value })}
        />
      </div>
      <button type="button" onClick={add} className={btnSecondary} data-touch>
        {t("intake.addAnother")}
      </button>
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((p, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-2 border border-border rounded-md p-3"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                {p.relationship && (
                  <div className="text-sm text-muted-foreground">{p.relationship}</div>
                )}
                {p.contact_value && (
                  <div className="text-sm text-muted-foreground">{p.contact_value}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="text-foreground/70"
                aria-label="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AudioRecorder({
  value,
  onBlob,
}: {
  value: Blob | null;
  onBlob: (b: Blob | null) => void;
}) {
  const { t } = useT();
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const urlRef = useRef<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("MediaRecorder" in window) || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!value) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(value);
    urlRef.current = u;
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [value]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        onBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch (e: any) {
      setError(e?.message ?? "Microphone error");
    }
  }
  function stop() {
    recRef.current?.stop();
    setRecording(false);
  }

  if (!supported)
    return (
      <p className="text-muted-foreground">
        {t("intake.fields.greetingHelp")} (microphone not supported in this browser)
      </p>
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <button type="button" onClick={start} className={btnSecondary} data-touch>
            🎤 {value ? t("intake.fields.rerecord") : t("intake.fields.record")}
          </button>
        ) : (
          <button type="button" onClick={stop} className={btnPrimary} data-touch>
            ■ {t("intake.fields.stop")}
          </button>
        )}
        {value && (
          <button type="button" onClick={() => onBlob(null)} className={btnGhost} data-touch>
            ✕
          </button>
        )}
      </div>
      {url && <audio controls src={url} className="w-full" />}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}

export function LanguageMulti({
  value,
  onChange,
}: {
  value: ("en" | "es")[];
  onChange: (v: ("en" | "es")[]) => void;
}) {
  const { t } = useT();
  function toggle(l: "en" | "es") {
    onChange(value.includes(l) ? value.filter((x) => x !== l) : [...value, l]);
  }
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {(["en", "es"] as const).map((l) => {
        const on = value.includes(l);
        return (
          <button
            key={l}
            type="button"
            onClick={() => toggle(l)}
            className={"px-4 py-2 min-h-12 " + (on ? "bg-primary text-primary-foreground" : "bg-card")}
            data-touch
          >
            {on ? "☑ " : "☐ "}
            {l === "en" ? t("common.english") : t("common.spanish")}
          </button>
        );
      })}
    </div>
  );
}

export function StagePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: "good_days" | "mixed" | "mostly_hard" | null) => void;
}) {
  const { t } = useT();
  const opts: { id: "good_days" | "mixed" | "mostly_hard"; label: string }[] = [
    { id: "good_days", label: t("intake.fields.stageGood") },
    { id: "mixed", label: t("intake.fields.stageMixed") },
    { id: "mostly_hard", label: t("intake.fields.stageHard") },
  ];
  return (
    <div className="space-y-2">
      {opts.map((o) => (
        <label
          key={o.id}
          className={
            "block border rounded-md p-3 cursor-pointer " +
            (value === o.id ? "border-primary bg-primary/10" : "border-border")
          }
        >
          <input
            type="radio"
            name="stage"
            className="mr-2"
            checked={value === o.id}
            onChange={() => onChange(o.id)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
