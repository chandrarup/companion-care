import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleQuestion, X, Send, Loader2, PlayCircle } from "lucide-react";
import { askCompanion } from "@/lib/demo.functions";
import { useT } from "@/i18n/I18nProvider";

type Answer = { answer: string; tag: string; cached: boolean; video_tag?: string | null };

export function FloatingAsk({ mode = "caregiver" }: { mode?: "caregiver" | "patient" }) {
  const ask = useServerFn(askCompanion);
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [a, setA] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const demoMode =
    typeof window !== "undefined" && window.localStorage.getItem("companion.demo") === "1";

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setA(null);
    try {
      const res = await ask({ data: { question: q, mode } });
      setA(res as Answer);
    } finally {
      setLoading(false);
    }
  }

  const placeholder =
    mode === "patient" ? "Tell me about…" : "Ask anything about her care…";

  return (
    <>
      {/* Floating button — clears bottom nav */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.94 }}
        whileHover={{ y: -2 }}
        aria-label="Ask"
        className="fixed right-4 lg:right-6 z-[60] inline-flex items-center gap-2 rounded-full px-4 sm:px-5 h-12 sm:h-14 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-ring/40"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
      >
        <MessageCircleQuestion size={22} strokeWidth={1.9} />
        <span className="hidden sm:inline">Ask</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              aria-label="Close"
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Ask"
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="relative w-full sm:max-w-xl mx-0 sm:mx-4 mb-0 sm:mb-0 max-h-[90dvh] sm:max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-card text-card-foreground border border-border overflow-hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-tint text-tint-foreground">
                    <MessageCircleQuestion size={18} strokeWidth={2} />
                  </span>
                  <h2 className="text-base font-semibold">Ask</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="p-2 -mr-2 rounded-full text-muted-foreground bg-muted"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={submit} className="px-5 pt-4">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted focus-within:border-primary focus-within:bg-card transition-colors">
                  <input
                    ref={inputRef}
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !q.trim()}
                    aria-label="Send"
                    className="m-1.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Plain-language guidance. Not medical advice.
                </p>
              </form>

              <div className="px-5 pb-5 pt-4 min-h-[120px] max-h-[55vh] overflow-y-auto">
                {!a && !loading && (
                  <div className="flex flex-wrap gap-2">
                    {(mode === "patient"
                      ? ["How am I today?", "Who's coming to visit?", "What should I do now?"]
                      : [
                          "Why does she keep asking the same question?",
                          "How do I handle sundowning?",
                          "She refuses to eat — what now?",
                        ]
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setQ(s)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {loading && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 size={16} className="animate-spin" /> Thinking…
                  </div>
                )}
                {a && (
                  <div className="rounded-2xl bg-muted border border-border p-4 text-[15px] leading-relaxed text-foreground space-y-3">
                    {demoMode && a.cached && (
                      <span className="inline-block rounded-full bg-tint px-2 py-0.5 text-xs font-medium text-tint-foreground">
                        demo · {a.tag}
                      </span>
                    )}
                    <p>{a.answer}</p>
                    {mode === "caregiver" && a.video_tag && (
                      <Link
                        to="/learn"
                        search={{ tag: a.video_tag }}
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <PlayCircle size={16} /> Watch (2 min)
                      </Link>
                    )}
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
