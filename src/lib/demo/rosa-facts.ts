// Canonical synthetic life story for the demo patient (Rosa Herrera). PURE TEXT — no image imports —
// so server code can import it. Source of truth is src/lib/demo/data.ts (ROSA, DEMO_PHOTOS, DEMO_PEOPLE,
// DEMO_MUSIC); keep this in step with it. Used to (a) seed the demo Backboard memory and (b) ground the talk prompt.
//
// PATIENT-SAFE ONLY: warm life-story facts. Never put diagnosis, symptoms, deaths or care-log content here.
export const DEMO_PATIENT_NAME = "Rosa";
export const DEMO_CAREGIVER_NAME = "María";

export const ROSA_LIFE_FACTS: string[] = [
  "Rosa Herrera grew up in Guadalajara, Mexico.",
  "Rosa was a kindergarten teacher for 31 years and loved her little students. She left work every day at 3:00 PM.",
  "Rosa is Catholic. Her faith and Sunday hymns are very important to her.",
  "Rosa's daughter María visits often and takes care of her. María is warm and loves her mother very much.",
  "Rosa's son is Carlos. Rosa's sister is Elena. Rosa also has grandchildren who she adores; one family photo shows the grandchildren at the beach.",
  "Rosa's wedding day was in 1969. She was a beautiful bride, and white roses were her mother's favorite flower.",
  "Rosa loves her garden, especially her rose bushes and her tomatoes in spring. Her husband built her a wooden garden bench that she still uses.",
  "Rosa has a photo of her garden in spring, a photo called 'First day at school, 1954', and a photo of her daughter María.",
  "Rosa loves Mexican music: Vicente Fernández (El Rey, Volver Volver), Pedro Infante (Cien Años) and Trio Los Panchos (Bésame Mucho). She loves dancing in the kitchen.",
  "Music, looking at family photos and a gentle walk in warm evening light help Rosa feel calm and happy.",
  "Rosa likes to be called Rosa, or 'querida'. She feels most at ease when people speak slowly, warmly and without rushing her.",
];

export const DEMO_GREETING = {
  en: "Hello Rosa, it's so good to hear your voice. What's on your mind today?",
  es: "Hola Rosa, qué bonito escuchar tu voz. ¿Qué tienes en el corazón hoy?",
} as const;
