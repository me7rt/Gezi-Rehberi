// Mağaza ekran görüntüleri (1080x1920). Kullanım: BASE=https://... node .github/ekran.mjs
import { chromium } from "playwright";
import fs from "fs";
const BASE = process.env.BASE || "https://me7rt.github.io/Rota-Cepte/";
const OUT = "ekran"; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: "tr-TR", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const bekle = (ms) => p.waitForTimeout(ms);
const resimler = async () => { await p.evaluate(async () => { await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000); }))); }); await bekle(800); };
const cek = async (ad) => { await resimler(); await p.screenshot({ path: `${OUT}/${ad}.png` }); console.log("çekildi", ad); };

// örnek "gittim" verisi: birkaç ilden farklı ilçelerdeki yerler
const idx = await (await fetch(BASE + "data/index.json")).json();
const sec = { istanbul: 12, nevsehir: 8, izmir: 6, antalya: 6, balikesir: 4, ankara: 5, mardin: 4, trabzon: 3, denizli: 3, mugla: 4, canakkale: 3, bursa: 3 };
const git = [];
for (const [s, n] of Object.entries(sec)) {
  const d = await (await fetch(`${BASE}data/il/${s}.json?v=${idx.surum}`)).json();
  const goruldu = new Set();
  for (const y of d.yerler) { if (git.filter((x) => x.s === s).length >= n) break; if (goruldu.has(y.i) && Math.random() < 0.6) continue; goruldu.add(y.i); git.push({ q: y.q, s, ad: y.ad, il: d.ad, k: y.k, f: y.f }); }
}
await p.addInitScript((g) => { localStorage.setItem("gezi-tanitim", "1"); localStorage.setItem("gezi-konum-kapali", "1"); localStorage.setItem("gezi-gittim", g); }, JSON.stringify(git));

// 1 açılış
await p.goto(BASE); await bekle(3200); await p.screenshot({ path: `${OUT}/0-acilis.png` });
await bekle(4500);
await cek("1-ana");
await p.evaluate(() => document.getElementById("rotaSec").scrollIntoView({ block: "start" })); await p.evaluate(() => scrollBy(0, -70)); await cek("2-rotalar");
await p.evaluate(() => document.getElementById("gezSec").scrollIntoView({ block: "start" })); await p.evaluate(() => scrollBy(0, -70)); await cek("3-harita");
await p.evaluate(() => { location.hash = "#/rozetler"; }); await bekle(1500); await cek("4-rozetler");
await p.evaluate(() => { location.hash = "#/il/nevsehir"; }); await bekle(3000); await cek("5-il");
await p.evaluate(() => { location.hash = "#/il/istanbul"; }); await bekle(3000);
await p.click("#list .row"); await bekle(3500); await cek("6-yer");
await p.evaluate(() => { location.hash = "#/rota/kapadokya"; }); await bekle(2500); await cek("7-rota");
await p.evaluate(() => { location.hash = "#/tema/selale"; }); await bekle(2500); await cek("8-tema");
await b.close();
