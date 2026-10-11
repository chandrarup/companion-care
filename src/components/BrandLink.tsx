import { Logo } from "./Logo";

/**
 * The Companion Care logo + name. Always goes to the home page (the "I'm a caregiver / I have a diagnosis / Try the
 * demo" screen), including when signed in (?home=1 tells the home page not to auto-redirect to the app).
 */
export function BrandLink({
  size = 26,
  name = "Companion Care",
  nameClassName = "font-semibold tracking-tight truncate",
  collapseNameOnPhone = false,
}: {
  size?: number;
  name?: string | null;
  nameClassName?: string;
  /** Show just the logo (never squeezed out) on narrow screens where other header controls need the room. */
  collapseNameOnPhone?: boolean;
}) {
  return (
    <a
      href="/?home=1"
      aria-label="Companion Care — home"
      className="flex items-center gap-2 shrink-0 sm:shrink min-w-0 min-h-11 rounded-lg hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Logo size={size} className="shrink-0" />
      {name && <span className={`${collapseNameOnPhone ? "hidden sm:inline " : ""}${nameClassName}`}>{name}</span>}
    </a>
  );
}
