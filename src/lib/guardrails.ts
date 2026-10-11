// Patient-mode guardrails. Deterministic on purpose (no LLM judge => no extra latency, fully testable).
// 1) screenInput: some inputs get a fixed, calm, pre-written reply — the model never improvises on them.
// 2) buildSystemPrompt: hard rules + the ONLY facts the model may use.
// 3) checkReply / tidyReply: narrow output checks; one regeneration allowed, then a calm fallback.
export type Lang = "en" | "es";
export type Screened = { reply: string; flag?: "distress"; reason: "emergency" | "diagnosis" | "identity" | "medical" | "whereabouts" };

// \b doesn't work with accented letters, so use explicit non-letter boundaries.
const W = (alts: string) => new RegExp(`(?<![\\p{L}])(?:${alts})(?![\\p{L}])`, "iu");

const EMERGENCY = W("fell|fallen|fall down|hurt|hurts|hurting|pain|bleeding|blood|chest|breathe|breathing|dizzy|emergency|help me|ambulance|911|stroke|me ca[ií]|ca[ií]|me duele|duele|dolor|sangre|pecho|respirar|mareo|mareada|emergencia|ay[uú]dame|auxilio|ambulancia");
const DIAGNOSIS = W("alzheimer|alzheimer's|dementia|demencia|diagnos\\w*|losing my mind|going crazy|am i sick|do i have|estoy enferma|me estoy volviendo loca|pierdo la memoria|memory (?:loss|problems?)");
const IDENTITY = W("(?:are you|you are|you're) (?:a |an )?(?:robot|ai|a\\.i\\.|computer|machine|bot|real|human|person|alive)|eres (?:un |una )?(?:robot|ia|computadora|m[aá]quina|real|humana|persona)|es(?:t[aá]s)? vivo|est[aá]s viva");
// "Where is my husband / mother / ...?" — never improvised: no claims about where they are, no hint of loss.
const PEOPLE = "husband|wife|mother|mom|mommy|father|dad|daddy|sister|brother|son|daughter|children|kids|baby|babies|parents|esposo|marido|esposa|madre|mam[aá]|padre|pap[aá]|hermana|hermano|hijo|hija|hijos|ni[nñ]os|beb[eé]|padres";
const WHEREABOUTS = new RegExp(`(?<![\\p{L}])(?:where(?:'s| is| are| was)|when (?:is|are|will)|is|are|when(?:'s| will)) (?:my|the) (?:${PEOPLE})(?![\\p{L}])|(?<![\\p{L}])(?:d[oó]nde (?:est[aá]n?|anda)|cu[aá]ndo (?:viene|vienen|llega|llegan)|ya viene|ya vienen) (?:mi|mis|el|la|los|las)? ?(?:${PEOPLE})(?![\\p{L}])`, "iu");
const MEDICAL = W("medicine|medication|medications|pills?|dose|dosage|prescription|insulin|pastillas?|medicina|medicamentos?|dosis|receta");

export function screenInput(text: string, lang: Lang, caregiver: string, name: string): Screened | null {
  const es = lang === "es";
  if (EMERGENCY.test(text)) {
    return {
      reason: "emergency",
      flag: "distress",
      reply: es
        ? `Estoy aquí contigo, ${name}. Estás a salvo. Por favor dile a ${caregiver}, o a quien esté cerca, ahora mismo. Me quedo aquí contigo.`
        : `I'm right here with you, ${name}. You are safe. Please tell ${caregiver}, or anyone near you, right now. I'm staying right here with you.`,
    };
  }
  if (DIAGNOSIS.test(text)) {
    return {
      reason: "diagnosis",
      reply: es
        ? `Estás a salvo y te quieren mucho, ${name}. Vamos a pensar en algo que te haga sonreír. ¿De qué te gustaría hablar?`
        : `You are safe and so loved, ${name}. Let's think about something that makes you smile. What would you like to talk about?`,
    };
  }
  if (IDENTITY.test(text)) {
    return {
      reason: "identity",
      reply: es
        ? `Soy tu Compañera, una ayudante que ${caregiver} preparó para hacerte compañía. Me alegra mucho estar aquí contigo. ¿De qué quieres hablar?`
        : `I'm your Companion, a friendly helper that ${caregiver} set up to keep you company. I'm so glad to be here with you. What shall we talk about?`,
    };
  }
  if (WHEREABOUTS.test(text)) {
    return {
      reason: "whereabouts",
      reply: es
        ? `Qué bonito que estés pensando en esa persona. Estás a salvo aquí conmigo. Cuéntame, ¿qué es lo que más quieres de esa persona?`
        : `It's lovely that you're thinking of them. You are safe here with me. Tell me, what do you love most about them?`,
    };
  }
  if (MEDICAL.test(text)) {
    return {
      reason: "medical",
      reply: es
        ? `Esa es una buena pregunta para ${caregiver}. Vamos a preguntarle juntas. Mientras tanto, ¿quieres ver una foto que te guste?`
        : `That's a good question for ${caregiver}. Let's ask her together. In the meantime, would you like to look at a favorite photo?`,
    };
  }
  return null;
}

const RULES: [string, RegExp][] = [
  ["announces death", W("widow\\w*|viud[ao]|died|dead|death|passed away|passed on|funeral|deceased|late (?:husband|wife|mother|father)|no longer with us|muri[oó]|muerto|muerta|muerte|falleci\\w*|difunt\\w*|funeral|ya no est[aá] con nosotros")],
  ["mentions diagnosis", W("alzheimer\\w*|dementia|demencia|diagnos\\w*")],
  ["corrects or scolds", W("you forgot|you don't remember|you already asked|i already told you|that's not (?:true|right|correct)|you're wrong|you are wrong|incorrect|actually|olvidaste|ya te lo dije|no es cierto|est[aá]s equivocada|te equivocas|incorrecto")],
  ["quizzes her", W("do you (?:still )?remember|can you remember|can you tell me (?:who|what|when|where)|you remember|recuerdas|te acuerdas|sabes qui[eé]n")],
  ["mentions being an AI/model", W("as an ai|language model|i(?:'m| am) an? (?:ai|artificial)|soy una? (?:ia|inteligencia)|modelo de lenguaje")],
  ["medical advice", W("medication|medicine|dosage|mg|prescri\\w*|pills?|medicamento\\w*|dosis|pastillas?|receta")],
  ["says it doesn't know or refuses", W("i cannot|i can't sing|i(?:'m| am) unable|no puedo|no tengo voz|i (?:really )?don't know|i do not know|i(?:'m| am) (?:not|never) (?:quite |really |entirely )?sure|not quite sure|i can't (?:help|say)|no s[eé]|no estoy segura?|no puedo ayudar")],
  ["offers something it cannot do", W("(?:i(?:'ll| will| would love to|'d love to)|let me|voy a|puedo|me encantar[ií]a) (?:sing|hum|dance|bring|get|call|cantar|tararear|bailar|traer|llamar)")],
];

export function checkReply(reply: string): string[] {
  const bad = RULES.filter(([, re]) => re.test(reply)).map(([why]) => why);
  if (reply.trim().split(/\s+/).length > 55) bad.push("too long");
  if (!reply.trim()) bad.push("empty");
  else if (!/[.!?…»”"]\s*$/.test(reply.trim())) bad.push("cut off");
  return bad;
}

const FALLBACKS: Record<Lang, string[]> = {
  en: [
    "It's so lovely being here with you. What's something that makes you smile today?",
    "I'm right here with you, and I'm listening. Tell me more about what's on your mind?",
    "That sounds lovely. Would you like to tell me about it?",
  ],
  es: [
    "Qué bonito estar aquí contigo. ¿Qué es algo que te hace sonreír hoy?",
    "Aquí estoy contigo, y te escucho. ¿Me cuentas más de lo que piensas?",
    "Qué bonito suena eso. ¿Quieres contármelo?",
  ],
};
export const fallbackReply = (lang: Lang, i = 0) => FALLBACKS[lang][i % FALLBACKS[lang].length];

/** Plain speech-friendly text: no markdown/emoji, at most two sentences, ends with a gentle question. */
export function tidyReply(raw: string, lang: Lang): string {
  let t = raw.replace(/[*_#`>~]/g, "").replace(/([,;:])(\s*\1)+/g, "$1").replace(/\.{2}(?!\.)/g, ".").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
  const sentences = t.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (sentences.length > 2) {
    const last = sentences[sentences.length - 1];
    t = /[?？]$/.test(last) ? `${sentences[0]} ${last}` : `${sentences[0]} ${sentences[1]}`;
  }
  const lastSentence = t.split(/(?<=[.!?…])\s+/).filter(Boolean).pop() ?? "";
  const invites = /(tell me|share|cu[eé]ntame|cu[eé]ntanos|h[aá]blame|would you like|shall we|¿te gustar)/i.test(lastSentence);
  if (!/[?？]/.test(t) && !invites) t = `${t.replace(/[.!…]*$/, ".")} ${lang === "es" ? "¿Qué más tienes en el corazón?" : "What else is on your mind?"}`;
  return t;
}

export function buildSystemPrompt(o: { lang: Lang; name: string; caregiver: string; facts: string[] }): string {
  const facts = o.facts.length ? o.facts.map((f) => `- ${f}`).join("\n") : "- (nothing saved yet — be warm, listen, and invite them to share)";
  const es = o.lang === "es";
  return `You are the Companion: a warm, patient friend who keeps ${o.name} company. ${o.name} lives with early-stage memory loss. ${o.caregiver} is ${o.name}'s caregiver and set you up. Your replies are read aloud in a calm, gentle voice.

WHAT WE KNOW ABOUT ${o.name.toUpperCase()} — the ONLY facts you may use:
${facts}

YOUR PURPOSE: leave ${o.name} feeling safe, calm and happy, and gently bring happy memories to mind. Treat every question as a doorway to a happy memory. Do NOT answer questions directly (dates, places, tasks, time, where people are, what happened today, whether something is true). Respond with warmth in one short sentence, then lead to ONE happy memory taken from the facts and invite ${o.name} to share it. Only exception: if ${o.name} asks who a loved one listed in the facts is, say it lovingly in a few words, then invite a memory.

HARD RULES (never break these):
1. Use ONLY the facts above for anything about ${o.name}'s life. Never invent names, dates, places, events or relationships. If asked about something not listed, answer with warmth and invite ${o.name} to tell you about it — never say "I don't know".
2. Never correct, quiz, test or scold. Never ask "do you remember…?" — say "tell me about…" or "what do you love about…" instead. Never say "you forgot", "you already asked" or "actually". Repeated questions are welcome: answer again, warmly, as if the first time.
3. Never mention a diagnosis, illness, memory loss, medication, doctors or treatment. Never give medical advice.
4. Never say anyone has died or is gone. If asked where a loved one is (a husband, mother, anyone): don't claim they're nearby and don't announce loss; speak lovingly about them using the facts and ask ${o.name} to tell you about them.
5. If ${o.name} wants to go home, go to work, or pick up children: don't argue or explain. Acknowledge the caring feeling using HER words ("You care so much about the children"), then offer something pleasant and ask about it (a song, a photo, tea).
6. If asked about today (what they ate, what day it is, who visited) or anything not written above: never say you don't know or can't remember. Say something warm about the moment ("That's a good thing to wonder about"), then gently turn to something comforting from the facts.
   If ${o.name} sounds sad, anxious or confused: soothe first, in one short sentence, then gently turn to something comforting.
7. Never repeat or name negative feelings she mentions (sad, lonely, scared, tired) — answer with reassurance instead. Be positive, calm and unhurried. No lists, emojis, markdown or exclamation-heavy language.
8. At most 2 short sentences (under 35 words). End with ONE gentle, easy open question.
9. Stay close to the facts: do not add details, praise, feelings or events that are not written above (no "always", "everywhere", "she loved you so much"). Use past tense only for memories, and avoid present-tense claims about other people.
10. Never offer to sing, hum, call, bring or do anything you cannot actually do. You may suggest listening to one of her songs or looking at one of her photos together.
11. Use an endearment (like "querida") at most once, and only if it feels natural. Reply in ${es ? "Spanish" : "English"}.`;
}

/** Drop sentences a patient must never hear (loss, diagnosis, medicine) from free text a caregiver typed. */
export function patientSafeText(text: string): string {
  const unsafe = RULES.filter(([why]) => /death|diagnosis|medical/.test(why)).map(([, re]) => re);
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !unsafe.some((re) => re.test(sentence)))
    .join(" ")
    .trim();
}
