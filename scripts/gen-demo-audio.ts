// node --env-file=.env --import tsx scripts/gen-demo-audio.ts
// Pre-generates the demo's safety-net audio (greeting + every canned reply, EN/ES) in the demo voice
// (ELEVENLABS_VOICE_ID). Re-run whenever the demo voice or the canned lines change.
import { mkdir, writeFile } from "node:fs/promises";
import { synthesize } from "../src/lib/elevenlabs.server";
import { CANNED } from "../src/lib/demo/rosa-canned";
import { DEMO_GREETING } from "../src/lib/demo/rosa-facts";
import { REMINDER_LINES, reminderSpoken } from "../src/lib/demo/reminder-text";

const voiceId = process.env.ELEVENLABS_VOICE_ID;
if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set");
await mkdir("public/demo-audio", { recursive: true });

const jobs: { file: string; text: string }[] = [];
for (const lang of ["en", "es"] as const) {
  jobs.push({ file: `greeting.${lang}.mp3`, text: DEMO_GREETING[lang] });
  for (const c of CANNED) jobs.push({ file: `${c.id}.${lang}.mp3`, text: c[lang] });
  for (const r of REMINDER_LINES) jobs.push({ file: `reminder-${r.id}.${lang}.mp3`, text: reminderSpoken(r, lang) });
}
// ONLY=reminder (or any file-name prefix) regenerates just the matching files.
const only = process.env.ONLY;
if (only) for (let i = jobs.length - 1; i >= 0; i--) if (!jobs[i].file.startsWith(only)) jobs.splice(i, 1);
for (const j of jobs) {
  const b64 = await synthesize(voiceId, j.text);
  await writeFile(`public/demo-audio/${j.file}`, Buffer.from(b64, "base64"));
  console.log("wrote", j.file, `(${Math.round((b64.length * 3) / 4 / 1024)} KB)`);
}
process.exit(0);
