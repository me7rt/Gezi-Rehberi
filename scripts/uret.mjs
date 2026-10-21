// 81 il, ilçeler ve gezilecek yerlerin verisini Wikidata + Vikipedi + Commons'tan hazırlar.
// GitHub Actions'ta çalışır. Çıktı: docs/data/ (uygulama okur) ve kontrol/ (fotoğraf kontrolü için).
import fs from "node:fs";

const UA = "GeziRehberi/1.0 (https://github.com/me7rt/Gezi-Rehberi; veri hazirlama betigi)";
const OUT = "docs/data";
const KONTROL = "kontrol";
const SURUM = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const okuJSON = (p, d) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d);

// Elle düzeltmeler: kontrol sırasında bulunan kötü fotoğraflar vb.
const DUZ = okuJSON("data/foto-duzelt.json", {});
const YASAK = new Set((DUZ.yasak || []).map((s) => s.replace(/_/g, " ")));
const ZORLA = DUZ.zorla || {};
const CIKAR = new Set(DUZ.cikar || []);
const SECKIN = okuJSON("data/yerler-ham.json", {});
const IPUCU = okuJSON("data/ipuclari.json", {});

// ---------- Sınıflar ----------
// c: çarşı, t: tarihi, m: müze, d: doğa, s: şehir. Puan yüksek olan kategori kazanır.
const SINIF = {
  c: "Q219760 Q829896 Q97495053 Q132510 Q330284 Q11707 Q30022",
  t: "Q32815 Q839954 Q16970 Q15661340 Q23413 Q57831 Q4989906 Q838159 Q522124 Q44613 Q71974 Q28077 Q186347 Q1454820 Q12280 Q853854 Q132834 Q109607 Q2031836 Q34627 Q1081138 Q16560 Q2142647 Q755017 Q1584134 Q3397526 Q158438 Q1088552 Q256020 Q1620908 Q1223230 Q162875 Q17715832 Q833913 Q14752696 Q93429857 Q1802963 Q93342462 Q57346 Q2977 Q1930585 Q12810851 Q474 Q22022298 Q1521433 Q53060 Q57821 Q170980 Q136126382 Q381885 Q1708422 Q56055312 Q92275707 Q64732764 Q1348073 Q1785071 Q867143 Q838858 Q1404229 Q483453 Q18449828 Q1241568 Q5003624 Q12825271 Q44539 Q108325 Q160742 Q1128397 Q15243209 Q12518",
  tz: "Q35112127 Q811979 Q2434238 Q210272 Q811165 Q24398318",
  m: "Q33506 Q3329412 Q2087181 Q207694 Q614316 Q12104174 Q17431399 Q756102 Q18704634 Q16735822 Q2772772 Q866133 Q2327632 Q2310465 Q26958661 Q24699794 Q1007870 Q588140 Q1595639 Q10624527 Q57660343 Q1970365 Q15206070",
  d: "Q23397 Q8502 Q108060572 Q23442 Q108060568 Q34038 Q39594 Q35509 Q2232001 Q108060573 Q473972 Q34763 Q8072 Q169358 Q150784 Q40080 Q863974 Q185113 Q24529780 Q8050526 Q131681 Q207524 Q1402592 Q4421 Q54050 Q1065592 Q46169 Q179049 Q167346 Q187223 Q170321 Q39816",
  s: "Q174782 Q79007 Q7543083 Q54114 Q22698 Q22746 Q11166728 Q39715 Q153562 Q1060829 Q24354 Q1329623 Q43501 Q194195 Q179700 Q860861 Q9325291 Q1254933 Q12570 Q65045238 Q7814330 Q1576693 Q1107656 Q2983893 Q123705",
};
const PUAN = { c: 5, t: 4, m: 3, tz: 2, d: 1, s: 0 };
const SINIF_KAT = new Map();
for (const [k, list] of Object.entries(SINIF)) for (const q of list.split(/\s+/)) if (!SINIF_KAT.has(q) || PUAN[k] > PUAN[SINIF_KAT.get(q)]) SINIF_KAT.set(q, k);
const TUM_SINIF = [...SINIF_KAT.keys()].map((q) => "wd:" + q).join(" ");
function kategori(siniflar) {
  let best = null;
  for (const c of siniflar) { const k = SINIF_KAT.get(c); if (k && (best === null || PUAN[k] > PUAN[best])) best = k; }
  return best === "tz" ? "t" : best;
}
const YERLESIM = new Set(["Q515", "Q1549591", "Q129676344", "Q48336", "Q1147395", "Q2716259", "Q6024226"]);

// ---------- Fotoğraf dosya adı süzgeci (harita, logo, uydu, tabela vb.) ----------
const KOTU_KELIME = new Set(("map maps harita haritasi haritalari karte carte mapa locator location locmap lokasyon konum relief topo " +
  "topografik topographic topographical landsat sentinel satellite uydu nasa iss modis flag bayrak bayragi logo logosu amblem emblem " +
  "arma armasi seal muhur tabela tabelasi sign signs signboard levha plan plani kroki diagram sema chart grafik svg stamp coin banknote " +
  "portrait portre scheme layout floorplan sketch drawing cizim illustration engraving gravur painting lithograph postcard kartpostal " +
  "census population administrative idari blank outline coa ilceleri districts position astronaut worldview").split(/\s+/));
const KOTU_PARCA = ["coat of arms", "location map", "harita", "locator", "landsat", "sentinel", "satellit", "lokasyon", "topograf",
  "logo", "emblem", "amblem", "bayrak", "flag", "grundriss", "floor plan", "plan of", "kartpostal", "postcard"];
const ascii = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
function dosyaKotu(name) {
  const n = ascii(name.replace(/\.[A-Za-z0-9]+$/, "")).replace(/_/g, " ");
  if (/\biss\d|\bsts-\d/.test(n)) return true;
  for (const t of n.split(/[^a-z0-9]+/)) if (KOTU_KELIME.has(t)) return true;
  for (const p of KOTU_PARCA) if (n.includes(p)) return true;
  return false;
}

// ---------- Ağ yardımcıları ----------
async function sparql(q, deneme = 0, hizli = false) {
  let r, t;
  try {
    r = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query: q }),
    });
    if (r.ok) return (await r.json()).results.bindings;
    t = (await r.text()).slice(0, 400);
  } catch (e) { t = String(e); }
  if (/TimeoutException|timeout/i.test(t || "") && (hizli || deneme >= 1)) throw Object.assign(new Error("ZAMAN_ASIMI"), { zaman: true });
  if (deneme < 4) { console.log("  SPARQL tekrar", r && r.status, (t || "").slice(0, 120)); await sleep(6000 * (deneme + 1)); return sparql(q, deneme + 1, hizli); }
  throw new Error("SPARQL " + (r && r.status) + " " + t);
}
async function api(host, params, deneme = 0) {
  const body = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  let t;
  try {
    const r = await fetch(`https://${host}/w/api.php`, { method: "POST", headers: { "User-Agent": UA, "Api-User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (r.ok) {
      const j = await r.json();
      if (!j.error) return j;
      t = j.error.code + " " + j.error.info;
    } else t = "HTTP " + r.status;
  } catch (e) { t = String(e); }
  if (deneme < 5) { console.log("  API tekrar", host, t.slice(0, 120)); await sleep(3000 * (deneme + 1)); return api(host, params, deneme + 1); }
  throw new Error(host + " " + t);
}
// Devam (continue) parçalarını birleştirir; sayfaları başlığa göre döndürür, yönlendirme/normalleştirme eşlemesiyle.
async function apiSayfalar(host, params) {
  const pages = new Map(); const esle = new Map();
  let cont = {};
  for (let i = 0; i < 20; i++) {
    const j = await api(host, { ...params, ...cont });
    const q = j.query || {};
    for (const n of q.normalized || []) esle.set(n.from, n.to);
    for (const n of q.redirects || []) esle.set(n.from, n.to);
    for (const p of q.pages || []) {
      const eski = pages.get(p.title) || {};
      for (const [k, v] of Object.entries(p)) {
        if (Array.isArray(v) && Array.isArray(eski[k])) eski[k] = eski[k].concat(v); else if (eski[k] === undefined) eski[k] = v;
      }
      pages.set(p.title, eski);
    }
    if (!j.continue) break;
    cont = j.continue;
  }
  const bul = (t) => { let x = t, g = 0; while (esle.has(x) && g++ < 5) x = esle.get(x); return pages.get(x); };
  return { pages, bul };
}
const parca = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const val = (b, k) => (b[k] ? b[k].value : "");
const qid = (s) => s.replace("http://www.wikidata.org/entity/", "");
const nokta = (s) => { const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(s || ""); return m ? [+(+m[2]).toFixed(5), +(+m[1]).toFixed(5)] : null; };
const dosyaAdi = (u) => (u ? decodeURIComponent(u.split("/Special:FilePath/")[1] || "").replace(/_/g, " ") : "");
const makale = (iri) => (iri ? decodeURIComponent(iri.split("/wiki/")[1] || "").replace(/_/g, " ") : "");
const slug = (s) => s.toLocaleLowerCase("tr").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u").replace(/[âà]/g, "a").replace(/[îì]/g, "i").replace(/[ûù]/g, "u").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const nrm = (s) => slug(s).replace(/-/g, "");
const temizAd = (s) => s.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+(ili|İli|ilçesi|İlçesi)$/u, "").trim();
function mesafe(a, b, c, d) { const R = 6371, r = Math.PI / 180; const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
function tarih(v, p) {
  const m = /^(-?)0*(\d+)-/.exec(v || ""); if (!m) return "";
  const y = +m[2], mo = m[1] === "-" ? "MÖ " : "";
  p = +p || 9;
  if (p >= 9) return mo + y;
  if (p === 8) return mo + Math.floor(y / 10) * 10 + "'ler";
  if (p === 7) return mo + (Math.floor((y - 1) / 100) + 1) + ". yüzyıl";
  if (p === 6) return mo + (Math.floor((y - 1) / 1000) + 1) + ". binyıl";
  return "";
}
function temizMetin(s) {
  if (!s) return "";
  s = s.replace(/\s*\((?:[^()]|\([^()]*\))*?(?:Yunanca|İngilizce|Latince|Ermenice|Rumca|Arapça|Farsça|Kürtçe|Gürcüce|Süryanice|Osmanlıca|Lazca|Zazaca|Bulgarca|telaffuz|okunuşu|dinle|Greek|Armenian|Latin)(?:[^()]|\([^()]*\))*?\)/g, "");
  s = s.replace(/\s*\(\s*\)/g, "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").replace(/\s+([,.;:])/g, "$1").trim();
  if (s.length > 1600) { const cut = s.lastIndexOf(". ", 1600); s = cut > 700 ? s.slice(0, cut + 1) : s.slice(0, 1600) + "…"; }
  return s;
}

const RAPOR = [];
const rapor = (...a) => { const s = a.join(" "); RAPOR.push(s); console.log(s); };
const LBL = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }';

// ---------- 1. İller ----------
rapor("== İller");
const iller = new Map();
for (const b of await sparql(`SELECT ?il ?ilLabel ?coord ?img ?plaka ?trA ?cat ?bas ?basImg ?alan WHERE {
  ?il wdt:P31 wd:Q48336 . FILTER NOT EXISTS { ?il wdt:P576 [] }
  OPTIONAL { ?il wdt:P625 ?coord } OPTIONAL { ?il wdt:P18 ?img } OPTIONAL { ?il wdt:P395 ?plaka }
  OPTIONAL { ?il wdt:P2046 ?alan } OPTIONAL { ?il wdt:P373 ?cat }
  OPTIONAL { ?il wdt:P36 ?bas . OPTIONAL { ?bas wdt:P18 ?basImg } }
  OPTIONAL { ?trA schema:about ?il ; schema:isPartOf <https://tr.wikipedia.org/> }
  ${LBL} }`)) {
  const q = qid(val(b, "il"));
  const o = iller.get(q) || { q, ad: temizAd(val(b, "ilLabel")), imgs: [], basImgs: [], ilceler: [] };
  o.koor ||= nokta(val(b, "coord")); o.plaka ||= val(b, "plaka"); o.alan ||= +val(b, "alan") || 0; o.cat ||= val(b, "cat");
  o.trA ||= makale(val(b, "trA")); o.bas ||= qid(val(b, "bas"));
  for (const [k, a] of [["img", o.imgs], ["basImg", o.basImgs]]) { const f = dosyaAdi(val(b, k)); if (f && !a.includes(f)) a.push(f); }
  iller.set(q, o);
}
const seckinAnahtar = new Map(Object.keys(SECKIN).map((k) => [nrm(k), k]));
for (const il of iller.values()) {
  il.anahtar = seckinAnahtar.get(nrm(il.ad)) || seckinAnahtar.get(nrm(il.ad.replace(/ ili$/i, "")));
  if (il.anahtar) seckinAnahtar.delete(nrm(il.anahtar));
  il.s = slug(il.anahtar || il.ad);
  if (il.anahtar) il.ad = il.anahtar;
}
rapor("il sayısı", iller.size, "| eşleşmeyen seçkin il:", [...seckinAnahtar.values()].join(",") || "yok",
  "| seçkinsiz il:", [...iller.values()].filter((i) => !i.anahtar).map((i) => i.ad).join(",") || "yok");

// ---------- 2. İlçeler ----------
rapor("== İlçeler");
const ilceler = new Map();
for (const b of await sparql(`SELECT ?ilce ?ilceLabel ?trL ?il ?coord ?img ?trA ?cat ?alan WHERE {
  ?ilce p:P31 ?s1 . ?s1 ps:P31 wd:Q1147395 . FILTER NOT EXISTS { ?s1 pq:P582 [] } FILTER NOT EXISTS { ?s1 wikibase:rank wikibase:DeprecatedRank }
  ?ilce p:P131 ?s2 . ?s2 ps:P131 ?il . FILTER NOT EXISTS { ?s2 pq:P582 [] } FILTER NOT EXISTS { ?s2 wikibase:rank wikibase:DeprecatedRank }
  ?il wdt:P31 wd:Q48336 .
  FILTER NOT EXISTS { ?ilce wdt:P576 [] }
  ?ilce wdt:P625 ?coord .
  OPTIONAL { ?trA schema:about ?ilce ; schema:isPartOf <https://tr.wikipedia.org/> }
  OPTIONAL { ?ilce rdfs:label ?trL . FILTER(LANG(?trL) = "tr") }
  OPTIONAL { ?ilce wdt:P18 ?img } OPTIONAL { ?ilce wdt:P2046 ?alan } OPTIONAL { ?ilce wdt:P373 ?cat }
  ${LBL} }`)) {
  const q = qid(val(b, "ilce")); const ilq = qid(val(b, "il"));
  if (!iller.has(ilq)) continue;
  const o = ilceler.get(q) || { q, il: ilq, ad: temizAd(val(b, "ilceLabel")).replace(/\s+[Dd]istrict$/, "").replace(/\s+(ilçesi|İlçesi|Merkez)$/u, ""), imgs: [], puan: (val(b, "trA") ? 2 : 0) + (val(b, "trL") ? 1 : 0) };
  o.koor ||= nokta(val(b, "coord")); o.alan ||= +val(b, "alan") || 0; o.cat ||= val(b, "cat"); o.trA ||= makale(val(b, "trA"));
  const f = dosyaAdi(val(b, "img")); if (f && !o.imgs.includes(f)) o.imgs.push(f);
  ilceler.set(q, o);
}
// Aynı ilde aynı adlı ikinci kayıtları ele
const ilceAd = new Map();
for (const o of [...ilceler.values()].sort((a, b) => b.puan - a.puan)) {
  const k = o.il + "|" + nrm(o.ad);
  if (ilceAd.has(k) || /^Q\d+$/.test(o.ad) || /'(n[ıiuü]n|[ıiuü]n)$/u.test(o.ad)) { ilceler.delete(o.q); continue; }
  ilceAd.set(k, o.q);
}
for (const o of ilceler.values()) iller.get(o.il).ilceler.push(o);
rapor("ilçe sayısı", ilceler.size, "| koordinatsız:", [...ilceler.values()].filter((o) => !o.koor).map((o) => o.ad).join(",") || "yok");
for (const il of iller.values()) if (!il.ilceler.length) rapor("UYARI ilçesiz il", il.ad);

// Nüfus (en güncel tarihli değer)
async function nufusDoldur(nesneler) {
  for (const p of parca(nesneler, 150)) {
    const en = new Map();
    for (const b of await sparql(`SELECT ?x ?n ?t WHERE { VALUES ?x { ${p.map((o) => "wd:" + o.q).join(" ")} } ?x p:P1082 ?st . ?st ps:P1082 ?n . OPTIONAL { ?st pq:P585 ?t } }`)) {
      const q = qid(val(b, "x")), t = val(b, "t") || "0000";
      const e = en.get(q); if (!e || t > e.t) en.set(q, { n: Math.round(+val(b, "n")), t });
    }
    for (const o of p) { const e = en.get(o.q); if (e) { o.nufus = e.n; o.nufusYil = e.t.slice(0, 4) === "0000" ? "" : e.t.slice(0, 4); } }
    await sleep(500);
  }
}
await nufusDoldur([...iller.values()]);
await nufusDoldur([...ilceler.values()]);

// ---------- 3. Yerler: Türkiye geneli, sınıf grupları halinde ----------
const YER_VERI = `?p wdt:P625 ?coord ; wikibase:sitelinks ?sl .
  OPTIONAL { ?p wdt:P18 ?img }
  OPTIONAL { ?trA schema:about ?p ; schema:isPartOf <https://tr.wikipedia.org/> }
  OPTIONAL { ?enA schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }`;
const YER_EK = `OPTIONAL { ?p p:P571/psv:P571 [ wikibase:timeValue ?yil ; wikibase:timePrecision ?yilP ] }
  OPTIONAL { ?p wdt:P2044 ?rakim }
  OPTIONAL { ?p wdt:P1435 wd:Q9259 . BIND(1 AS ?unesco) }
  OPTIONAL { ?p wdt:P373 ?cat }
  ${LBL}`;
const SECIM = "?p ?pLabel ?pDescription ?cls ?coord ?img ?sl ?trA ?enA ?yil ?yilP ?rakim ?unesco ?cat";
function satirlariTopla(rows, harita) {
  for (const b of rows) {
    const q = qid(val(b, "p"));
    const o = harita.get(q) || { q, ad: val(b, "pLabel"), aciklama: val(b, "pDescription"), siniflar: new Set(), imgs: [], ilceler: new Set() };
    if (val(b, "cls")) o.siniflar.add(qid(val(b, "cls")));
    o.koor ||= nokta(val(b, "coord")); o.sl = Math.max(o.sl || 0, +val(b, "sl") || 0);
    o.trA ||= makale(val(b, "trA")); o.enA ||= makale(val(b, "enA")); o.cat ||= val(b, "cat");
    if (!o.yil && val(b, "yil")) o.yil = tarih(val(b, "yil"), val(b, "yilP"));
    if (!o.rakim && val(b, "rakim")) o.rakim = Math.round(+val(b, "rakim"));
    if (val(b, "unesco")) o.unesco = 1;
    const f = dosyaAdi(val(b, "img")); if (f && !o.imgs.includes(f)) o.imgs.push(f);
    harita.set(q, o);
  }
}
rapor("== Yerler");
const HAM = new Map();
async function sinifSorgu(grup) {
  try {
    satirlariTopla(await sparql(`SELECT ${SECIM} WHERE {
      VALUES ?cls { ${grup.map((q) => "wd:" + q).join(" ")} }
      ?p wdt:P31 ?cls ; wdt:P17 wd:Q43 .
      ${YER_VERI}
      FILTER(BOUND(?trA) || BOUND(?enA))
      FILTER NOT EXISTS { ?p wdt:P576 [] }
      ${YER_EK} }`, 0, true), HAM);
  } catch (e) {
    if (!e.zaman || grup.length === 1) { rapor("  UYARI sınıf sorgusu başarısız:", grup.join(","), e.message.slice(0, 100)); return; }
    const y = Math.ceil(grup.length / 2);
    await sinifSorgu(grup.slice(0, y)); await sinifSorgu(grup.slice(y));
  }
  await sleep(500);
}
for (const grup of parca([...SINIF_KAT.keys()], 10)) await sinifSorgu(grup);
rapor("Türkiye geneli aday yer:", HAM.size);

// Her yerin ilini ve ilçesini yukarı doğru (P131 zinciri) bul
async function ataBul(qids) {
  const out = new Map();
  for (const p of parca(qids, 200)) {
    const rows = await sparql(`SELECT ?p ?u WHERE { hint:Query hint:optimizer "None" .
      VALUES ?p { ${p.map((q) => "wd:" + q).join(" ")} }
      ?p wdt:P131* ?u . ?u wdt:P31 ?ut . FILTER(?ut IN (wd:Q1147395, wd:Q48336)) }`);
    for (const b of rows) { const q = qid(val(b, "p")); const s = out.get(q) || new Set(); s.add(qid(val(b, "u"))); out.set(q, s); }
    await sleep(300);
  }
  return out;
}
function enYakinIlce(koor, ilq, sinir) {
  let en = null, d = 1e9;
  for (const z of ilceler.values()) if (z.koor && (!ilq || z.il === ilq)) { const m = mesafe(koor[0], koor[1], z.koor[0], z.koor[1]); if (m < d) { d = m; en = z; } }
  return en && d < sinir ? en : null;
}
function ilIlceAta(o, atalar) {
  const s = atalar || new Set();
  o.ilceler = new Set([...s].filter((q) => ilceler.has(q)));
  let ilq = [...s].find((q) => iller.has(q));
  if (!ilq && o.ilceler.size) ilq = ilceler.get([...o.ilceler][0]).il;
  if (!ilq && o.koor) { const z = enYakinIlce(o.koor, null, 15); if (z) ilq = z.il; }
  return ilq;
}
const ATA = await ataBul([...HAM.keys()]);
for (const il of iller.values()) il.ham = new Map();
let ilsiz = 0;
for (const o of HAM.values()) {
  const ilq = ilIlceAta(o, ATA.get(o.q));
  if (!ilq) { ilsiz++; continue; }
  iller.get(ilq).ham.set(o.q, o);
}
rapor("ili bulunamayan yer:", ilsiz);
for (const il of iller.values()) console.log(`  ${il.ad}: ${il.ham.size} aday`);

// ---------- 4. Seçkin (elle seçilmiş) yerler ----------
rapor("== Seçkin yerler");
const ilQ = new Set(iller.keys()), ilceQ = new Set(ilceler.keys()), basQ = new Set([...iller.values()].map((i) => i.bas).filter(Boolean));
const seckinListe = [];
for (const il of iller.values()) for (const [w, k] of SECKIN[il.anahtar] || []) seckinListe.push({ il, w, k });
const trSayfa = new Map();
for (const p of parca([...new Set(seckinListe.map((x) => x.w))], 50)) {
  const { bul } = await apiSayfalar("tr.wikipedia.org", { action: "query", titles: p.join("|"), redirects: "1", prop: "pageprops|coordinates|pageimages", ppprop: "wikibase_item|disambiguation", piprop: "name", pilimit: "50", colimit: "50" });
  for (const t of p) trSayfa.set(t, bul(t));
}
const seckinQ = [...new Set([...trSayfa.values()].map((s) => s && s.pageprops && s.pageprops.wikibase_item).filter(Boolean))];
const seckinVeri = new Map(); const seckinIl = new Map(); const seckinSinif = new Map();
for (const p of parca(seckinQ, 60)) {
  const rows = await sparql(`SELECT ${SECIM} WHERE { VALUES ?p { ${p.map((q) => "wd:" + q).join(" ")} }
    OPTIONAL { ?p wdt:P31 ?cls } OPTIONAL { ?p wdt:P625 ?coord } OPTIONAL { ?p wikibase:sitelinks ?sl } OPTIONAL { ?p wdt:P18 ?img }
    OPTIONAL { ?trA schema:about ?p ; schema:isPartOf <https://tr.wikipedia.org/> }
    OPTIONAL { ?enA schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }
    ${YER_EK} }`);
  satirlariTopla(rows, seckinVeri);
  for (const b of rows) {
    const q = qid(val(b, "p"));
    if (val(b, "cls")) { const s = seckinSinif.get(q) || new Set(); s.add(qid(val(b, "cls"))); seckinSinif.set(q, s); }
  }
  await sleep(600);
}
const seckinAta = await ataBul(seckinQ);
for (const [q, s] of seckinAta) seckinIl.set(q, new Set([...s].filter((x) => iller.has(x))));
for (const [q, o] of seckinVeri) if (!HAM.has(q)) o.ilceler = new Set([...(seckinAta.get(q) || [])].filter((x) => ilceler.has(x)));
let seckinTamam = 0;
for (const { il, w, k } of seckinListe) {
  const s = trSayfa.get(w);
  const red = (neden) => rapor(`  RED ${il.ad} / ${w}: ${neden}`);
  if (!s || s.missing) { red("Vikipedi'de yok"); continue; }
  if (s.pageprops && s.pageprops.disambiguation !== undefined) { red("anlam ayrımı sayfası"); continue; }
  const q = s.pageprops && s.pageprops.wikibase_item;
  if (!q) { red("Wikidata yok"); continue; }
  if (CIKAR.has(q)) { red("elle çıkarıldı"); continue; }
  if (ilQ.has(q) || ilceQ.has(q) || basQ.has(q)) { red(`il/ilçe/şehir sayfasına düşüyor (${s.title})`); continue; }
  const sin = seckinSinif.get(q) || new Set();
  if ([...sin].some((c) => YERLESIM.has(c))) { red(`şehir sayfası (${s.title})`); continue; }
  const v = il.ham.get(q) || seckinVeri.get(q) || { q, ad: s.title, siniflar: sin, imgs: [], ilceler: new Set() };
  if (!v.koor && s.coordinates && s.coordinates[0]) v.koor = [+s.coordinates[0].lat.toFixed(5), +s.coordinates[0].lon.toFixed(5)];
  if (!v.koor) { red("koordinat yok"); continue; }
  const ils = seckinIl.get(q);
  if (ils && ils.size && !ils.has(il.q)) { red(`başka ilde (${[...ils].map((x) => (iller.get(x) || {}).ad).join(",")})`); continue; }
  if ((!ils || !ils.size) && il.koor && mesafe(il.koor[0], il.koor[1], v.koor[0], v.koor[1]) > 130) { red("il merkezine çok uzak"); continue; }
  if (v.one) { red("aynı yere ikinci kez düşüyor"); continue; }
  const o = v;
  o.one = 1; o.k = k; o.trA ||= s.title; o.trSayfaFoto = s.pageimage ? s.pageimage.replace(/_/g, " ") : "";
  if (IPUCU[w]) o.ip = IPUCU[w];
  if (!o.ad || /^Q\d+$/.test(o.ad)) o.ad = temizAd(s.title);
  o.seckinSira = seckinTamam++;
  il.ham.set(q, o);
}
rapor("seçkin kabul:", seckinTamam, "/", seckinListe.length);

// ---------- 5. Ön eleme ve ilçeye bağlama ----------
for (const il of iller.values()) {
  const liste = [];
  for (const o of il.ham.values()) {
    if (CIKAR.has(o.q) || !o.koor) continue;
    if (!o.ad || /^Q\d+$/.test(o.ad)) continue;
    o.k ||= kategori(o.siniflar);
    if (!o.k) continue;
    if (!o.one) {
      if (!o.imgs.length) continue;
      if (!o.trA && o.sl < 4) continue;
    }
    let ic = [...o.ilceler].find((q) => ilceler.has(q) && ilceler.get(q).il === il.q);
    if (!ic) {
      let enY = null, enD = 1e9;
      for (const d of il.ilceler) if (d.koor) { const m = mesafe(o.koor[0], o.koor[1], d.koor[0], d.koor[1]); if (m < enD) { enD = m; enY = d; } }
      if (enY && enD < 30) ic = enY.q;
    }
    o.ilce = ic || "";
    if (ZORLA[o.q]) o.imgs = [ZORLA[o.q]];
    liste.push(o);
  }
  // İlçe başına sınır (fazlası: ünlülüğe göre ele)
  liste.sort((a, b) => (b.one || 0) - (a.one || 0) || b.sl - a.sl);
  const say = new Map(); const kalan = [];
  for (const o of liste) {
    if (o.one) { kalan.push(o); continue; }
    const key = o.ilce || "-"; const n = say.get(key) || 0;
    if (n >= (o.ilce ? 26 : 32)) continue;
    say.set(key, n + 1); kalan.push(o);
  }
  il.adaylar = kalan;
}

// ---------- 6. Fotoğraf bilgileri (boyut, lisans, yazar) ----------
rapor("== Fotoğraflar");
const FOTO = new Map();
async function fotoBilgi(adlar) {
  const yeni = [...new Set(adlar.filter((a) => a && !FOTO.has(a)))];
  for (const p of parca(yeni, 50)) {
    const { bul } = await apiSayfalar("commons.wikimedia.org", { action: "query", titles: p.map((a) => "File:" + a).join("|"), prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiextmetadatafilter: "Artist|LicenseShortName" });
    for (const a of p) {
      const pg = bul("File:" + a); const ii = pg && pg.imageinfo && pg.imageinfo[0];
      if (!ii) { FOTO.set(a, null); continue; }
      FOTO.set(a, fotoKaydi(a, ii));
    }
  }
}
function fotoKaydi(a, ii) {
  const em = ii.extmetadata || {};
  const yazar = (em.Artist ? em.Artist.value : "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 70);
  const lis = em.LicenseShortName ? em.LicenseShortName.value.replace(/<[^>]+>/g, "").trim() : "";
  const m = /\/wikipedia\/commons\/(.+)$/.exec(ii.url || "");
  return { ad: a, w: ii.width, h: ii.height, mime: ii.mime, p: m ? m[1] : "", a: [yazar, lis].filter(Boolean).join(" · ") };
}
function fotoUygun(a) {
  const f = FOTO.get(a);
  if (!f || !f.p || YASAK.has(a)) return false;
  if (f.mime !== "image/jpeg") return false;
  if (f.w < 500 || f.h < 300) return false;
  const r = f.w / f.h; if (r < 0.5 || r > 3.2) return false;
  return !dosyaKotu(a);
}
const ilkAday = [];
for (const il of iller.values()) {
  ilkAday.push(...il.imgs, ...il.basImgs);
  for (const d of il.ilceler) ilkAday.push(...d.imgs);
  for (const o of il.adaylar) ilkAday.push(...o.imgs, o.trSayfaFoto || "");
}
await fotoBilgi(ilkAday);
rapor("fotoğraf bilgisi alınan dosya:", FOTO.size, "| uygun:", [...FOTO.keys()].filter(fotoUygun).length);

// Commons kategorisinden ya da yakındaki fotoğraflardan yedek bulma
const istenmeyenAd = new Set("ve bir the of in de da ile camii cami kalesi kale müzesi muzesi köprüsü koprusu kilisesi han hanı hamamı türbesi medresesi çeşmesi dağı gölü şelalesi mağarası milli parkı parki tabiat".split(" ").map(ascii));
function adPuan(dosya, ad) {
  const d = ascii(dosya); let p = 0;
  for (const k of ascii(ad).split(/[^a-z0-9]+/)) if (k.length > 3 && !istenmeyenAd.has(k) && d.includes(k)) p += 2;
  return p;
}
async function kategoriFoto(cat, ad) {
  if (!cat) return [];
  const j = await api("commons.wikimedia.org", { action: "query", generator: "categorymembers", gcmtitle: "Category:" + cat, gcmtype: "file", gcmlimit: "60", prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiextmetadatafilter: "Artist|LicenseShortName" });
  const out = [];
  for (const pg of (j.query && j.query.pages) || []) {
    const a = pg.title.replace(/^File:/, ""); const ii = pg.imageinfo && pg.imageinfo[0];
    if (!ii) continue; if (!FOTO.has(a)) FOTO.set(a, fotoKaydi(a, ii));
    if (fotoUygun(a)) { const f = FOTO.get(a); out.push({ a, puan: adPuan(a, ad) + (f.w >= f.h ? 1 : 0) + (f.w >= 1200 ? 1 : 0) }); }
  }
  out.sort((x, y) => y.puan - x.puan);
  return out.map((x) => x.a);
}
async function yakinFoto(lat, lng, ad) {
  const j = await api("commons.wikimedia.org", { action: "query", list: "geosearch", gsnamespace: "6", gscoord: `${lat}|${lng}`, gsradius: "400", gslimit: "30" });
  const adlar = ((j.query && j.query.geosearch) || []).map((g) => g.title.replace(/^File:/, ""));
  await fotoBilgi(adlar);
  const ok = adlar.filter(fotoUygun);
  ok.sort((x, y) => adPuan(y, ad) - adPuan(x, ad));
  return ok;
}

// ---------- 7. Fotoğraf dağıtımı (her yere farklı fotoğraf) ----------
const KULLANILAN = new Set();
const tumYer = [];
for (const il of iller.values()) for (const o of il.adaylar) tumYer.push(o);
tumYer.sort((a, b) => (b.one || 0) - (a.one || 0) || (a.seckinSira ?? 0) - (b.seckinSira ?? 0) || b.sl - a.sl);
let yedekKat = 0, yedekYakin = 0, fotosuzSeckin = 0;
for (const o of tumYer) {
  const adaylar = [...o.imgs, o.trSayfaFoto].filter(Boolean);
  let sec = adaylar.find((a) => fotoUygun(a) && !KULLANILAN.has(a));
  if (sec) o.fotoKaynak = o.imgs.includes(sec) ? "wikidata" : "vikipedi";
  if (!sec && o.one) {
    for (const a of await kategoriFoto(o.cat, o.ad)) if (!KULLANILAN.has(a)) { sec = a; o.fotoKaynak = "kategori"; yedekKat++; break; }
    if (!sec) for (const a of await yakinFoto(o.koor[0], o.koor[1], o.ad)) if (!KULLANILAN.has(a)) { sec = a; o.fotoKaynak = "yakın"; yedekYakin++; break; }
    if (!sec) { fotosuzSeckin++; rapor(`  FOTOSUZ seçkin: ${o.ad} (${o.q})`); }
  }
  if (sec) { o.foto = sec; KULLANILAN.add(sec); }
}
rapor("seçkin yedek foto: kategori", yedekKat, "| yakın", yedekYakin, "| hiç bulunamayan", fotosuzSeckin);

// İl ve ilçe kapak fotoğrafları
for (const il of iller.values()) {
  il.yerler = il.adaylar.filter((o) => o.foto);
  // Son sınır: ilçe başına 20, ilçesiz 25, il başına 320
  const say = new Map(); const son = [];
  for (const o of il.yerler) {
    if (!o.one) { const key = o.ilce || "-"; const n = say.get(key) || 0; if (n >= (o.ilce ? 20 : 25)) continue; say.set(key, n + 1); }
    son.push(o);
  }
  il.yerler = son.slice(0, 320);
  const ilkYer = il.yerler.find((o) => o.one) || il.yerler[0];
  il.foto = [...il.imgs, ...il.basImgs].find(fotoUygun);
  il.fotoKaynak = il.foto ? "wikidata" : "";
  if (!il.foto) { il.foto = (await kategoriFoto(il.cat, il.ad))[0]; il.fotoKaynak = il.foto ? "kategori" : ""; }
  if (!il.foto && ilkYer) { il.foto = ilkYer.foto; il.fotoKaynak = "yer"; }
  for (const d of il.ilceler) {
    d.foto = d.imgs.find(fotoUygun); d.fotoKaynak = d.foto ? "wikidata" : "";
    if (!d.foto && d.cat) { d.foto = (await kategoriFoto(d.cat, d.ad))[0]; d.fotoKaynak = d.foto ? "kategori" : ""; }
    if (!d.foto) { const y = il.yerler.find((o) => o.ilce === d.q); if (y) { d.foto = y.foto; d.fotoKaynak = "yer"; } }
  }
}

// ---------- 8. Metinler ----------
rapor("== Metinler");
async function ozetler(host, basliklar) {
  const out = new Map();
  for (const p of parca([...new Set(basliklar.filter(Boolean))], 20)) {
    const { bul } = await apiSayfalar(host, { action: "query", titles: p.join("|"), redirects: "1", prop: "extracts", exintro: "1", explaintext: "1", exlimit: "20" });
    for (const t of p) { const pg = bul(t); if (pg && pg.extract) out.set(t, temizMetin(pg.extract)); }
  }
  return out;
}
const trB = [], enB = [];
for (const il of iller.values()) {
  trB.push(il.trA);
  for (const d of il.ilceler) trB.push(d.trA);
  for (const o of il.yerler) { if (o.trA) trB.push(o.trA); else enB.push(o.enA); }
}
const trM = await ozetler("tr.wikipedia.org", trB);
const enM = await ozetler("en.wikipedia.org", enB);
rapor("Türkçe metin:", trM.size, "| İngilizce metin:", enM.size);

// ---------- 9. Yazma ----------
const fotoCikti = (a) => { const f = a && FOTO.get(a); return f ? { p: f.p, w: f.w, a: f.a } : null; };
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT + "/il", { recursive: true });
fs.mkdirSync(KONTROL, { recursive: true });
const index = { surum: SURUM, iller: [] };
const ara = [];
const kontrol = [];
const ilSirali = [...iller.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
for (const il of ilSirali) {
  const ilceSira = il.ilceler.filter((d) => d.koor).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  const ilceNo = new Map(ilceSira.map((d, i) => [d.q, i]));
  const yerler = il.yerler.map((o) => {
    const metin = o.trA ? trM.get(o.trA) : enM.get(o.enA);
    const y = { ad: temizAd(o.ad), q: o.q, lat: o.koor[0], lng: o.koor[1], k: o.k, i: ilceNo.has(o.ilce) ? ilceNo.get(o.ilce) : -1, f: fotoCikti(o.foto) };
    if (o.one) y.one = 1;
    if (o.ip) y.ip = o.ip;
    if (metin) y.m = metin; if (!o.trA && metin) y.en = 1;
    if (o.aciklama) y.ac = o.aciklama;
    y.w = o.trA ? "tr:" + o.trA : o.enA ? "en:" + o.enA : "";
    if (o.yil) y.yil = o.yil; if (o.rakim && o.k === "d") y.rak = o.rakim; if (o.unesco) y.un = 1;
    y.sl = o.sl || 0;
    return y;
  });
  const ilceCikti = ilceSira.map((d) => ({ ad: d.ad, q: d.q, lat: d.koor[0], lng: d.koor[1], f: fotoCikti(d.foto), m: trM.get(d.trA) || "", w: d.trA ? "tr:" + d.trA : "", nuf: d.nufus || 0, nufY: d.nufusYil || "", alan: d.alan ? Math.round(d.alan) : 0, n: yerler.filter((y) => y.i === ilceNo.get(d.q)).length }));
  const dosya = { ad: il.ad, s: il.s, q: il.q, lat: il.koor ? il.koor[0] : 0, lng: il.koor ? il.koor[1] : 0, plaka: il.plaka, f: fotoCikti(il.foto), m: trM.get(il.trA) || "", w: il.trA ? "tr:" + il.trA : "", nuf: il.nufus || 0, nufY: il.nufusYil || "", alan: il.alan ? Math.round(il.alan) : 0, ilceler: ilceCikti, yerler };
  fs.writeFileSync(`${OUT}/il/${il.s}.json`, JSON.stringify(dosya));
  index.iller.push({ ad: il.ad, s: il.s, q: il.q, lat: dosya.lat, lng: dosya.lng, plaka: il.plaka, f: dosya.f, n: yerler.length, ilceler: ilceCikti.map((d) => [d.ad, d.lat, d.lng, d.n]) });
  yerler.forEach((y, j) => ara.push([y.ad, il.s, j]));
  // Kontrol listesi: il kapağı, ilçe kapakları, seçkin yerler ve her ilin en ünlü 8 yeri
  const kk = (tur, ad, a, kaynak) => a && kontrol.push({ tur, il: il.ad, ad, dosya: a, p: FOTO.get(a).p, w: FOTO.get(a).w, kaynak });
  kk("il", il.ad, il.foto, il.fotoKaynak);
  for (const d of ilceSira) kk("ilce", d.ad, d.foto, d.fotoKaynak);
  for (const o of il.yerler.filter((o) => o.one)) kk("one", o.ad, o.foto, o.fotoKaynak);
  for (const o of il.yerler.filter((o) => !o.one).slice(0, 8)) kk("yer", o.ad, o.foto, o.fotoKaynak);
  rapor(`${il.ad}: ${yerler.length} yer (${yerler.filter((y) => y.one).length} seçkin), ${ilceSira.length} ilçe, fotosuz ilçe ${ilceCikti.filter((d) => !d.f).length}, ilçesiz yer ${yerler.filter((y) => y.i < 0).length}`);
}
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(index));
fs.writeFileSync(`${OUT}/ara.json`, JSON.stringify(ara));
fs.writeFileSync(`${KONTROL}/liste.json`, JSON.stringify(kontrol));
const topYer = index.iller.reduce((s, i) => s + i.n, 0);
rapor(`TOPLAM: ${index.iller.length} il, ${ilceler.size} ilçe, ${topYer} yer, kontrol edilecek ${kontrol.length} fotoğraf, sürüm ${SURUM}`);
fs.writeFileSync(`${KONTROL}/rapor.txt`, RAPOR.join("\n"));
