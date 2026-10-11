// Pre-written, reminiscence-first replies for the demo patient. PURE (no imports of images/server code), so both
// the server and the browser can use them. They are the demo's safety net: if Gemini, ElevenLabs, Backboard or the
// network fails, the conversation still continues — warm, on-topic, grounded in Rosa's story — and each line has a
// pre-generated audio file in /public/demo-audio (see scripts/gen-demo-audio.ts).
import type { Lang } from "../guardrails";

export type Canned = { id: string; test: RegExp; en: string; es: string };

const rx = (s: string) => new RegExp(s, "i");

export const CANNED: Canned[] = [
  { id: "wedding", test: rx("wedding|bride|married|boda|novia|casad"), en: "Your wedding day was so beautiful, and you were a lovely bride. Tell me, what made you smile most that day?", es: "Tu día de bodas fue tan hermoso, y eras una novia preciosa. Cuéntame, ¿qué fue lo que más te hizo sonreír ese día?" },
  { id: "maria", test: rx("mar[ií]a|daughter|hija"), en: "María loves you so much, and she is always thinking of you. What is your favorite thing to do together with her?", es: "María te quiere muchísimo y siempre piensa en ti. ¿Qué es lo que más te gusta hacer con ella?" },
  { id: "carlos", test: rx("carlos|\\bson\\b|hijo"), en: "Carlos is part of your lovely family. What is something fun you did with him when he was little?", es: "Carlos es parte de tu hermosa familia. ¿Qué es algo divertido que hacías con él cuando era pequeño?" },
  { id: "elena", test: rx("elena|sister|hermana"), en: "Elena is your sister, and sisters share the best stories. Tell me one you love.", es: "Elena es tu hermana, y las hermanas comparten las mejores historias. Cuéntame una que te guste." },
  { id: "grandkids", test: rx("grand|nietos|nieto|beach|playa"), en: "Your grandchildren adore you. I'd love to hear about a happy day with them at the beach.", es: "Tus nietos te adoran. Me encantaría escuchar de un día feliz con ellos en la playa." },
  { id: "music", test: rx("music|song|sing|dance|baile|canci|m[uú]sica|cant|vicente|pedro infante|bolero"), en: "Music always brings a smile to your face. Shall we listen to Vicente Fernández together?", es: "La música siempre te trae una sonrisa. ¿Escuchamos juntas a Vicente Fernández?" },
  { id: "garden", test: rx("garden|rose|flower|tomato|bench|jard[ií]n|rosa|flor|tomate"), en: "Your garden is so lovely in the spring, with your roses and tomatoes. Tell me about your favorite corner of it.", es: "Tu jardín es tan lindo en primavera, con tus rosas y tus tomates. Cuéntame de tu rincón favorito." },
  { id: "school", test: rx("school|teach|student|class|kinder|escuela|maestra|alumnos|clase"), en: "You taught so many little ones, and they were lucky to have you. What did you love most about your classroom?", es: "Enseñaste a tantos pequeños, y fueron afortunados de tenerte. ¿Qué era lo que más te gustaba de tu salón?" },
  { id: "home", test: rx("home|work|late|kids|children|casa|trabajo|tarde|ni[nñ]os"), en: "You care so much about everyone. Let's sit together for a moment. Shall we listen to a song you love?", es: "Te importa tanto la gente que quieres. Sentémonos juntas un momento. ¿Escuchamos una canción que te guste?" },
  { id: "worried", test: rx("scared|afraid|lost|alone|nobody|sad|worried|miedo|sola|nadie|triste|preocup"), en: "You are safe, and you are so loved. Would you like to look at a photo of your garden together?", es: "Estás a salvo y te quieren mucho. ¿Quieres que veamos juntas una foto de tu jardín?" },
  { id: "generic1", test: rx("."), en: "It's so lovely being here with you. What is something that makes you smile today?", es: "Qué bonito estar aquí contigo. ¿Qué es algo que te hace sonreír hoy?" },
];

/** Best on-topic canned reply for what was said (falls back to a warm generic line). */
export function pickCanned(lang: Lang, text: string): { id: string; text: string } {
  const hit = CANNED.find((c) => c.test.test(text)) ?? CANNED[CANNED.length - 1];
  return { id: hit.id, text: hit[lang] };
}

export const STATIC_AUDIO_URL = (id: string, lang: Lang) => `/demo-audio/${id}.${lang}.mp3`;
