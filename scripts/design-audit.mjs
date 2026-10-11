// node scripts/design-audit.mjs [outdir]
// Visits demo + real-mode screens (EN/ES x desktop/tablet/phone, plus forced evening in real mode),
// takes screenshots, and flags: console errors, horizontal overflow, text under 4.5:1 (3:1 large),
// and saturated colours that are not terracotta or the destructive red.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = process.argv[2] ?? "/tmp/design-audit";
const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const SIZES = { desktop: [1440, 900], tablet: [820, 1180], phone: [390, 844] };
const LANGS = (process.env.LANGS ?? "en,es").split(",");
const ONLY_SIZE = process.env.SIZE;
const SHOTS = process.env.SHOTS !== "0";
await mkdir(OUT, { recursive: true });

const IGNORE = /DevTools|deprecated|favicon|soundhelix|youtube|ytimg|googleusercontent/i;

/** Runs in the page: contrast + hue audit of all visible text and filled boxes. */
function pageAudit() {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; const d = mx - mn; if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return { h, s, l }; };
  const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none" && !/^none$/.test(cs.backgroundImage)) return { photo: true };
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 252, g: 250, b: 247, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base);
    return base;
  };
  const out = { low: [], hues: [] };
  const seenLow = new Set(), seenHue = new Set();
  const warm = (c) => { const { h, s, l } = hsl(c); if (s < 0.28 || l > 0.9 || l < 0.1) return true; return (h <= 25 || h >= 345 || (h >= 20 && h <= 40 && l > 0.6)) ; };
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    const label = () => (el.tagName.toLowerCase() + "." + String(el.className).split(" ").slice(0, 3).join(".") + " “" + (el.textContent || "").trim().slice(0, 30) + "”");
    const bg = bgOf(el);
    const overPhoto = !!(el.closest("[data-mode=patient]") && document.querySelector(".patient-photo-bg,[data-mode=patient] img")) || (parse(cs.color)?.r === 255 && parse(cs.color)?.g === 255 && !!el.closest(".relative")?.querySelector("img"));
    const whiteOnOverlay = parse(cs.color)?.r === 255 && parse(cs.color)?.g === 255 && (() => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0 && c.a < 1) return true; } return false; })();
    if (hasText && !bg.photo && !overPhoto && !whiteOnOverlay && !el.closest(".ask-fab,[aria-label=Ask],[aria-label=Preguntar]")) {
      let fg = parse(cs.color);
      if (fg) {
        fg = blend({ ...fg, a: fg.a * (+cs.opacity || 1) }, bg);
        const size = parseFloat(cs.fontSize), weight = +cs.fontWeight;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const cr = ratio(fg, bg);
        const need = large ? 3 : 4.5;
        const disabled = el.closest(":disabled,[aria-disabled=true]");
        if (cr < need && !disabled) { const k = label() + cr.toFixed(1); if (!seenLow.has(k)) { seenLow.add(k); out.low.push(`${cr.toFixed(2)}:1 ${label()}`); } }
        if (!warm(fg)) { const k = "t" + label(); if (!seenHue.has(k)) { seenHue.add(k); out.hues.push(`text ${cs.color} ${label()}`); } }
      }
    }
    const own = parse(cs.backgroundColor);
    if (own && own.a > 0.5 && cs.backgroundImage === "none" && !warm(own)) { const k = "b" + label(); if (!seenHue.has(k)) { seenHue.add(k); out.hues.push(`bg ${cs.backgroundColor} ${label()}`); } }
  }
  return out;
}

async function visit(page, tag, issues) {
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const a = await page.evaluate(pageAudit);
  if (overflow) issues.push(`${tag}: HORIZONTAL OVERFLOW`);
  for (const l of a.low) issues.push(`${tag}: LOW CONTRAST ${l}`);
  for (const h of a.hues) issues.push(`${tag}: OFF-PALETTE ${h}`);
  if (SHOTS) await page.screenshot({ path: `${OUT}/${tag.replace(/[^a-z0-9._-]+/gi, "_")}.png` });
}

const browser = await chromium.launch();
const issues = [];
const consoleErrs = [];
const sizes = Object.entries(SIZES).filter(([n]) => !ONLY_SIZE || n === ONLY_SIZE);

for (const lang of LANGS) {
  for (const [size, [w, h]] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((l) => { try { localStorage.setItem("companion.lang", l); } catch {} }, lang);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) consoleErrs.push(`${lang}/${size}: ${m.text().slice(0, 140)}`); });
    page.on("pageerror", (e) => consoleErrs.push(`${lang}/${size}: PAGEERROR ${e.message.slice(0, 140)}`));

    // ---- demo ----
    for (const route of ["/", "/demo"]) { await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => {}); await visit(page, `${lang}-${size}-demo${route.replace(/\//g, "-")}`, issues); }

    await page.goto(BASE + "/demo/patient", { waitUntil: "networkidle" }).catch(() => {});
    await visit(page, `${lang}-${size}-demo-patient-home`, issues);
    const pButtons = await page.locator("main button:visible, [data-mode=patient] button:visible").evaluateAll((els) => els.map((e) => (e.textContent || "").trim().slice(0, 24)));
    for (const [i, key] of ["talk|hablar|conversar", "photo|foto", "music|música|musica", "remind|recordat", "log|registr|how|cómo|como", "help|ayuda"].entries()) {
      await page.goto(BASE + "/demo/patient", { waitUntil: "networkidle" }).catch(() => {});
      const btn = page.locator("button:visible", { hasText: new RegExp(key, "i") }).first();
      if (await btn.count()) { await btn.click().catch(() => {}); await visit(page, `${lang}-${size}-demo-patient-${i}-${key.split("|")[0]}`, issues); }
    }

    await page.goto(BASE + "/demo/caregiver", { waitUntil: "networkidle" }).catch(() => {});
    await visit(page, `${lang}-${size}-demo-caregiver-home`, issues);
    const navCount = await page.locator("nav[aria-label=primary]:visible button, aside[aria-label=primary]:visible button, nav[aria-label=primary]:visible a").count();
    const tabs = page.locator("aside:visible ul button, nav[aria-label=primary]:visible ul button");
    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click().catch(() => {});
      await visit(page, `${lang}-${size}-demo-caregiver-tab${i}`, issues);
    }
    await page.goto(BASE + "/demo/logs", { waitUntil: "networkidle" }).catch(() => {});
    await visit(page, `${lang}-${size}-demo-logs`, issues);

    // ---- real mode (signed in), day and forced evening (Date shifted, so AppShell sees 9:15 PM) ----
    if (process.env.REAL !== "0") {
      for (const mode of ["day", "night"]) {
        const rctx = await browser.newContext({ viewport: { width: w, height: h } });
        await rctx.addInitScript(([l, m]) => {
          try { localStorage.setItem("companion.lang", l); } catch {}
          const R = Date, target = new R(); target.setHours(m === "night" ? 21 : 11, 15, 0, 0);
          const off = target.getTime() - R.now();
          class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }
          globalThis.Date = D;
        }, [lang, mode]);
        const rp = await rctx.newPage();
        rp.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) consoleErrs.push(`${lang}/${size}/${mode}: ${m.text().slice(0, 140)}`); });
        rp.on("pageerror", (e) => consoleErrs.push(`${lang}/${size}/${mode}: PAGEERROR ${e.message.slice(0, 140)}`));
        await rp.goto(BASE + "/auth", { waitUntil: "networkidle" }).catch(() => {});
        if (mode === "day") await visit(rp, `${lang}-${size}-auth`, issues);
        await rp.fill("input[type=email]", "newcaregiver@example.com");
        await rp.fill("input[type=password]", "CareTest#2026");
        await rp.click("button[type=submit]");
        await rp.waitForURL(/today|patient|onboarding/, { timeout: 30000 }).catch(() => issues.push(`${lang}-${size}: sign-in did not complete (${rp.url()})`));
        for (const route of ["/today", "/photos", "/learn", "/circle", "/summary", "/settings", "/patient"]) {
          await rp.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => {});
          await rp.waitForTimeout(1200);
          await visit(rp, `${lang}-${size}-real-${mode}${route.replace(/\//g, "-")}`, issues);
        }
        await rp.goto(BASE + "/today", { waitUntil: "networkidle" }).catch(() => {});
        const ask = rp.locator("button[aria-label=Ask], button[aria-label=Preguntar]").first();
        if (await ask.count()) { await ask.click().catch(() => {}); await visit(rp, `${lang}-${size}-real-${mode}-ask`, issues); }
        await rctx.close();
      }
    }
    await ctx.close();
  }
}
await browser.close();
const uniq = [...new Set(issues)];
console.log(uniq.join("\n"));
console.log("--- console errors ---");
console.log([...new Set(consoleErrs)].join("\n") || "none");
console.log(`\n${uniq.length} audit findings, ${new Set(consoleErrs).size} console errors. Screenshots: ${OUT}`);
