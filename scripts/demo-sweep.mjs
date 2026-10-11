// node scripts/demo-sweep.mjs  — visits all demo routes (EN/ES x 3 viewports): console errors, failed requests, overflow.
import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const ROUTES = ["/", "/demo", "/demo/patient", "/demo/caregiver", "/demo/logs"];
const SIZES = { desktop: [1440, 900], tablet: [820, 1180], phone: [390, 844] };
const IGNORE = /DevTools|deprecated|favicon/i;
const browser = await chromium.launch();
let problems = 0;
for (const lang of ["en", "es"]) {
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((l) => { try { localStorage.setItem("companion.lang", l); } catch {} }, lang);
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error" && !IGNORE.test(m.text())) errs.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 160)));
    page.on("requestfailed", (r) => { if (!/soundhelix|youtube|googleusercontent|ytimg/.test(r.url())) errs.push("REQFAIL " + r.url().slice(0, 100)); });
    page.on("response", (r) => { if (r.status() >= 400 && !/soundhelix|youtube|ytimg/.test(r.url())) errs.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`); });
    for (const route of ROUTES) {
      errs.length = 0;
      await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(1200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      const bad = overflow || errs.length;
      if (bad) problems++;
      console.log(`${lang} ${size.padEnd(7)} ${route.padEnd(16)} ${overflow ? "OVERFLOW " : ""}${errs.length ? errs.join(" | ") : bad ? "" : "ok"}`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems ? `${problems} route/size combos with problems` : "ALL CLEAN");
