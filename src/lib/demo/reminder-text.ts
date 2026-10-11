// Reminder wording, kept free of image imports so the audio generation script can read it too.
export type Lang = "en" | "es";
export type ReminderLine = { id: string; title: Record<Lang, string>; body: Record<Lang, string> };

export const REMINDER_LINES: ReminderLine[] = [
  { id: "water", title: { en: "Time for water", es: "Hora de tomar agua" }, body: { en: "A small glass keeps Rosa steady this afternoon.", es: "Un vaso pequeño ayuda a Rosa esta tarde." } },
  { id: "med", title: { en: "Rosa's medication reminder", es: "Recordatorio de medicación" }, body: { en: "Time for her afternoon pill with a snack.", es: "Hora de su pastilla de la tarde con un bocadillo." } },
  { id: "snack", title: { en: "A little snack?", es: "¿Un bocadillo?" }, body: { en: "Apple slices and a few crackers — her favorite.", es: "Rebanadas de manzana y galletas — sus favoritas." } },
  { id: "music", title: { en: "Music moment", es: "Momento musical" }, body: { en: "Vicente Fernández eases the 3pm transition.", es: "Vicente Fernández alivia la transición de las 3pm." } },
];

export const DEFAULT_CAREGIVER_NAME = "María";

/** What the patient hears. The recorded demo audio is generated from exactly this text with the default name. */
export function reminderSpoken(r: ReminderLine, lang: Lang, name: string = DEFAULT_CAREGIVER_NAME): string {
  return lang === "es"
    ? `Hola Rosa, soy ${name}. ${r.title.es}. ${r.body.es}`
    : `Hi Rosa, it's ${name}. ${r.title.en}. ${r.body.en}`;
}

export const REMINDER_AUDIO_URL = (id: string, lang: Lang) => `/demo-audio/reminder-${id}.${lang}.mp3`;
