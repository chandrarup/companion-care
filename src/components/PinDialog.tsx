import { useState } from "react";
import { useT } from "@/i18n/I18nProvider";

export function PinDialog({
  open,
  onCancel,
  onVerify,
}: {
  open: boolean;
  onCancel: () => void;
  onVerify: (pin: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await onVerify(pin);
    setBusy(false);
    if (!ok) {
      setError(t("mode.pinIncorrect"));
      setPin("");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("mode.enterPin")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg bg-card text-card-foreground p-6 border border-border"
      >
        <h2 className="text-2xl font-semibold mb-2">{t("mode.enterPin")}</h2>
        <p className="mb-4 text-muted-foreground">{t("mode.pinPrompt")}</p>
        <input
          autoFocus
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full text-center tracking-[0.5em] text-3xl py-3 border border-input rounded-md bg-background"
          aria-label={t("mode.enterPin")}
        />
        {error && (
          <p role="alert" className="mt-3 text-destructive">
            ✕ {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-border bg-background"
            data-touch
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={pin.length !== 4 || busy}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            data-touch
          >
            {t("mode.unlock")}
          </button>
        </div>
      </form>
    </div>
  );
}