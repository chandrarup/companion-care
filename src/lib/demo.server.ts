import { recomputeFingerprintInline } from "./fingerprint.server";
import { safeDbError } from "./safe-errors";

const DEMO_NAME = "Rosa Herrera Demo";
const PHOTO_CAPTIONS = [
  "Rosa & Alberto, 1969",
  "Rosa's classroom, 1985",
  "The rose garden",
  "Christmas tamales",
  "Granddaughter Sofia's quinceañera",
  "Rosa teaching, 1990",
];

function dateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function getOrCreateUser(admin: any, email: string, displayName: string) {
  // Try existing
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName, demo: true },
    password: crypto.randomUUID(),
  });
  if (error || !created?.user) throw safeDbError(error, "createUser failed");
  // Ensure a public.users row exists (in case the trigger isn't attached) and set name.
  await admin
    .from("users")
    .upsert({ id: created.user.id, email, display_name: displayName }, { onConflict: "id" });
  return created.user.id as string;
}

export async function wipeDemoHouseholds(admin: any, userId?: string) {
  // Scope to the caller's own demo households when a userId is provided so a
  // demo user can't blow away other concurrent demo sessions.
  if (userId) {
    const { data: mem } = await admin
      .from("memberships")
      .select("household_id, households!inner(id, is_demo)")
      .eq("user_id", userId)
      .eq("households.is_demo", true);
    const ids = Array.from(
      new Set((mem ?? []).map((r: any) => r.household_id as string)),
    );
    if (ids.length === 0) return 0;
    await admin.from("households").delete().in("id", ids);
    return ids.length;
  }
  const { data: hh } = await admin.from("households").select("id").eq("is_demo", true);
  const ids = (hh ?? []).map((r: any) => r.id);
  if (ids.length === 0) return 0;
  // FK cascades handle children
  await admin.from("households").delete().in("id", ids);
  return ids.length;
}

export async function seedDemoHousehold(admin: any, primaryUserId: string) {
  // 1. Household
  const { data: hh, error: hErr } = await admin
    .from("households")
    .insert({
      name: DEMO_NAME,
      preferred_language: "es",
      edit_lock_days: 3,
      is_demo: true,
    })
    .select("id")
    .single();
  if (hErr || !hh) throw safeDbError(hErr, "household insert failed");
  const householdId = hh.id as string;

  // 2. Patient profile
  await admin.from("patient_profile").insert({
    household_id: householdId,
    display_name: "Rosa Herrera",
    language: "es",
    biography:
      "Born in Monterrey, Mexico, 1948. Moved to Houston in 1968. Taught 2nd grade at a Houston ISD elementary school for 31 years; school day ended at 3:00 PM and she walked home every afternoon. Widow of Alberto (married 49 years). Loves cooking (mole, tamales at Christmas), tending her rose garden, and her grandchildren. Preferred address: Señora Rosa (never 'patient').",
    daily_routines:
      "Wakes 6:30 AM, coffee on the porch, lunch at noon. Historically left school at 3:00 PM — still becomes restless and wants to 'go home' in the late afternoon. Dinner 6 PM, bed 9 PM.",
    music_preferences: [
      "Vicente Fernández",
      "Javier Solís",
      "Boleros",
      "Pedro Infante",
      "Sunday church hymns",
    ],
    known_triggers: [
      "loud or crowded rooms",
      "being rushed",
      "late afternoon restlessness",
      "skipped meals",
    ],
  });

  // 3. Media (placeholder picsum images)
  const photos = PHOTO_CAPTIONS.map((caption, i) => ({
    household_id: householdId,
    storage_path: `https://picsum.photos/seed/rosa-${i + 1}/800/800`,
    kind: "photo",
    caption,
    tags: ["demo"],
    created_by: primaryUserId,
  }));
  await admin.from("media").insert(photos);

  // 4. Family circle
  // Primary caregiver = current user (María)
  await admin
    .from("users")
    .update({ display_name: "María Herrera" })
    .eq("id", primaryUserId);
  await admin.from("memberships").insert({
    user_id: primaryUserId,
    household_id: householdId,
    role: "primary_caregiver",
    permissions: {},
  });

  const danielId = await getOrCreateUser(
    admin,
    `daniel-${householdId.slice(0, 8)}@demo.companion.app`,
    "Daniel Herrera",
  );
  await admin.from("memberships").insert({
    user_id: danielId,
    household_id: householdId,
    role: "family",
    permissions: { photos: "read", cues: "read", symptom_logs: null },
  });

  const drId = await getOrCreateUser(
    admin,
    `alvarez-${householdId.slice(0, 8)}@demo.companion.app`,
    "Dr. Alvarez",
  );
  await admin.from("memberships").insert({
    user_id: drId,
    household_id: householdId,
    role: "clinician",
    permissions: {},
  });

  // 5. 14 daily logs across past 2 weeks
  type LogSeed = {
    daysAgo: number;
    mood: string;
    sleep: number | null;
    notes: string | null;
    voice?: string | null;
    symptoms: Array<{
      symptom: string;
      time_of_day?: string;
      antecedent?: string;
      intervention_tried?: string;
      outcome?: string;
    }>;
  };

  const patternSymptom = {
    symptom: "agitation",
    time_of_day: "afternoon",
    antecedent: "understimulation",
    intervention_tried: "played Vicente Fernández",
    outcome: "helped",
  };

  const seeds: LogSeed[] = [
    { daysAgo: 13, mood: "4", sleep: 4, notes: "Calm day in the garden.", symptoms: [] },
    {
      daysAgo: 12,
      mood: "2",
      sleep: 3,
      notes: "Restless around 3pm again.",
      voice:
        "She got restless around 3 again, kept asking to go home, I put on her Vicente Fernández and she settled.",
      symptoms: [patternSymptom],
    },
    { daysAgo: 11, mood: "5", sleep: 4, notes: "Good day, cooked tamales.", symptoms: [] },
    {
      daysAgo: 10,
      mood: "2",
      sleep: 4,
      notes: "Afternoon agitation, music helped.",
      symptoms: [patternSymptom],
    },
    {
      daysAgo: 9,
      mood: "3",
      sleep: 2,
      notes: "Up several times overnight.",
      symptoms: [
        { symptom: "poor_sleep", time_of_day: "night", antecedent: "", intervention_tried: "", outcome: "" },
      ],
    },
    { daysAgo: 8, mood: "4", sleep: 4, notes: "Quiet day, watched novelas.", symptoms: [] },
    {
      daysAgo: 7,
      mood: "2",
      sleep: 4,
      notes: "Same 3pm pattern.",
      voice:
        "Otra vez por la tarde — quería irse a casa. Le puse Vicente Fernández y se calmó.",
      symptoms: [patternSymptom],
    },
    {
      daysAgo: 6,
      mood: "3",
      sleep: 4,
      notes: "Confused this morning, didn't recognize the kitchen for a moment.",
      symptoms: [
        {
          symptom: "confusion",
          time_of_day: "morning",
          antecedent: "",
          intervention_tried: "gentle reassurance",
          outcome: "helped",
        },
      ],
    },
    { daysAgo: 5, mood: "5", sleep: 5, notes: "Great day.", symptoms: [] },
    {
      daysAgo: 4,
      mood: "2",
      sleep: 4,
      notes: "3pm again. Music worked.",
      symptoms: [patternSymptom],
    },
    {
      daysAgo: 3,
      mood: "3",
      sleep: 4,
      notes: "Didn't eat much at lunch.",
      symptoms: [
        {
          symptom: "appetite_change",
          time_of_day: "afternoon",
          antecedent: "",
          intervention_tried: "offered favorite soup",
          outcome: "partially",
        },
      ],
    },
    { daysAgo: 2, mood: "4", sleep: 4, notes: "Calm afternoon.", symptoms: [] },
    {
      daysAgo: 1,
      mood: "2",
      sleep: 4,
      notes: "Late afternoon restlessness, Vicente Fernández helped.",
      voice:
        "She started pacing around 3:15, asking about the children. Put on her music and she sat down.",
      symptoms: [patternSymptom],
    },
    { daysAgo: 0, mood: "4", sleep: 4, notes: "Quiet morning so far.", symptoms: [] },
  ];

  for (const s of seeds) {
    const d = dateNDaysAgo(s.daysAgo);
    const { data: dl } = await admin
      .from("daily_logs")
      .insert({
        household_id: householdId,
        log_date: isoDate(d),
        mood: s.mood,
        sleep_quality: s.sleep,
        notes: s.voice ? `${s.notes}\n\n[voice]: ${s.voice}` : s.notes,
        created_by: primaryUserId,
        created_at: d.toISOString(),
      })
      .select("id")
      .single();
    if (dl && s.symptoms.length > 0) {
      await admin.from("log_symptoms").insert(
        s.symptoms.map((sy) => ({
          daily_log_id: dl.id,
          symptom: sy.symptom,
          time_of_day: sy.time_of_day ?? null,
          antecedent: sy.antecedent || null,
          intervention_tried: sy.intervention_tried || null,
          outcome: sy.outcome || null,
          created_at: d.toISOString(),
        })),
      );
    }
  }

  // 6. Cues
  const cueSeeds = [
    { cue_type: "hydration", label: "Water break", schedule_times: ["10:00", "14:00"] },
    { cue_type: "medication", label: "Morning + evening meds", schedule_times: ["08:00", "20:00"] },
    {
      cue_type: "appointment",
      label: "Dr. Alvarez — next Tuesday 2 PM",
      schedule_times: ["14:00"],
    },
  ];
  for (const c of cueSeeds) {
    const { data: cue } = await admin
      .from("cues")
      .insert({
        household_id: householdId,
        cue_type: c.cue_type,
        label: c.label,
        schedule_times: c.schedule_times,
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        active: true,
        payload: {},
      })
      .select("id")
      .single();
    if (!cue) continue;
    // Seed mixed done/missed events for past 7 days
    const events: any[] = [];
    for (let day = 7; day >= 1; day--) {
      const base = dateNDaysAgo(day);
      for (const t of c.schedule_times) {
        const [hh2, mm] = t.split(":").map(Number);
        const when = new Date(base);
        when.setHours(hh2, mm, 0, 0);
        const outcome = Math.random() < 0.8 ? "done" : "missed";
        events.push({
          cue_id: cue.id,
          scheduled_for: when.toISOString(),
          occurred_at: when.toISOString(),
          outcome,
        });
      }
    }
    if (events.length) await admin.from("cue_events").insert(events);
  }

  // 7. Training content (idempotent-ish: only insert if title missing)
  const trainingSeeds = [
    {
      title: "Easing afternoon agitation",
      symptom_tag: "agitation",
      body: "When a loved one becomes restless in the late afternoon, familiar music and a calm voice can help reorient them.",
      video_url: "https://www.youtube.com/watch?v=demo-agitation",
      source_attribution: "Alzheimer's Association",
      action_card_text: "Try playing her favorite music and lowering the lights.",
    },
    {
      title: "Better sleep routines",
      symptom_tag: "sleep",
      body: "Consistent wind-down rituals can reduce nighttime waking.",
      video_url: "https://www.youtube.com/watch?v=demo-sleep",
      source_attribution: "Alzheimer's Association",
      action_card_text: "Keep a consistent bedtime and dim lights an hour before.",
    },
    {
      title: "When the room feels too busy",
      symptom_tag: "overstimulation",
      body: "Crowded or loud environments can overwhelm. Step somewhere quieter.",
      video_url: "https://www.youtube.com/watch?v=demo-overstim",
      source_attribution: "Alzheimer's Association",
      action_card_text: "Move to a quieter room and reduce background noise.",
    },
  ];
  for (const t of trainingSeeds) {
    const { data: existing } = await admin
      .from("training_content")
      .select("id")
      .eq("title", t.title)
      .maybeSingle();
    if (!existing) {
      await admin.from("training_content").insert({ ...t, language: "en" });
    }
  }

  // 8. Recompute fingerprint so insight surfaces
  try {
    await recomputeFingerprintInline(admin, primaryUserId);
  } catch (e) {
    // non-fatal
  }

  return { householdId };
}