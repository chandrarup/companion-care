import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Lock, Database, Users, Mail, FileText } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useT } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & Privacy — Companion Care" },
      {
        name: "description",
        content:
          "How Companion Care handles your data, authentication, and privacy. Maintained by the Companion Care team.",
      },
      { property: "og:title", content: "Trust & Privacy — Companion Care" },
      {
        property: "og:description",
        content:
          "How Companion Care handles your data, authentication, and privacy.",
      },
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  const { t } = useT();
  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-wide">
            {t("app.name")}
          </Link>
          <LanguageToggle />
        </div>
      </header>
      <main className="flex-1 px-4 py-10">
        <article className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              <Shield className="h-3.5 w-3.5" aria-hidden /> Trust & Privacy
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              How we handle your data
            </h1>
            <p className="text-muted-foreground">
              This page is maintained by the Companion Care team to answer common
              security and privacy questions about the app. It describes
              controls currently enabled in the product; it is not an
              independent certification or third-party audit.
            </p>
          </header>

          <Section
            icon={<Lock className="h-5 w-5" aria-hidden />}
            title="Accounts & authentication"
          >
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Sign-in is handled by our managed authentication provider with
                email/password and Google sign-in.
              </li>
              <li>
                Sessions are stored locally in your browser and expire
                automatically; you can sign out at any time from Settings.
              </li>
              <li>
                Demo Mode creates a disposable account so you can explore the
                product without giving us real information.
              </li>
            </ul>
          </Section>

          <Section
            icon={<Database className="h-5 w-5" aria-hidden />}
            title="Data you put into Companion Care"
          >
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Daily logs, photos, notes, and care-circle membership are
                stored in our managed Postgres database with row-level access
                rules so a household's data is only visible to its members.
              </li>
              <li>
                Photos are kept in a private storage bucket and served through
                short-lived signed URLs — they are not publicly browsable.
              </li>
              <li>
                Writes to sensitive tables (household membership, invitations,
                roles, audit log) are restricted to server code; the browser
                cannot modify them directly.
              </li>
            </ul>
          </Section>

          <Section
            icon={<Users className="h-5 w-5" aria-hidden />}
            title="Who can see what"
          >
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>
                Each household has its own circle. Clinicians invited to a
                household see only the physician summary view, not raw daily
                logs.
              </li>
              <li>
                Records become read-only after a configurable edit-lock window
                (default 3 days) to keep the care record stable.
              </li>
              <li>
                The Ask Companion chat in Demo Mode uses synthetic responses
                only; no real medical advice is given and clinical questions
                are routed back to the care team.
              </li>
            </ul>
          </Section>

          <Section
            icon={<FileText className="h-5 w-5" aria-hidden />}
            title="Subprocessors & hosting"
          >
            <p className="text-muted-foreground">
              Companion Care runs on a Vultr cloud server and stores its data in
              a managed Tiger Data (PostgreSQL) database. Assistant replies use
              Google Gemini, the caregiver's cloned voice is generated by
              ElevenLabs, and the patient's profile memory is kept with
              Backboard. These are third-party services we rely on, not an
              independent security certification of Companion Care.
            </p>
          </Section>

          <Section
            icon={<Shield className="h-5 w-5" aria-hidden />}
            title="Retention & deletion"
          >
            <p className="text-muted-foreground">
              You can remove individual entries from within the app during the
              edit window. To request full deletion of a household's data,
              contact us using the address below and we will remove it from
              the live database. Backups age out on the platform's standard
              schedule.
            </p>
          </Section>

          <Section
            icon={<Mail className="h-5 w-5" aria-hidden />}
            title="Reporting a security concern"
          >
            <p className="text-muted-foreground">
              If you believe you have found a security or privacy issue,
              please email the Companion Care team and we will respond as soon as
              possible. Please do not share specific vulnerability details in
              public channels until we have had a chance to investigate.
            </p>
          </Section>

          <p className="text-xs text-muted-foreground border-t border-border pt-6">
            This page is project-owned content. It is not a certification or
            third-party verification. Specific legal,
            regulatory, or compliance commitments require a separate written
            agreement with the Companion Care team.
          </p>
        </article>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-lg bg-primary/10 text-primary p-2">{icon}</div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="text-base leading-relaxed">{children}</div>
    </section>
  );
}