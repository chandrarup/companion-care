// The feeling the cloned voice speaks with. Shared by the server (which maps it to ElevenLabs settings) and the UI.
export const EMOTIONS = ["warm", "calm", "cheerful", "gentle"] as const;
export type Emotion = (typeof EMOTIONS)[number];
export const DEFAULT_EMOTION: Emotion = "warm";

/** What the caregiver picks: one fixed feeling, or "auto" = match the feeling of what the patient just said. */
export const VOICE_MOODS = ["auto", ...EMOTIONS] as const;
export type VoiceMood = (typeof VOICE_MOODS)[number];
export const isVoiceMood = (v: unknown): v is VoiceMood => typeof v === "string" && (VOICE_MOODS as readonly string[]).includes(v);

export const isEmotion = (v: unknown): v is Emotion => typeof v === "string" && (EMOTIONS as readonly string[]).includes(v);

export const EMOTION_TEXT: Record<Emotion, { label: { en: string; es: string }; hint: { en: string; es: string } }> = {
  warm: { label: { en: "Warm", es: "Cálida" }, hint: { en: "Loving and reassuring. The default.", es: "Cariñosa y tranquilizadora. La predeterminada." } },
  calm: { label: { en: "Calm", es: "Serena" }, hint: { en: "Slow and steady. Good for evenings.", es: "Lenta y estable. Buena para la noche." } },
  cheerful: { label: { en: "Cheerful", es: "Alegre" }, hint: { en: "Bright and upbeat. Good for mornings.", es: "Animada y luminosa. Buena para la mañana." } },
  gentle: { label: { en: "Gentle", es: "Suave" }, hint: { en: "Soft and quiet. For anxious moments.", es: "Suave y baja. Para momentos de ansiedad." } },
};

export const AUTO_TEXT = {
  label: { en: "Match their mood", es: "Según su ánimo" },
  hint: { en: "Adapts to what they just said: gentle when upset, cheerful when happy, calm when agitated, warm otherwise.", es: "Se adapta a lo que acaban de decir: suave si está triste, alegre si está contenta, serena si está agitada, cálida en lo demás." },
};

const WORDS: Record<Exclude<Emotion, "warm">, RegExp> = {
  // Hurting, frightened, lost or lonely: the softest voice.
  gentle: /\b(sad|cry|crying|cried|scared|afraid|frightened|lost|alone|lonely|hurt|hurts|pain|miss(?:ing)?|confus\w*|worr\w*|anxious|nervous|upset|help me|go home|want my|where is|where are|don'?t know|can'?t remember|forgot|dead|died|empty)\b|triste|llor\w*|miedo|asustad\w*|perdid\w*|sol[ao]\b|soledad|dolor|me duele|extra[ñn]\w*|confundid\w*|preocupad\w*|ansios\w*|nervios\w*|ayúdame|ayudame|quiero ir a casa|a casa|dónde está|donde esta|no sé|no se\b|no recuerdo|olvid\w*|muert\w*|vac[ií]\w*/i,
  // Frustrated or restless: slow things down.
  calm: /\b(angry|mad|annoyed|frustrated|tired|sleepy|can'?t sleep|stop|leave me|too loud|noisy|restless|bored|enough)\b|enojad\w*|molest\w*|harta|cansad\w*|sue[ñn]o|no puedo dormir|basta|ruido|inquiet\w*|aburrid\w*/i,
  // Joy, celebration, favourite things: brighten up.
  cheerful: /\b(happy|glad|love|loved|wonderful|beautiful|lovely|great|fun|laugh\w*|smile|smiling|birthday|party|dance|dancing|sing|song|music|garden|flowers|wedding|grandchildren|baby|delicious|thank you|thanks)\b|feliz|contenta|alegr\w*|me encanta|amo\b|hermos\w*|maravillos\w*|bonit\w*|divertid\w*|risa|re[ií]r|sonre\w*|cumplea[ñn]os|fiesta|bail\w*|cantar|canci[oó]n|m[uú]sica|jard[ií]n|flores|boda|nietos|gracias|delicios\w*/i,
};

/** Pick the feeling for a reply from what the patient said. A distress flag from the safety screen always wins. */
export function emotionForText(userText: string, flag?: string | null): Emotion {
  if (flag === "distress") return "gentle";
  const t = userText.normalize("NFC");
  if (WORDS.gentle.test(t)) return "gentle";
  if (WORDS.calm.test(t)) return "calm";
  if (WORDS.cheerful.test(t)) return "cheerful";
  return "warm";
}

/** Resolve a picked mood to a concrete emotion for one line of speech. */
export function resolveMood(mood: VoiceMood | null | undefined, userText?: string, flag?: string | null): Emotion {
  if (!mood || mood === "auto") return userText ? emotionForText(userText, flag) : DEFAULT_EMOTION;
  return mood;
}
