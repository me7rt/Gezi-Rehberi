// Play Store tanıtım filmi (1920x1080, ~85 sn). Kullanım: BASE=https://... node .github/tanitim.mjs
// Sahne: solda başlık ve açıklama, sağda telefon çerçevesi içinde gerçek uygulama.
// Kareler CDP ekran yayınıyla toplanır, ffmpeg ile H.264 mp4 yapılır (Playwright'ın kendi videosundan daha net).
import { chromium } from "playwright";
import fs from "fs";
import { execFileSync } from "child_process";
const BASE = process.env.BASE || "https://me7rt.github.io/Rota-Cepte/";
const DIL = process.env.DIL || "tr";
const OUT = "tanitim"; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + "/kare", { recursive: true });

const b = await chromium.launch({ args: ["--disable-site-isolation-trials", "--disable-features=IsolateOrigins,site-per-process"] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: DIL === "en" ? "en-US" : "tr-TR" });
const p = await ctx.newPage();
const bekle = (ms) => p.waitForTimeout(ms);

// örnek "gittim" verisi (Gezi haritası dolu görünsün)
const idx = await (await fetch(BASE + "data/index.json")).json();
const sec = { istanbul: 12, nevsehir: 8, izmir: 6, antalya: 6, balikesir: 4, ankara: 5, mardin: 4, trabzon: 3, denizli: 3, mugla: 4, canakkale: 3, bursa: 3, konya: 3, rize: 2 };
const git = [];
for (const [s, n] of Object.entries(sec)) {
  const d = await (await fetch(`${BASE}data/il/${s}.json?v=${idx.surum}`)).json();
  const goruldu = new Set();
  for (const y of d.yerler) { if (git.filter((x) => x.s === s).length >= n) break; if (goruldu.has(y.i) && Math.random() < 0.6) continue; goruldu.add(y.i); git.push({ q: y.q, s, ad: y.ad, il: d.ad, k: y.k, f: y.f, t: Date.now() }); }
}
await ctx.addInitScript(([g, dil]) => {
  if (location.href.startsWith("about:")) return;
  localStorage.setItem("gezi-tanitim", "1"); localStorage.setItem("gezi-konum-kapali", "1");
  localStorage.setItem("gezi-gittim", g); localStorage.setItem("gezi-puan", JSON.stringify({ bitti: 1 }));
  localStorage.setItem("gezi-dil", dil);
}, [JSON.stringify(git), DIL]);

const EN = DIL === "en";
const t = (tr, en) => (EN ? en : tr);
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800;900&display=swap');
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#fff;
 background:radial-gradient(1200px 800px at 15% 20%,#2a5bd7 0%,transparent 60%),radial-gradient(900px 700px at 90% 90%,#13707a 0%,transparent 60%),#0b1730}
.logo{position:absolute;left:120px;top:90px;display:flex;align-items:center;gap:18px;font-weight:900;font-size:34px;letter-spacing:.5px}
.logo img{width:64px;height:64px;border-radius:16px;box-shadow:0 6px 20px rgba(0,0,0,.35)}
.yazi{position:absolute;left:120px;top:0;bottom:0;width:900px;display:flex;flex-direction:column;justify-content:center}
.yazi h1{font-size:84px;line-height:1.05;font-weight:900;letter-spacing:-1.5px}
.yazi p{font-size:36px;line-height:1.35;color:#cfe0ff;margin-top:26px;font-weight:500}
.yazi .gir{animation:gir .7s cubic-bezier(.2,.9,.3,1) both}
.yazi p.gir{animation-delay:.12s}
@keyframes gir{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
.tel{position:absolute;right:220px;top:50%;transform:translateY(-50%);width:476px;height:1000px;border-radius:64px;background:#05070c;padding:18px;
 box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 3px #2b3446 inset}
.tel iframe{width:440px;height:964px;border:0;border-radius:48px;background:#fff;display:block}
.son{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:inherit}
.son.ac{display:flex;animation:gir .8s both}
.son img{width:200px;height:200px;border-radius:46px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.son h2{font-size:110px;font-weight:900;margin-top:40px;letter-spacing:-2px}
.son p{font-size:44px;color:#cfe0ff;margin-top:12px}
.son .rozet{margin-top:44px;font-size:32px;font-weight:800;background:#fff;color:#0b1730;padding:18px 40px;border-radius:999px}
</style></head><body>
<div class="logo"><img src="${BASE}icon-192.png">Rota Cepte</div>
<div class="yazi" id="yazi"></div>
<div class="tel"><iframe id="app" src="${BASE}"></iframe></div>
<div class="son" id="son"><img src="${BASE}icon-512.png"><h2>Rota Cepte</h2><p>${t("Yol senin, rotan cepte!", "The road is yours, the route is in your pocket!")}</p><div class="rozet">${t("Ücretsiz · Reklamsız · Google Play'de", "Free · No ads · On Google Play")}</div></div>
</body></html>`);
const yaz = (h, s) => p.evaluate(([h, s]) => { document.getElementById("yazi").innerHTML = `<h1 class="gir">${h}</h1><p class="gir">${s}</p>`; }, [h, s]);
const app = () => p.frames().find((f) => f.url().startsWith(BASE));
const A = (fn, arg) => app().evaluate(fn, arg);
const resimler = () => A(async () => { await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))); });
const kay = async (y, sure) => { await A(([y, s]) => { document.documentElement.style.scrollBehavior = "auto"; const b = scrollY, f = y - b, t0 = performance.now(); return new Promise((r) => { const ad = () => { const k = Math.min(1, (performance.now() - t0) / s), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; scrollTo(0, b + f * e); k < 1 ? requestAnimationFrame(ad) : r(); }; ad(); }); }, [y, sure]); };
const kayEl = async (sel, sure, ust = 70) => { const y = await A(([s, u]) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY - u : scrollY; }, [sel, ust]); await kay(y, sure); };
const kayDetay = (y, sure) => A(([y, s]) => { const el = document.querySelector("#sheet .sheet-body, #sheet [class*=body], #sheet"); const sc = [el, ...el.querySelectorAll("*")].find((x) => x.scrollHeight > x.clientHeight + 20 && getComputedStyle(x).overflowY !== "visible") || el; const b = sc.scrollTop, t0 = performance.now(); return new Promise((r) => { const ad = () => { const k = Math.min(1, (performance.now() - t0) / s), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; sc.scrollTop = b + y * e; k < 1 ? requestAnimationFrame(ad) : r(); }; ad(); }); }, [y, sure]);
// dokunma: parmak izi halkası göster, sonra tıkla
const dokun = async (sel) => {
  await A((s) => {
    const e = document.querySelector(s); if (!e) return;
    e.scrollIntoView({ block: "center" });
    const r = e.getBoundingClientRect(), d = document.createElement("div");
    d.style.cssText = `position:fixed;z-index:99999;left:${r.left + r.width / 2 - 28}px;top:${r.top + r.height / 2 - 28}px;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(31,79,163,.8);pointer-events:none;transition:transform .5s,opacity .5s`;
    document.body.appendChild(d); setTimeout(() => { d.style.transform = "scale(1.6)"; d.style.opacity = "0"; }, 350); setTimeout(() => d.remove(), 900);
  }, sel);
  await bekle(450);
  await app().click(sel);
};
const git2 = (h) => A((h) => { location.hash = h; }, h);

// ilk yükleme (servis çalışanı kurulsun), sonra baştan aç: açılış ekranı filmin girişi olur
await bekle(9000);
await A(() => location.reload());
await bekle(300);

// ---- kayıt başlıyor ----
const cdp = await ctx.newCDPSession(p);
const kareler = [];
cdp.on("Page.screencastFrame", async (f) => {
  const n = kareler.length; fs.writeFileSync(`${OUT}/kare/${String(n).padStart(5, "0")}.jpg`, Buffer.from(f.data, "base64"));
  kareler.push(f.metadata.timestamp);
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
// ekran değişmeyince kare gelmez; sahnede hep çok hafif hareket olsun diye görünmez bir sayaç döndür
await p.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "position:absolute;right:0;bottom:0;width:2px;height:2px;opacity:.01"; document.body.appendChild(d); let i = 0; setInterval(() => { d.style.background = i++ % 2 ? "#0b1730" : "#0b1731"; }, 33); });

// 1) açılış
await yaz(t("Türkiye cebinde.", "Türkiye in your pocket."), t("81 il, 958 ilçe, 2.400'den fazla gezilecek yer. Hepsi tek uygulamada.", "81 provinces, 958 districts and 2,400+ places to visit, all in one app."));
await bekle(7000);
// 2) ana sayfa
await yaz(t("Nereye gidiyorsun?", "Where are you going?"), t("İl, ilçe ya da yer ara. Konumunu açarsan en yakın yerleri sıralarız.", "Search any province, district or place. Turn on location to see what's nearby."));
await resimler(); await bekle(2500);
await kayEl(".kesfet", 1800); await bekle(1200);
// 3) mevsim + keşfet
await yaz(t("Mevsime göre öneriler", "Seasonal picks"), t("Şelaleler, göller, kaleler, mağaralar… Türkiye genelinde keşif listeleri.", "Waterfalls, lakes, castles, caves… curated lists across Türkiye."));
await bekle(2200);
await dokun("#mevsim .tchip"); await bekle(2600);
await kay(500, 2200); await bekle(800);
// 4) il sayfası
await yaz(t("Her ilin en güzel yerleri", "The best of every province"), t("Fotoğraflar, bilgiler, hava durumu ve yöresel lezzetler.", "Photos, stories, weather and local food."));
await git2("#/il/nevsehir"); await bekle(2000); await resimler(); await bekle(1800);
await kayEl("#heroFacts", 1800); await bekle(1600);
await kayEl("#yemek", 1600); await bekle(1400);
// 5) 1 günlük plan
await yaz(t("Tek dokunuşla 1 günlük plan", "A one-day plan in one tap"), t("Birbirine yakın 5 durak, öğle arası önerisi ve hazır Google Maps rotası.", "Five nearby stops, a lunch tip and a ready Google Maps route."));
await kayEl("#plan", 1800, 20); await resimler(); await bekle(3500);
await dokun("#planYeni"); await resimler(); await bekle(3000);
// 6) yer ayrıntısı
await yaz(t("Gitmeden önce her şeyi gör", "See it before you go"), t("Fotoğraf, kısa bilgi, sesli anlatım ve yol tarifi tek ekranda.", "Photo, short story, audio guide and directions on one screen."));
await kayEl("#tabs", 1500); await bekle(600);
await dokun("#list .row"); await bekle(1500); await resimler(); await bekle(2500);
await kayDetay(520, 2600); await bekle(2200);
await A(() => { const c = document.getElementById("dClose"); if (c) c.click(); }); await bekle(900);
// 7) hazır rotalar
await yaz(t("14 hazır gezi rotası", "14 ready-made routes"), t("Kapadokya, İstanbul, Efes, Likya, Karadeniz… Durakları sırayla gez.", "Cappadocia, Istanbul, Ephesus, the Lycian coast… stop by stop."));
await git2("#/rota/kapadokya"); await bekle(1500); await resimler(); await bekle(3500);
await kay(400, 1800); await bekle(1500);
// 8) gezi haritası ve rozetler
await yaz(t("Gezdiğin illeri boya", "Colour in your travels"), t("Gittiğin yerleri işaretle, Türkiye haritan dolsun, rozetleri topla.", "Mark the places you've been, fill your Türkiye map and collect badges."));
await git2("#/"); await bekle(2500); await resimler(); await bekle(800);
await kayEl("#gezSec", 1800); await bekle(3500);
await git2("#/rozetler"); await bekle(1500); await bekle(3000);
// 9) internetsiz
await yaz(t("Çekmeyen yerde bile", "Even with no signal"), t("İli telefonuna indir, dağda bayırda internetsiz aç.", "Download a province and use it offline in the mountains."));
await git2("#/il/antalya"); await bekle(2000); await resimler(); await bekle(1000);
// iframe içinde servis çalışanı devreye girmezse buton gizli kalır; filmde yine de görünsün
await A(() => { const s = document.getElementById("indirSec"), b = document.getElementById("indirBtn"); if (s.hidden) { s.hidden = false; b.innerHTML = window.DIL === "en" ? "<b>📥 Use offline</b><small>Save this province's places and photos to your phone</small>" : "<b>📥 İnternetsiz kullan</b><small>Bu ilin yerlerini ve fotoğraflarını telefona indir, çekmeyen yerde de aç</small>"; } });
await kayEl("#indirSec", 1400, 260); await bekle(1200);
await dokun("#indirBtn"); await bekle(5000);
// 10) kapanış
await p.evaluate(() => { document.getElementById("son").classList.add("ac"); });
await bekle(6500);

await cdp.send("Page.stopScreencast");
await b.close();

// kareleri süreleriyle birleştir
const satir = [];
for (let i = 0; i < kareler.length; i++) {
  const sure = i + 1 < kareler.length ? Math.max(0.001, kareler[i + 1] - kareler[i]) : 0.5;
  satir.push(`file 'kare/${String(i).padStart(5, "0")}.jpg'`, `duration ${sure.toFixed(4)}`);
}
satir.push(`file 'kare/${String(kareler.length - 1).padStart(5, "0")}.jpg'`);
fs.writeFileSync(`${OUT}/liste.txt`, satir.join("\n"));
const ad = EN ? "rota-cepte-tanitim-en.mp4" : "rota-cepte-tanitim.mp4";
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${OUT}/liste.txt`, "-vf", "fps=30,scale=1920:1080,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", `${OUT}/${ad}`]);
console.log("bitti", kareler.length, "kare", ((kareler.at(-1) - kareler[0]) | 0) + " sn");
