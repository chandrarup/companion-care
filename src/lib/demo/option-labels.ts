// EN/ES labels for the episode-log option ids used across demo forms.
type Lang = "en" | "es";
const D: Record<string, { en: string; es: string }> = {
  // symptoms
  forgetfulness: { en: "Forgetfulness", es: "Olvidos" },
  confusion: { en: "Confusion", es: "Confusión" },
  agitation: { en: "Agitation", es: "Agitación" },
  constipation: { en: "Constipation", es: "Estreñimiento" },
  overstimulation: { en: "Too much noise or activity", es: "Demasiado ruido o actividad" },
  understimulation: { en: "Too little to do", es: "Muy poca actividad" },
  poor_sleep: { en: "Poor sleep", es: "Mal sueño" },
  appetite_change: { en: "Appetite change", es: "Cambio de apetito" },
  wandering: { en: "Wandering", es: "Deambular" },
  other: { en: "Something else", es: "Otra cosa" },
  // antecedents
  hunger: { en: "Hunger", es: "Hambre" },
  thirst: { en: "Thirst", es: "Sed" },
  pain: { en: "Pain", es: "Dolor" },
  fatigue: { en: "Tiredness", es: "Cansancio" },
  missed_cue: { en: "Missed reminder", es: "Recordatorio omitido" },
  environment_change: { en: "Change of place", es: "Cambio de lugar" },
  visitor_change: { en: "New or different visitor", es: "Visita nueva o distinta" },
  unknown: { en: "Not sure", es: "No estoy seguro/a" },
  // outcomes
  helped: { en: "It helped", es: "Ayudó" },
  no_change: { en: "No change", es: "Sin cambios" },
  worse: { en: "It got worse", es: "Empeoró" },
  // times of day
  morning: { en: "Morning", es: "Mañana" },
  afternoon: { en: "Afternoon", es: "Tarde" },
  evening: { en: "Evening", es: "Noche temprana" },
  night: { en: "Night", es: "Noche" },
  // red flags
  prolonged_confusion: { en: "Prolonged confusion throughout the day", es: "Confusión prolongada durante el día" },
  no_recognize_caregiver: { en: "New difficulty recognizing the caregiver", es: "Nueva dificultad para reconocer a la persona cuidadora" },
  hygiene_decline: { en: "Decline in hygiene or grooming", es: "Deterioro en la higiene o el aseo" },
  unusual_hallucinations: { en: "Out-of-the-ordinary hallucinations", es: "Alucinaciones fuera de lo común" },
};

export const optionLabel = (id: string, L: Lang) => D[id]?.[L] ?? id.replace(/_/g, " ");
