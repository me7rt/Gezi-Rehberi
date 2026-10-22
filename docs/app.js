/* Rota Cepte · © 2026 Mert Turanlıoğlu · Tüm hakları saklıdır. İzinsiz kopyalanamaz ve yayınlanamaz.
   Rota Cepte: 81 il, tüm ilçeler, canlı konum.
   Veri docs/data altında; GitHub Actions'ta Wikidata, Vikipedi ve Commons'tan hazırlanır (scripts/uret.mjs). */
(function () {
  "use strict";
  const SURUM = "5.11";
  // MapTiler harita anahtarı (boşsa OpenStreetMap kullanılır)
  const HARITA_ANAHTAR = "pI5pMuHAI4gLw3aqy35G";

  const SVG = {
    t: '<path d="M4 20h16M6 20v-7M18 20v-7M5 13h14M7 13a5 5 0 0 1 10 0M12 4v4"/>',
    d: '<path d="M3 19l6-9 4 6 3-4 5 7z"/><circle cx="17" cy="6" r="2"/>',
    m: '<path d="M3 9l9-5 9 5M5 9v9M10 9v9M14 9v9M19 9v9M3 20h18"/>',
    c: '<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
    s: '<path d="M3 20h18M5 20V10l4-3 4 3v10M13 20v-7l3-2 3 2v7"/>',
    y: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
  };
  const icon = (k, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[k] || SVG.y}</svg>`;
  const CATS = {
    t: { ad: T("Tarihi"), renk: "#1f4fa3" },
    d: { ad: T("Doğa & Manzara"), renk: "#2f7d5b" },
    m: { ad: T("Müze"), renk: "#13707a" },
    c: { ad: T("Çarşı & Lezzet"), renk: "#c2462e" },
    s: { ad: T("Şehir & Semt"), renk: "#7a3f8c" }
  };
  const BOLGE_RENK = "#5b6f77";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sade = (s) => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  const nf = (n) => Number(n).toLocaleString(DIL === "en" ? "en-US" : "tr-TR");
  const adi = (p) => (DIL === "en" && p.ae) || p.ad;
  function km(a, b) {
    const R = 6371, r = (x) => (x * Math.PI) / 180;
    const dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmt = (d) => (d < 1 ? Math.round(d * 100) * 10 + " m" : d < 100 ? (DIL === "en" ? d.toFixed(1) : d.toFixed(1).replace(".", ",")) + " km" : nf(Math.round(d)) + " km");
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ---------- fotoğraf ve bağlantılar ----------
  const COM = "https://upload.wikimedia.org/wikipedia/commons/";
  // Küçük resim yüklenmezse orijinal dosyayı dene, o da olmazsa kaldır
  window.fotoHata = (img) => {
    if (!img.dataset.y && img.src.includes("/thumb/")) { img.dataset.y = 1; img.src = img.src.replace("/thumb/", "/").replace(/\/[^/]+$/, ""); }
    else img.remove();
  };
  function foto(f, W) {
    if (!f || !f.p) return "";
    const p = f.p.split("?")[0];
    if (f.w <= W) return COM + p;
    return `${COM}thumb/${p}/${W}px-${p.split("/").pop()}`;
  }
  function wikiUrl(w) {
    if (!w) return "";
    const i = w.indexOf(":");
    return `https://${w.slice(0, i)}.wikipedia.org/wiki/${encodeURIComponent(w.slice(i + 1).replace(/ /g, "_"))}`;
  }
  // Fotoğraf yüklenemezse altındaki kategori simgesi görünür kalır.
  function thumb(f, k, W, cls) {
    const src = foto(f, W || 250);
    const renk = CATS[k] ? CATS[k].renk : BOLGE_RENK;
    return `<span class="${cls || "thumb"}" style="--c:${renk}">${icon(k, cls === "cover" ? 34 : 22)}${src ? `<img src="${src}" alt="" loading="lazy" decoding="async" onerror="fotoHata(this)">` : ""}</span>`;
  }

  // ---------- veri ----------
  let IDX = null;
  const IL = new Map();
  let ARA = null, araYukleniyor = false;
  async function getJSON(url, opt) {
    const r = await fetch(url, opt);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  async function loadIndex() {
    IDX = await getJSON(`data/index.json?v=${SURUM}`, { cache: "no-cache" });
    IDX.iller.forEach((il) => il.ilceler.forEach((z) => { z[0] = z[0].replace(/ \(.*\)$/, ""); }));
    IDX.ilBy = new Map(IDX.iller.map((i) => [i.s, i]));
    const s = IDX.surum || "";
    $("ver").textContent = TL(`Sürüm ${SURUM} · Veri ${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)} · ${nf(IDX.iller.reduce((t, i) => t + i.n, 0))} yer, ${nf(IDX.iller.reduce((t, i) => t + i.ilceler.length, 0))} ilçe`, `Version ${SURUM} · Data ${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)} · ${nf(IDX.iller.reduce((t, i) => t + i.n, 0))} places, ${nf(IDX.iller.reduce((t, i) => t + i.ilceler.length, 0))} districts`);
  }
  async function loadIl(s) {
    if (IL.has(s)) return IL.get(s);
    const d = await getJSON(`data/il/${s}.json?v=${IDX.surum}`);
    d.ilceler.forEach((z) => { z.ad = z.ad.replace(/ \(.*\)$/, ""); });
    d.yerler.forEach((y, j) => { y.j = j; y.il = d.ad; y.ilS = d.s; y.ilce = y.i >= 0 && d.ilceler[y.i] ? d.ilceler[y.i].ad : ""; });
    if (DIL === "en") {
      const en = await getJSON(`data/en/${s}.json?v=${IDX.surum}`).catch(() => null);
      if (en) {
        // Vikipedi girişlerindeki parantezleri (okunuş, Türkçe adı) at: "Cappadocia (; Turkish: Kapadokya) is..." -> "Cappadocia is..."
        // Okunuş parantezlerini at; Vikipedi özeti bazen kapanmayan parantez bırakır: "Cyzicus ( SIZ-ik-əs; ...; was an ..."
        const sade = (t) => (t || "").replace(/\s*\([^()]*\)/g, "").replace(/\s*\((?![^()]*\))[^()]*?;\s+(?=[a-z])/, " ").replace(/\s+([,.])/g, "$1");
        d.me = sade(en.m); d.we = en.w;
        d.yerler.forEach((y) => { const e = en.y && en.y[y.q]; if (e) { y.ae = e[0]; y.me = sade(e[1]); y.we = "en:" + e[2]; } });
      }
    }
    IL.set(s, d);
    return d;
  }
  let araSoz = null;
  function loadAra() {
    if (ARA) return Promise.resolve();
    if (araSoz) return araSoz;
    araSoz = getJSON(`data/ara.json?v=${IDX.surum}-2`).then((a) => {
      ARA = a.map(([ad, s, j, lat, lng, k, f]) => [sade(ad), ad, s, j, lat, lng, k, f]);
      if (view && view.mode === "tema") renderTema();
      if (view && view.mode === "rota") renderRota();
      if (!$("home").hidden) renderFav();
      if (!$("home").hidden && $("search").value.trim().length >= 2) renderHome();
    }).catch(() => { araSoz = null; });
    return araSoz;
  }

  // ---------- durum ----------
  let me = null, watchId = null;
  let view = { mode: "home" };
  let places = [], cat = "hepsi", sortMode = "oner", shown = 60;
  let map = null, layer = null, meMarker = null, fitted = false;
  let open = null, sheetPushed = false, bekleyenYer = null, homeMe = null, sonSira = 0, routeNo = 0;

  // ---------- konum ----------
  function stopLocation() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null; me = null; homeMe = null;
    try { localStorage.setItem("gezi-konum-kapali", "1"); } catch (e) {}
    $("locBtn").classList.remove("on");
    $("locText").textContent = T("Konum kapalı");
    $("nearSub").textContent = T("Konumunu aç, sana en yakın gezilecek yerleri sıralayalım");
    if (meMarker && layer) { layer.removeLayer(meMarker); meMarker = null; }
    if (open) renderFacts(open);
    if (view && view.mode === "tema") renderTema();
    else if (!$("home").hidden) renderHome();
    else if (!$("city").hidden && view.d) { if (sortMode === "yakin") sortMode = "oner"; renderSort(); renderList(); if (!$("tabIlce").hidden) renderIlceList(view.d); }
    toast(T("Konum kapatıldı"));
  }
  function startLocation(cb) {
    try { localStorage.removeItem("gezi-konum-kapali"); } catch (e) {}
    if (!navigator.geolocation) { toast(T("Bu cihaz konumu desteklemiyor.")); return; }
    if (watchId !== null) { if (me && cb) cb(); return; }
    let first = true;
    $("locText").textContent = T("Konum aranıyor…");
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        me = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        $("locBtn").classList.add("on");
        $("locText").textContent = T("Konum açık");
        $("nearSub").textContent = T("Sana en yakın gezilecek yerler, canlı mesafeyle");
        if (first) { first = false; if (view.mode !== "home") sortMode = "yakin"; onMove(true); if (cb) cb(); }
        else onMove(false);
      },
      (err) => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        $("locBtn").classList.remove("on");
        $("locText").textContent = T("Konum kapalı");
        toast(err.code === 1 ? T("Konum izni verilmedi. Ayarlardan izin verebilirsin.") : T("Konum bulunamadı, tekrar dene."));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }
  let moveTimer = null;
  function onMove(hemen) {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      if (!me) return;
      if (!$("city").hidden) {
        drawMe();
        if (hemen || (sortMode === "yakin" && Date.now() - sonSira > 15000)) { sonSira = Date.now(); renderSort(); renderList(); }
        else updateKm();
        if (hemen && !$("tabIlce").hidden && view.d) renderIlceList(view.d);
      }
      if (open) renderFacts(open);
      if (!$("home").hidden && (!homeMe || km(homeMe, me) > 2)) { homeMe = me; renderHome(); }
      if (!kesifYakin && !$("home").hidden) gununKesfi();
      if (hemen && view && view.mode === "tema") renderTema();
    }, hemen ? 0 : 400);
  }
  function updateKm() {
    for (const el of document.querySelectorAll("#list .row")) {
      const d = IL.get(el.dataset.s); const p = d && d.yerler[+el.dataset.j];
      if (p) el.querySelector(".km").textContent = fmt(km(me, p));
    }
    for (const el of document.querySelectorAll("#ilceList .km")) el.textContent = fmt(km(me, { lat: +el.dataset.lat, lng: +el.dataset.lng }));
  }

  // ---------- yönlendirme (#/il/istanbul, #/il/istanbul/ilceler, #/il/istanbul/ilce/3, #/yakin) ----------
  function show(v) {
    const degisti = $(v).hidden;
    $("home").hidden = v !== "home";
    $("tema").hidden = v !== "tema";
    $("rota").hidden = v !== "rota";
    $("rozet").hidden = v !== "rozet";
    $("city").hidden = v !== "city";
    $("indirSec").hidden = true;
    $("plan").hidden = true;
    $("back").hidden = v === "home";
    if (degisti || v === "city") window.scrollTo(0, 0);
  }
  async function route() {
    const no = ++routeNo;
    hideSheet();
    const h = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    try {
      if (!IDX) await loadIndex();
      if (h[0] === "il" && IDX.ilBy.has(h[1])) {
        const ozet = IDX.ilBy.get(h[1]);
        if (!IL.has(h[1])) {
          show("city"); $("eyebrow").textContent = T("İl"); $("title").textContent = ozet.ad;
          $("hero").hidden = true; $("tabs").hidden = true; $("tabIlce").hidden = true; $("tabYer").hidden = false;
          $("chips").innerHTML = ""; $("count").textContent = ""; $("moreBtn").hidden = true;
          $("list").innerHTML = `<li class="empty">${T("Yükleniyor…")}</li>`;
        }
        const d = await loadIl(h[1]);
        if (no !== routeNo) return;
        if (h[2] === "ilce" && d.ilceler[+h[3]]) showIlce(d, +h[3]);
        else showIl(d, h[2] === "ilceler" ? "ilce" : "yer");
        if (h[2] === "yer") { const p = d.yerler.find((y) => y.q === h[3]); history.replaceState(null, "", "#/il/" + d.s); if (p) openDetail(p); }
        if (bekleyenYer && bekleyenYer.s === d.s) { const p = d.yerler[bekleyenYer.j]; bekleyenYer = null; if (p) openDetail(p); }
        return;
      }
      if (h[0] === "yakin") return await showNear(no);
      if (h[0] === "tema" && TEMA[h[1]]) return showTema(h[1]);
      if (h[0] === "rota") return await showRota(h[1], no);
      if (h[0] === "rozetler") { view = { mode: "rozet" }; show("rozet"); $("eyebrow").textContent = T("Gezgin rozetleri"); $("title").textContent = T("Rozetlerin"); renderRozet(); return; }
      showHome();
    } catch (e) {
      console.error(e);
      if (no !== routeNo) return;
      show("home"); $("homeMain").hidden = false; $("results").hidden = true;
      $("ilGrid").innerHTML = TL('<li class="empty">Veriler yüklenemedi. İnternet bağlantını kontrol edip <button class="linkbtn" id="retry">tekrar dene</button>.</li>', '<li class="empty">Couldn\'t load data. Check your connection and <button class="linkbtn" id="retry">try again</button>.</li>');
      $("retry").onclick = route;
    }
  }
  const git = (h) => { if (location.hash === h) route(); else location.hash = h; };

  // ---------- ana sayfa ----------
  function showHome() {
    view = { mode: "home" }; show("home");
    $("eyebrow").textContent = "Rota Cepte"; $("title").textContent = T("Nereye gidiyorsun?");
    renderHome();
  }
  // ---------- gideceğim yerler (favoriler) ----------
  const FAV = "gezi-fav";
  function favs() { try { return JSON.parse(localStorage.getItem(FAV)) || []; } catch (e) { return []; } }
  function favYaz(a) { try { localStorage.setItem(FAV, JSON.stringify(a)); } catch (e) {} }
  const ayni = (x, p) => x.q === p.q && x.s === p.ilS;
  const favMi = (p) => favs().some((x) => ayni(x, p));
  function favDegis(p) {
    let a = favs();
    if (favMi(p)) a = a.filter((x) => !ayni(x, p));
    else a.unshift({ q: p.q, s: p.ilS, ad: p.ad, il: [...new Set([p.ilce, p.il].filter(Boolean))].join(", "), k: p.k, f: p.f, lat: p.lat, lng: p.lng });
    favYaz(a); favBtn(p); renderFav();
  }
  function favBtn(p) {
    const on = favMi(p), b = $("dFav");
    b.classList.toggle("on", on); b.textContent = on ? "♥" : "♡";
    b.setAttribute("aria-label", on ? T("Listemden çıkar") : T("Gideceğim yerlere ekle"));
  }
  function renderFav() {
    const a = favs();
    $("favSec").hidden = !a.length;
    const kon = (x) => {
      if (x.lat != null) return x;
      const r = ARA && ARA.find((y) => y[2] === x.s && y[1] === x.ad);
      return r ? { ...x, lat: r[4], lng: r[5] } : null;
    };
    if (a.some((x) => x.lat == null) && !ARA && IDX) loadAra();
    const nok = a.map(kon).filter(Boolean);
    $("favList").innerHTML = a.map((x) => {
      const n = kon(x);
      return `<li><button class="row" data-go="#/il/${x.s}/yer/${x.q}">${thumb(x.f, x.k)}<span class="rt"><b>${esc(x.ad)}</b><small>${esc(x.il)}</small></span><span class="km">${me && n ? fmt(km(me, n)) : "›"}</span></button></li>`;
    }).join("");
    // Kendi rotan: en yakından başlayıp hep bir sonraki en yakın yere giden sıra (en fazla 10 durak)
    const b = $("favRota");
    if (nok.length < 2) { b.hidden = true; return; }
    let kalan = nok.slice(), sira = [], cur = me || null, top = 0;
    while (kalan.length && sira.length < 10) {
      let bi = 0;
      if (cur) kalan.forEach((x, i) => { if (km(cur, x) < km(cur, kalan[bi])) bi = i; });
      const x = kalan.splice(bi, 1)[0];
      if (cur && (sira.length || me)) top += km(cur, x);
      sira.push(x); cur = x;
    }
    const nk = (x) => x.lat + "," + x.lng, son = sira[sira.length - 1], ara = sira.slice(0, -1).map(nk).join("|");
    b.href = `https://www.google.com/maps/dir/?api=1&destination=${nk(son)}${ara ? "&waypoints=" + encodeURIComponent(ara) : ""}&travelmode=driving`;
    b.innerHTML = TL(`🧭 Listemden rota yap <small>${sira.length} durak · ~${fmt(top * 1.3)} · en yakından başlar</small>`, `🧭 Make a route from my list <small>${sira.length} stops · ~${fmt(top * 1.3)} · nearest first</small>`);
    b.hidden = false;
  }
  // ---------- gittiğim yerler ----------
  const GIT = "gezi-gittim";
  function gittiklerim() { try { return JSON.parse(localStorage.getItem(GIT)) || []; } catch (e) { return []; } }
  const gittimMi = (p) => gittiklerim().some((x) => ayni(x, p));
  function gitDegis(p) {
    let a = gittiklerim();
    const vardi = gittimMi(p), onceki = new Set(rozetler().filter((r) => r.tamam).map((r) => r.ad));
    if (vardi) a = a.filter((x) => !ayni(x, p));
    else a.unshift({ q: p.q, s: p.ilS, ad: p.ad, il: [...new Set([p.ilce, p.il].filter(Boolean))].join(", "), k: p.k, f: p.f, t: Date.now() });
    try { localStorage.setItem(GIT, JSON.stringify(a)); } catch (e) {}
    gitBtn(p);
    if (!vardi) {
      const iller = new Set(a.map((x) => x.s)).size;
      const yeni = rozetler().find((r) => r.tamam && !onceki.has(r.ad));
      if (yeni) rozetKutla(yeni);
      else toast(TL(`Harika! Gezdiğin il: ${iller}/81 · Gittiğin yer: ${a.length}`, `Great! Provinces visited: ${iller}/81 · Places: ${a.length}`));
    }
  }
  function gitBtn(p) {
    const on = gittimMi(p), b = $("dGit");
    b.classList.toggle("on", on); b.textContent = on ? T("✓ Gittim") : T("Buraya gittim");
  }
  function renderGez() {
    const a = gittiklerim();
    $("gezSec").hidden = false; renderHarita(); renderRozet();
    $("gezBtn").hidden = $("karneBtn").hidden = !a.length;
    if (!a.length) { $("gezList").hidden = true; return; }
    const iller = new Set(a.map((x) => x.s)).size;
    $("gezSay").textContent = TL(`Gezdiğin iller: ${iller} / 81`, `Provinces visited: ${iller} / 81`);
    $("gezAlt").textContent = TL(`${a.length} yere gittin · listeyi gör`, `${a.length} places visited · see the list`);
    $("gezBar").style.width = Math.max(3, Math.round((iller / 81) * 100)) + "%";
    $("gezList").innerHTML = a.map((x) =>
      `<li><button class="row" data-go="#/il/${x.s}/yer/${x.q}">${thumb(x.f, x.k)}<span class="rt"><b>${esc(x.ad)}</b><small>${esc(x.il)}${x.t ? " · " + new Date(x.t).toLocaleDateString(DIL === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" }) : ""}</small></span><span class="km">✓</span></button></li>`).join("");
  }
  // ---------- rozetler ----------
  const BOLGE = {
    "Marmara": "istanbul edirne kirklareli tekirdag canakkale kocaeli yalova sakarya bilecik bursa balikesir",
    "Ege": "izmir manisa aydin denizli mugla afyonkarahisar kutahya usak",
    "Akdeniz": "antalya isparta burdur mersin adana hatay osmaniye kahramanmaras",
    "İç Anadolu": "ankara konya kayseri eskisehir sivas kirikkale aksaray karaman kirsehir nigde nevsehir yozgat cankiri",
    "Karadeniz": "zonguldak bartin karabuk duzce bolu kastamonu sinop samsun ordu giresun trabzon rize artvin gumushane bayburt corum amasya tokat",
    "Doğu Anadolu": "erzurum erzincan kars agri igdir ardahan van mus bitlis bingol tunceli elazig malatya hakkari",
    "Güneydoğu": "gaziantep sanliurfa diyarbakir mardin batman siirt sirnak adiyaman kilis"
  };
  const temaSay = (a, anahtar, kat) => a.filter((x) => (!kat || x.k === kat) && anahtar.some((w) => (" " + sade(x.ad) + " ").includes(w))).length;
  function rozetler() {
    const a = gittiklerim(), il = new Set(a.map((x) => x.s));
    const R = [
      ["👣", T("İlk adım"), T("İlk yerine gittin"), a.length, 1],
      ["🎒", T("Gezgin"), T("10 yere git"), a.length, 10],
      ["🧭", T("Kâşif"), T("25 yere git"), a.length, 25],
      ["🌟", T("Efsane gezgin"), T("50 yere git"), a.length, 50],
      ["🗺️", T("Yola düştün"), T("5 ile git"), il.size, 5],
      ["🚗", T("Uzun yolcu"), T("20 ile git"), il.size, 20],
      ["🇹🇷", T("Türkiye'yi gezdim"), T("81 ilin hepsine git"), il.size, 81],
      ["💧", T("Şelale avcısı"), T("3 şelaleye git"), temaSay(a, ["selale"]), 3],
      ["🕳️", T("Mağara kâşifi"), T("3 mağaraya git"), temaSay(a, ["magara"]), 3],
      ["🏰", T("Kale fatihi"), T("5 kaleye git"), temaSay(a, ["kale"]), 5],
      ["🌊", T("Göl sevdalısı"), T("3 göle git"), temaSay(a, ["golu", "gol "], "d"), 3],
      ["🌲", T("Doğa dostu"), T("3 milli park ya da tabiat parkına git"), temaSay(a, ["milli park", "tabiat park"]), 3],
      ["🏛️", T("Müze kurdu"), T("5 müzeye git"), a.filter((x) => x.k === "m" || sade(x.ad).includes("muze")).length, 5]
    ];
    for (const [b, iller] of Object.entries(BOLGE)) {
      const l = iller.split(" ");
      R.push(["🏅", TL(b + " fatihi", T(b) + " conqueror"), TL(`${b} bölgesinin ${l.length} ilinin hepsine git`, `Visit all ${l.length} provinces of the ${T(b)} region`), l.filter((s) => il.has(s)).length, l.length]);
    }
    return R.map(([e, ad, acik, n, hedef]) => ({ e, ad, acik, n: Math.min(n, hedef), hedef, tamam: n >= hedef }));
  }
  function rozetKutla(r) {
    const d = document.createElement("div"); d.className = "tanit";
    d.innerHTML = `<div class="tkart rkutla"><div class="temo">${r.e}</div><small>${T("Yeni rozet!")}</small><h2>${esc(r.ad)}</h2><p>${esc(r.acik)}</p><div class="tbtn" style="justify-content:center"><button class="btn primary">${T("Süper!")}</button></div></div>`;
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("button")) { d.classList.add("out"); setTimeout(() => d.remove(), 300); } });
    document.body.appendChild(d);
  }
  function renderRozet() {
    const R = rozetler(), k = R.filter((r) => r.tamam).length;
    $("rozetSay").textContent = `${k} / ${R.length}`;
    const kz = R.filter((r) => r.tamam).map((r) => r.e).slice(0, 5).join(" ");
    $("rozetBtn").innerHTML = `<span class="rbtnust"><b>🏅 ${T("Rozetlerin")}: ${k} / ${R.length}</b><small${kz ? ' class="emo"' : ""}>${kz || T("Henüz rozet yok. Gezdiğin yerleri işaretle, rozet kazan.")}</small></span><span class="km">›</span>`;
    $("rozetList").innerHTML = R.sort((x, y) => (y.tamam - x.tamam) || (y.n / y.hedef - x.n / x.hedef)).map((r) =>
      `<li class="rozet${r.tamam ? " on" : ""}" title="${esc(r.acik)}"><i>${r.e}</i><b>${esc(r.ad)}</b><small>${r.tamam ? T("Kazandın") : `${r.n}/${r.hedef}`}</small></li>`).join("");
  }
  // ---------- hava durumu ----------
  const HAVA = { 0: ["☀️", T("Açık")], 1: ["🌤️", T("Az bulutlu")], 2: ["⛅", T("Parçalı bulutlu")], 3: ["☁️", T("Kapalı")], 45: ["🌫️", T("Sisli")], 48: ["🌫️", T("Sisli")],
    51: ["🌦️", T("Çisenti")], 53: ["🌦️", T("Çisenti")], 55: ["🌦️", T("Çisenti")], 56: ["🌧️", T("Dondurucu çisenti")], 57: ["🌧️", T("Dondurucu çisenti")],
    61: ["🌧️", T("Hafif yağmur")], 63: ["🌧️", T("Yağmurlu")], 65: ["🌧️", T("Kuvvetli yağmur")], 66: ["🌧️", T("Dondurucu yağmur")], 67: ["🌧️", T("Dondurucu yağmur")],
    71: ["🌨️", T("Hafif kar")], 73: ["🌨️", T("Karlı")], 75: ["❄️", T("Yoğun kar")], 77: ["🌨️", T("Kar")], 80: ["🌦️", T("Sağanak")], 81: ["🌧️", T("Sağanak")], 82: ["⛈️", T("Kuvvetli sağanak")],
    85: ["🌨️", T("Kar sağanağı")], 86: ["❄️", T("Kar sağanağı")], 95: ["⛈️", T("Gök gürültülü")], 96: ["⛈️", T("Dolu")], 99: ["⛈️", T("Dolu")] };
  const havaOnbellek = new Map();
  async function havaGoster(il) {
    const kutu = $("hava"); kutu.hidden = true; kutu.innerHTML = "";
    if (!il || il.lat == null) return;
    const s = il.s;
    try {
      let d = havaOnbellek.get(s);
      if (!d) {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${il.lat}&longitude=${il.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FIstanbul&forecast_days=3`);
        if (!r.ok) return;
        d = (await r.json()).daily; havaOnbellek.set(s, d);
      }
      if (!view || !view.d || view.d.s !== s) return;
      const gunler = [T("Bugün"), T("Yarın")];
      kutu.innerHTML = `<small>${TL(esc(il.ad) + " hava durumu", "Weather in " + esc(il.ad))}</small><div class="hgun">` + d.time.map((t, i) => {
        const [ik, ad] = HAVA[d.weathercode[i]] || ["🌡️", ""];
        const g = gunler[i] || new Date(t + "T12:00").toLocaleDateString(DIL === "en" ? "en-GB" : "tr-TR", { weekday: "long" });
        return `<span><em>${g}</em><i>${ik}</i><b>${Math.round(d.temperature_2m_max[i])}° <small>${Math.round(d.temperature_2m_min[i])}°</small></b><small>${ad}</small></span>`;
      }).join("") + "</div>";
      kutu.hidden = false;
    } catch (e) {}
  }
  // ---------- meşhur yemekler ----------
  function ekDe(ad) {
    const k = ad.toLocaleLowerCase("tr"), sesli = k.match(/[aıoueiöü]/g) || ["a"];
    const ince = "eiöü".includes(sesli[sesli.length - 1]), sert = "fstkçşhp".includes(k[k.length - 1]);
    return "'" + (sert ? "t" : "d") + (ince ? "e" : "a");
  }
  let YEMEK = null;
  async function yemekGoster(d) {
    const kutu = $("yemek"); kutu.hidden = true;
    try {
      if (!YEMEK) YEMEK = await getJSON(`yemek.json?v=${SURUM}`);
      const liste = YEMEK[d.s]; if (!liste || !liste.length) return;
      if (!view || !view.d || view.d.s !== d.s) return;
      kutu.innerHTML = `<h3>${TL(esc(d.ad) + ekDe(d.ad) + " ne yenir?", "What to eat in " + esc(d.ad))}</h3><div class="ychips">` + liste.map((y) =>
        `<a class="ychip" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(y + " " + d.ad)}">🍽️ ${esc(y)} <small>${T("En iyi yerleri bul ›")}</small></a>`).join("") + "</div>";
      kutu.hidden = false;
    } catch (e) {}
  }
  // ---------- dinle (sesli okuma) ----------
  const sesVar = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  function dinleDurdur() { if (sesVar) speechSynthesis.cancel(); $("dDinle").textContent = T("🔊 Dinle"); $("dDinle").classList.remove("on"); }
  // Telefondaki en doğal Türkçe sesi seç (geliştirilmiş / doğal / Google sesleri öne, robotik olanlar sona)
  function enIyiSes() {
    const v = speechSynthesis.getVoices().filter((x) => (DIL === "en" ? /^en/i : /^tr/i).test(x.lang));
    const puan = (x) => { const n = x.name.toLowerCase(); let p = 0;
      if (/premium|enhanced|geliştirilmiş|neural|natural|doğal|wavenet|online/.test(n)) p += 5;
      if (/google/.test(n)) p += 3;
      if (!x.localService) p += 1;
      if (/compact|espeak|robot/.test(n)) p -= 5;
      return p; };
    return v.sort((x, y) => puan(y) - puan(x))[0] || null;
  }
  // Kısaltmaları açık oku, parantezleri atla: kulağa daha doğal gelsin
  function okunur(t) {
    return t.replace(/^\(İngilizce kaynaktan\) /, "").replace(/\s*\([^)]*\)/g, "")
      .replace(/(^|\s)MÖ(?=[\s.,])/g, "$1milattan önce").replace(/\bMS\b/g, "milattan sonra")
      .replace(/(\d)\s*km\b/g, "$1 kilometre").replace(/(\d)\s*m\b/g, "$1 metre")
      .replace(/\byy\.?/g, "yüzyıl").replace(/\bvb\.?/g, "ve benzeri").replace(/\s{2,}/g, " ").trim();
  }
  function dinle() {
    if (!sesVar || !open) return;
    if (speechSynthesis.speaking) return dinleDurdur();
    const ses = enIyiSes();
    // Cümle cümle oku: doğal duraklar olur, uzun metinde ses kesilmez
    const cumleler = (adi(open) + ". " + (DIL === "en" ? $("dText").textContent.replace(/\s*\([^)]*\)/g, "") : okunur($("dText").textContent))).split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/).filter((c) => c.trim());
    speechSynthesis.cancel();
    cumleler.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c.trim());
      u.lang = DIL === "en" ? "en-GB" : "tr-TR"; u.rate = 1; u.pitch = 1; if (ses) u.voice = ses;
      if (i === cumleler.length - 1) u.onend = () => { $("dDinle").textContent = T("🔊 Dinle"); $("dDinle").classList.remove("on"); };
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") dinleDurdur(); };
      speechSynthesis.speak(u);
    });
    $("dDinle").textContent = T("⏹ Durdur"); $("dDinle").classList.add("on");
  }
  if (sesVar) speechSynthesis.getVoices();
  // ---------- keşfet: tema listeleri (Türkiye geneli) ----------
  const TEMA = {
    selale: { ad: T("Şelaleler"), e: "💧", k: ["selale"] },
    magara: { ad: T("Mağaralar"), e: "🕳️", k: ["magara"] },
    kanyon: { ad: T("Kanyon ve vadiler"), e: "🧗", k: ["kanyon", "vadi"] },
    gol: { ad: T("Göller"), e: "🌊", k: ["golu", "gol "], d: 1 },
    ada: { ad: T("Adalar ve koylar"), e: "🏝️", k: ["adasi", "koyu", "plaj"] },
    park: { ad: T("Milli parklar"), e: "🌲", k: ["milli park", "tabiat park"] },
    dag: { ad: T("Dağlar ve yaylalar"), e: "⛰️", k: ["dagi", "yayla"], d: 1 },
    kale: { ad: T("Kaleler"), e: "🏰", k: ["kale"] },
    kopru: { ad: T("Tarihi köprüler"), e: "🌉", k: ["kopru"] },
    saray: { ad: T("Saraylar ve konaklar"), e: "👑", k: ["saray", "konag", "kosk"] },
    han: { ad: T("Han ve kervansaraylar"), e: "🐫", k: ["kervansaray", " hani", "bedesten"] },
    muze: { ad: T("Müzeler"), e: "🏛️", k: ["muze"] }
  };
  // Mevsime göre öneri: ayına göre 4 tema
  const MEVSIM = [
    { ay: [12, 1, 2], e: "❄️", ad: TL("Kış önerisi", "Winter picks"), not: TL("Soğukta içeride gezmelik: mağaralar, müzeler, saraylar ve kervansaraylar", "Indoor gems for cold days: caves, museums, palaces and caravanserais"), t: ["magara", "muze", "saray", "han"] },
    { ay: [3, 4, 5], e: "🌸", ad: TL("İlkbahar önerisi", "Spring picks"), not: TL("Karlar eridi, şelaleler coştu, vadiler yeşerdi", "Snow has melted: waterfalls at full flow, green valleys"), t: ["selale", "kanyon", "park", "kopru"] },
    { ay: [6, 7, 8], e: "☀️", ad: TL("Yaz önerisi", "Summer picks"), not: TL("Denize, göle ya da serin yaylalara kaç", "Head for the sea, a lake or the cool highlands"), t: ["ada", "gol", "dag", "kanyon"] },
    { ay: [9, 10, 11], e: "🍂", ad: TL("Sonbahar önerisi", "Autumn picks"), not: TL("Ormanlar renk renk, hava tam yürüyüşlük", "Colourful forests and perfect walking weather"), t: ["park", "gol", "selale", "kale"] }
  ];
  function mevsimKart() {
    const m = MEVSIM.find((x) => x.ay.includes(new Date().getMonth() + 1));
    $("mevsim").innerHTML = `<div class="mvust"><b>${m.e} ${esc(m.ad)}</b><small>${esc(m.not)}</small></div><div class="mvchips">${m.t.map((k) =>
      `<button class="tchip" data-go="#/tema/${k}"><i>${TEMA[k].e}</i><span>${esc(TEMA[k].ad)}</span></button>`).join("")}</div>`;
  }
  function temaChips() {
    mevsimKart();
    $("temaChips").innerHTML = Object.entries(TEMA).map(([k, t]) =>
      `<button class="tchip" data-go="#/tema/${k}"><i>${t.e}</i><span>${esc(t.ad)}</span></button>`).join("");
  }
  function showTema(k) {
    view = { mode: "tema", k }; show("tema");
    $("eyebrow").textContent = T("Türkiye geneli"); $("title").textContent = TEMA[k].ad;
    renderTema();
  }
  function renderTema() {
    if (!view || view.mode !== "tema") return;
    const t = TEMA[view.k];
    $("temaLoc").hidden = !!me;
    if (!ARA) { $("temaList").innerHTML = `<li class="empty">${T("Yükleniyor…")}</li>`; loadAra(); return; }
    let r = ARA.filter((x) => t.k.some((w) => (" " + x[0] + " ").includes(w)) && (!t.d || x[6] === "d"));
    if (me) r = r.map((x) => [km(me, { lat: x[4], lng: x[5] }), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    else r.sort((a, b) => b[7] - a[7] || a[1].localeCompare(b[1], "tr"));
    $("temaSay").textContent = TL(`${r.length} yer` + (me ? " · sana en yakından uzağa" : " · konumunu açarsan yakından uzağa sıralarız"), `${r.length} places` + (me ? " · nearest first" : " · turn on location to sort by distance"));
    $("temaList").innerHTML = r.length ? r.map((x) => {
      const c = CATS[x[6]] || CATS.t, il = (IDX.ilBy.get(x[2]) || {}).ad || "";
      return `<li><button class="row res" data-yer="${x[2]}|${x[3]}"><span class="thumb" style="--c:${c.renk}">${icon(x[6] || "t", 20)}</span><span class="rt"><b>${esc(x[1])}</b><small>${esc(il)}</small></span><span class="km">${me ? fmt(km(me, { lat: x[4], lng: x[5] })) : "›"}</span></button></li>`;
    }).join("") : `<li class="empty">${T("Bu türde yer bulunamadı.")}</li>`;
  }
  // ---------- internetsiz kullanım: ilin verisini ve fotoğraflarını telefona indir ----------
  const INDK = "gezi-indirilen", INDC = "gezi-indir";
  function indirilenler() { try { return JSON.parse(localStorage.getItem(INDK)) || {}; } catch (e) { return {}; } }
  function indirKaydet(o) { try { localStorage.setItem(INDK, JSON.stringify(o)); } catch (e) {} }
  let indiriliyor = null;
  function indirBtn() {
    const b = $("indirBtn"), k = $("indirSil");
    const olur = view && view.mode === "il" && "caches" in window && navigator.serviceWorker && navigator.serviceWorker.controller;
    $("indirSec").hidden = !olur;
    if (!olur || indiriliyor === view.d.s) return;
    const ind = indirilenler()[view.d.s];
    b.disabled = false; k.hidden = !ind;
    b.classList.toggle("hazir", !!ind);
    b.innerHTML = ind
      ? `<b>${TL("✓ İnternetsiz hazır", "✓ Ready offline")}</b><small>${TL(`${ind.n} fotoğraf · ${new Date(ind.t).toLocaleDateString("tr-TR")} · güncellemek için dokun`, `${ind.n} photos · ${new Date(ind.t).toLocaleDateString("en-GB")} · tap to update`)}</small>`
      : `<b>${TL("📥 İnternetsiz kullan", "📥 Use offline")}</b><small>${TL("Bu ilin yerlerini ve fotoğraflarını telefona indir, çekmeyen yerde de aç", "Save this province's places and photos to your phone")}</small>`;
  }
  // İlk açılışta servis çalışanı sayfayı devralınca "İnternetsiz kullan" düğmesi hemen görünsün
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("controllerchange", () => { try { indirBtn(); } catch (e) {} });
  async function ilIndir() {
    if (indiriliyor || !view || view.mode !== "il") return;
    const d = view.d, s = d.s, b = $("indirBtn");
    indiriliyor = s; b.disabled = true; $("indirSil").hidden = true;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    try {
      const c = await caches.open(INDC);
      for (const u of [`data/il/${s}.json?v=${IDX.surum}`, `data/en/${s}.json?v=${IDX.surum}`, `data/index.json?v=${SURUM}`, `data/ara.json?v=${IDX.surum}-2`, `yemek.json?v=${SURUM}`]) {
        try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (e) {}
      }
      const set = new Set();
      const ekle = (f, W) => { const u = foto(f, W); if (u) set.add(u); };
      ekle(d.f, 960); if (d.kapak) ekle(d.kapak, 960);
      d.yerler.forEach((y) => { ekle(y.f, 250); ekle(y.f, 960); (y.g || []).forEach((f) => { ekle(f, 250); ekle(f, 960); }); });
      d.ilceler.forEach((z) => ekle(z.f, 250));
      const list = [...set]; let i = 0, tamam = 0, ok = 0;
      const goster = () => { if (view && view.mode === "il" && view.d.s === s) b.innerHTML = `<b>${TL("İndiriliyor…", "Downloading…")} ${Math.round((tamam / list.length) * 100)}%</b><small>${tamam} / ${list.length} ${TL("fotoğraf", "photos")}</small><span class="bar"><i style="width:${(tamam / list.length) * 100}%"></i></span>`; };
      goster();
      const isci = async () => {
        while (i < list.length) {
          const u = list[i++];
          try {
            if (!(await c.match(u, { ignoreVary: true }))) {
              let r = await fetch(u, { mode: "cors" }).catch(() => null);
              if (!r || !r.ok) r = await fetch(u, { mode: "no-cors" });
              if (r.ok || r.type === "opaque") { await c.put(u, r); ok++; }
            } else ok++;
          } catch (e) {}
          tamam++; if (tamam % 3 === 0 || tamam === list.length) goster();
        }
      };
      await Promise.all([1, 2, 3, 4, 5, 6].map(isci));
      const o = indirilenler(); o[s] = { t: Date.now(), n: ok }; indirKaydet(o);
      toast(ok < list.length * 0.8 ? TL(`${d.ad} indirildi, ama ${list.length - ok} fotoğraf alınamadı. İnternet iyiyken tekrar dene.`, `${d.ad} saved, but ${list.length - ok} photos failed. Try again on a better connection.`)
        : TL(`${d.ad} artık internetsiz de açılır. Harita için yine internet gerekir.`, `${d.ad} now works offline. The map still needs internet.`));
    } catch (e) {
      console.error(e); toast(TL("İndirme olmadı, telefonda yer kalmamış olabilir.", "Download failed, your phone may be out of space."));
    }
    indiriliyor = null; indirBtn();
  }
  async function ilIndirSil() {
    if (!view || view.mode !== "il") return;
    const d = view.d;
    try {
      const c = await caches.open(INDC);
      const sil = new Set();
      d.yerler.forEach((y) => { sil.add(foto(y.f, 250)); sil.add(foto(y.f, 960)); });
      d.ilceler.forEach((z) => sil.add(foto(z.f, 250)));
      // Başka bir indirilmiş ilde de kullanılan fotoğraflar (ör. il kapağı) kalsın diye yalnızca bu ilinkileri sil
      await Promise.all([...sil].filter(Boolean).map((u) => c.delete(u, { ignoreVary: true })));
    } catch (e) {}
    const o = indirilenler(); delete o[d.s]; indirKaydet(o);
    toast(TL(`${d.ad} telefondan kaldırıldı.`, `${d.ad} removed from your phone.`));
    indirBtn();
  }
  // ---------- 1 günlük plan: ilin öne çıkan yerlerinden birbirine yakın 5 durak ----------
  let planBas = 0;
  function planYap(d) {
    // Semt/ilçe/bölge adları durak olmasın (ör. "Osmaneli", "Kapadokya")
    const genel = new Set([d.ad, "Kapadokya", ...d.ilceler.map((z) => z.ad)]);
    const ad = d.yerler.filter((y) => y.lat != null && y.f && y.k !== "s" && !genel.has(y.ad)).sort((a, b) => (b.one ? 1 : 0) - (a.one ? 1 : 0) || a.j - b.j).slice(0, 30);
    if (ad.length < 2) return null;
    for (let t = 0; t < ad.length; t++) {
      const bas = ad[(planBas + t) % ad.length];
      // Başlangıca en fazla 40 km uzaktakiler: bir günde gezilebilsin
      const kalan = ad.filter((x) => x !== bas && km(bas, x) <= 40), sira = [bas];
      let cur = bas;
      while (sira.length < 5 && kalan.length) {
        let bi = 0;
        kalan.forEach((x, i) => { if (km(cur, x) < km(cur, kalan[bi])) bi = i; });
        cur = kalan.splice(bi, 1)[0]; sira.push(cur);
      }
      if (sira.length >= 3 || (sira.length >= 2 && t === ad.length - 1)) { planBas = (planBas + t) % ad.length; return sira; }
    }
    return null;
  }
  async function planGoster(d) {
    const kutu = $("plan");
    const s = planYap(d);
    if (!s) { kutu.hidden = true; return; }
    try { if (!YEMEK) YEMEK = await getJSON(`yemek.json?v=${SURUM}`); } catch (e) {}
    if (!view || view.mode !== "il" || view.d.s !== d.s) return;
    const yemek = YEMEK && YEMEK[d.s] && YEMEK[d.s][0];
    let top = 0; for (let i = 1; i < s.length; i++) top += km(s[i - 1], s[i]);
    const saat = ["09:00", "11:00", "14:00", "16:00", "18:00"];
    const nk = (x) => x.lat + "," + x.lng, son = s[s.length - 1], ara = s.slice(0, -1).map(nk).join("|");
    kutu.innerHTML = `<div class="plust"><h3>🗓️ ${TL(esc(d.ad) + ekDe(d.ad) + " 1 günlük plan", "A day in " + esc(d.ad))}</h3><button class="linkbtn" id="planYeni">🔀 ${TL("Başka plan", "Another plan")}</button></div>
      <small class="plalt">${TL(`${s.length} durak · aralarda toplam ~${fmt(top * 1.3)} yol`, `${s.length} stops · ~${fmt(top * 1.3)} of driving in between`)}</small>
      <ol class="plist">${s.map((p, i) => `${i === 2 ? `<li class="plyemek"><time>13:00</time><span>🍽️ ${TL("Öğle arası", "Lunch break")}${yemek ? `: <b>${esc(yemek)}</b> ${TL("dene", "")}` : ""}</span></li>` : ""}<li><button class="row" data-s="${p.ilS}" data-j="${p.j}"><time>${saat[i]}</time>${thumb(p.f, p.k)}<span class="rt"><b>${esc(adi(p))}</b><small>${i ? "↓ " + fmt(km(s[i - 1], p) * 1.3) + TL(" yol", " drive") : esc(p.ilce || d.ad)}</small></span></button></li>`).join("")}</ol>
      <a class="btn primary rotaac" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${nk(son)}&waypoints=${encodeURIComponent(ara)}&travelmode=driving">🧭 ${TL("Planı Google Maps'te aç", "Open plan in Google Maps")}</a>`;
    kutu.hidden = false;
  }
  // ---------- uygulamayı paylaş + beğeni sorusu ----------
  const ANDROID = !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === "android");
  const PLAY = "https://play.google.com/store/apps/details?id=io.github.me7rt.rotacepte";
  const SITE = "https://me7rt.github.io/Rota-Cepte/";
  function disAc(url) { const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
  async function uygulamaPaylas() {
    const link = ANDROID ? PLAY : SITE;
    const metin = TL("Türkiye'de gezilecek yerler için süper bir uygulama: Rota Cepte. 81 il, harita, hazır rotalar, internetsiz kullanım. ", "A great app for exploring Türkiye: Rota Cepte. 81 provinces, maps, ready-made routes, works offline. ");
    const P = window.Capacitor && window.Capacitor.Plugins;
    try {
      if (P && P.Share) return await P.Share.share({ title: "Rota Cepte", text: metin, url: link });
      if (navigator.share) return await navigator.share({ title: "Rota Cepte", text: metin, url: link });
      await navigator.clipboard.writeText(metin + link); toast(TL("Bağlantı kopyalandı, istediğin yere yapıştır.", "Link copied."));
    } catch (e) {}
  }
  function puanSor() {
    let o = { n: 0 };
    try { o = JSON.parse(localStorage.getItem("gezi-puan")) || o; } catch (e) { return; }
    o.n++;
    const kayit = () => { try { localStorage.setItem("gezi-puan", JSON.stringify(o)); } catch (e) {} };
    // 4. açılıştan sonra, listesine yer eklemiş ya da bir yere gitmiş kişiye bir kez sor; "Sonra" derse 6 açılış sonra tekrar
    if (o.bitti || o.n < (o.sonra || 4) || (!favs().length && !gittiklerim().length)) { kayit(); return; }
    kayit();
    setTimeout(() => {
      if (document.querySelector(".tanit") || !$("sheet").hidden) return;
      o.sonra = o.n + 6; kayit();
      const d = document.createElement("div"); d.className = "tanit";
      const kapat = () => { d.classList.add("out"); setTimeout(() => d.remove(), 300); };
      const adim1 = `<div class="tkart"><div class="temo">😍</div><h2>${TL("Rota Cepte'yi sevdin mi?", "Enjoying Rota Cepte?")}</h2><p>${TL("Bu uygulamayı tek başıma geliştiriyorum. Fikrin benim için çok değerli.", "I build this app on my own. Your opinion means a lot.")}</p><div class="tbtn"><button class="linkbtn" data-k="hayir">${TL("Pek değil", "Not really")}</button><button class="btn primary" data-k="evet">${TL("Evet, sevdim!", "Yes, I love it!")}</button></div><button class="linkbtn tsonra" data-k="sonra">${TL("Sonra sor", "Ask me later")}</button></div>`;
      d.innerHTML = adim1;
      d.addEventListener("click", (e) => {
        const k = e.target.closest("[data-k]"); if (e.target === d) return kapat(); if (!k) return;
        const v = k.dataset.k;
        if (v === "sonra" || v === "kapat") return kapat();
        if (v === "evet") {
          o.bitti = 1; kayit();
          d.innerHTML = `<div class="tkart"><div class="temo">⭐</div><h2>${TL("Çok sevindim!", "Awesome!")}</h2><p>${ANDROID ? TL("Play Store'da 5 yıldız ve kısa bir yorum bırakırsan, başka gezginler de bizi bulur.", "A 5-star rating on Google Play helps other travellers find us.") : TL("Arkadaşlarınla paylaşırsan çok mutlu olurum.", "Sharing it with friends would make my day.")}</p><div class="tbtn"><button class="linkbtn" data-k="kapat">${T("Kapat")}</button><button class="btn primary" data-k="${ANDROID ? "yildiz" : "paylas"}">${ANDROID ? "⭐ " + TL("Puan ver", "Rate") : "📣 " + TL("Paylaş", "Share")}</button></div></div>`;
        } else if (v === "hayir") {
          o.bitti = 1; kayit();
          d.innerHTML = `<div class="tkart"><div class="temo">🛠️</div><h2>${TL("Neyi düzeltelim?", "What should we improve?")}</h2><p>${TL("Eksik ya da hoşuna gitmeyen ne varsa yaz, ilk güncellemede bakayım.", "Tell me what's missing or annoying and I'll look at it in the next update.")}</p><div class="tbtn"><button class="linkbtn" data-k="kapat">${T("Kapat")}</button><button class="btn primary" data-k="yaz">✉️ ${TL("Görüş yaz", "Send feedback")}</button></div></div>`;
        } else if (v === "yildiz") { disAc(PLAY); kapat(); }
        else if (v === "paylas") { uygulamaPaylas(); kapat(); }
        else if (v === "yaz") { location.href = `mailto:${ILETISIM}?subject=${encodeURIComponent("Rota Cepte görüş")}&body=${encodeURIComponent("\n\n(Sürüm " + SURUM + ")")}`; kapat(); }
      });
      document.body.appendChild(d);
    }, 25000);
  }
  // ---------- hazır gezi rotaları ----------
  let ROTA = null;
  const rt = (r, k) => (DIL === "en" && r[k + "_en"]) || r[k];
  function loadRota() {
    if (!ROTA) ROTA = getJSON(`rotalar.json?v=${SURUM}`).catch(() => { ROTA = null; return []; });
    return ROTA;
  }
  async function rotaKartlar() {
    const r = await loadRota();
    $("rotaSec").hidden = !r.length;
    $("rotaKart").innerHTML = r.map((x) =>
      `<button class="rkart" data-go="#/rota/${x.k}"><i>${x.e}</i><b>${esc(rt(x, "ad"))}</b><small>${esc(rt(x, "sure"))} · ${x.d.length} ${TL("durak", "stops")}</small></button>`).join("");
  }
  async function showRota(k, no) {
    const r = (await loadRota()).find((x) => x.k === k);
    if (no !== routeNo) return;
    if (!r) return showHome();
    view = { mode: "rota", r }; show("rota");
    $("eyebrow").textContent = T("Hazır rota") + " · " + rt(r, "sure"); $("title").textContent = rt(r, "ad");
    renderRota();
  }
  function renderRota() {
    if (!view || view.mode !== "rota") return;
    const r = view.r;
    $("rotaNot").textContent = rt(r, "not");
    if (!ARA) { $("rotaList").innerHTML = `<li class="empty">${T("Yükleniyor…")}</li>`; $("rotaAc").hidden = true; loadAra(); return; }
    const g = gittiklerim();
    const ds = r.d.map(([s, ad]) => ARA.find((x) => x[2] === s && x[1] === ad)).filter(Boolean);
    let top = 0;
    ds.forEach((x, i) => { if (i) top += km({ lat: ds[i - 1][4], lng: ds[i - 1][5] }, { lat: x[4], lng: x[5] }); });
    const gid = ds.filter((x) => g.some((y) => y.s === x[2] && y.ad === x[1])).length;
    $("rotaSay").textContent = TL(`${ds.length} durak · duraklar arası yaklaşık ${fmt(top * 1.3)} yol` + (gid ? ` · ${gid}/${ds.length} gittin` : ""), `${ds.length} stops · about ${fmt(top * 1.3)} of driving` + (gid ? ` · ${gid}/${ds.length} visited` : ""));
    $("rotaList").innerHTML = ds.map((x, i) => {
      const il = (IDX.ilBy.get(x[2]) || {}).ad || "", ok = g.some((y) => y.s === x[2] && y.ad === x[1]);
      const ara = i ? `<span class="rara">↓ ~${fmt(km({ lat: ds[i - 1][4], lng: ds[i - 1][5] }, { lat: x[4], lng: x[5] }) * 1.3)}</span>` : "";
      return `<li>${ara}<button class="row res" data-yer="${x[2]}|${x[3]}"><span class="rno${ok ? " on" : ""}">${ok ? "✓" : i + 1}</span><span class="rt"><b>${esc(x[1])}</b><small>${esc(il)}</small></span><span class="km">${me ? fmt(km(me, { lat: x[4], lng: x[5] })) : "›"}</span></button></li>`;
    }).join("");
    const nk = (x) => x[4] + "," + x[5];
    const son = ds[ds.length - 1], ara = ds.slice(0, -1).map(nk).join("|");
    $("rotaAc").href = `https://www.google.com/maps/dir/?api=1&destination=${nk(son)}${ara ? "&waypoints=" + encodeURIComponent(ara) : ""}&travelmode=driving`;
    $("rotaAc").hidden = !ds.length;
  }
  // ---------- yer öner (e-posta taslağı açar) ----------
  const ILETISIM = "mertturanlioglu.apps@gmail.com";
  function yerOner() {
    const il = view && view.d ? view.d.ad : "";
    const d = document.createElement("div"); d.className = "tanit";
    d.innerHTML = `<form class="tkart oner"><div class="temo">📍</div><h2>${T("Yer öner")}</h2><p>${T("Uygulamada olmayan, gidip görülmeye değer bir yer mi biliyorsun? Yaz, inceleyip ekleyelim.")}</p>
      <label>${T("Yerin adı")}<input name="ad" required maxlength="80" placeholder="ör. Sütüven Şelalesi"></label>
      <label>${T("İl / ilçe")}<input name="il" maxlength="80" value="${esc(il)}" placeholder="ör. Balıkesir, Edremit"></label>
      <label>${T("Neden gidilmeli? (isteğe bağlı)")}<textarea name="not" rows="3" maxlength="500" placeholder="Kısa bir not, yol tarifi ipucu…"></textarea></label>
      <div class="tbtn"><button type="button" class="linkbtn" data-k="iptal">${T("Vazgeç")}</button><button class="btn primary">${T("Gönder")}</button></div></form>`;
    const kapat = () => { d.classList.add("out"); setTimeout(() => d.remove(), 300); };
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-k=iptal]")) kapat(); });
    d.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const govde = `Yer: ${f.get("ad")}\nİl/ilçe: ${f.get("il")}\nNot: ${f.get("not")}\n\n(Rota Cepte uygulamasından gönderildi)`;
      location.href = `mailto:${ILETISIM}?subject=${encodeURIComponent("Yer önerisi: " + f.get("ad"))}&body=${encodeURIComponent(govde)}`;
      kapat(); toast(T("Teşekkürler! E-posta uygulaman açılıyor."));
    });
    document.body.appendChild(d);
    setTimeout(() => d.querySelector("input").focus(), 50);
  }
  // ---------- ilk açılış rehberi ----------
  function tanitim() {
    try { if (localStorage.getItem("gezi-tanitim")) return; } catch (e) { return; }
    const s = [
      ["🗺️", T("81 ili keşfet"), T("Her ilde ve ilçede gezilecek yerler, fotoğraflar ve kısa bilgiler seni bekliyor.")],
      ["📍", T("Yakınındakileri bul"), T("Konumunu açarsan sana en yakın şelaleleri, kaleleri, müzeleri sıralarız.")],
      ["✅", T("Gittiğin yerleri işaretle"), T("\"Buraya gittim\" de, 81 ilden kaçını gezdiğini gör. Beğendiklerini kalple kaydet.")]
    ];
    let i = 0;
    const d = document.createElement("div"); d.className = "tanit";
    const ciz = () => {
      d.innerHTML = `<div class="tkart"><div class="temo">${s[i][0]}</div><h2>${s[i][1]}</h2><p>${s[i][2]}</p>
        <div class="tnok">${s.map((_, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("")}</div>
        <div class="tbtn"><button class="linkbtn" data-t="gec">${T("Geç")}</button><button class="btn primary" data-t="ileri">${i < s.length - 1 ? T("İleri") : T("Başlayalım")}</button></div></div>`;
    };
    const bitir = () => { try { localStorage.setItem("gezi-tanitim", "1"); } catch (e) {} d.classList.add("out"); setTimeout(() => d.remove(), 300); };
    d.addEventListener("click", (e) => {
      const b = e.target.closest("[data-t]"); if (!b) return;
      if (b.dataset.t === "gec" || i === s.length - 1) bitir(); else { i++; ciz(); }
    });
    ciz(); document.body.appendChild(d);
  }
  // ---------- keşif kartı: her açılışta rastgele, konum açıksa yakından ----------
  let kesifYuk = false, kesifYakin = false;
  async function gununKesfi() {
    if (kesifYuk && (kesifYakin || !me)) return;
    kesifYuk = true; kesifYakin = !!me;
    try {
      await loadAra(); if (!ARA) { kesifYuk = false; return; }
      let aday = ARA.filter((x) => x[7] === 1);
      if (me) {
        const u = aday.map((x) => [km(me, { lat: x[4], lng: x[5] }), x]).sort((a, b) => a[0] - b[0]);
        const yakin = u.filter((x) => x[0] <= 60);
        aday = (yakin.length >= 5 ? yakin : u.slice(0, 20)).map((x) => x[1]);
      }
      const x = aday[Math.floor(Math.random() * aday.length)]; if (!x) return;
      const d = await loadIl(x[2]); const p = d.yerler[x[3]]; if (!p) return;
      const k = foto(p.f, 960), k2 = foto(p.f, 500);
      const yer = esc([...new Set([p.ilce, p.il].filter(Boolean))].join(", "));
      $("gunun").innerHTML = `<button class="gunun" data-go="#/il/${d.s}/yer/${p.q}">${k ? `<img src="${k}" alt="" onerror="if(this.dataset.y){this.remove()}else{this.dataset.y=1;this.src='${k2}'}">` : ""}<span class="gtxt"><small>${me ? T("Yakınında keşfet") + " · " + fmt(km(me, p)) : T("Bugün keşfet")}</small><b>${esc(adi(p))}</b><span>${yer}</span></span></button>`;
    } catch (e) { kesifYuk = false; }
  }
  // ---------- gezi haritası: ilçelerini gezdikçe il boyanır ----------
  let HARITA = null, haritaSoz = null, HARITA_ORAN = new Map(), HARITA_KUTU = [80, 0, 1050, 585];
  async function renderHarita() {
    const kutu = $("gezHarita"); if (!kutu || !IDX) return;
    try {
      if (!HARITA) { haritaSoz = haritaSoz || getJSON("tr-harita.json?v=2"); HARITA = await haritaSoz; }
      const a = gittiklerim(), ilBy = new Map();
      for (const x of a) { if (!ilBy.has(x.s)) ilBy.set(x.s, []); ilBy.get(x.s).push(x); }
      const oran = new Map();
      for (const [s, liste] of ilBy) {
        const ozet = IDX.ilBy.get(s); if (!ozet) continue;
        let d = null; try { d = await loadIl(s); } catch (e) {}
        const toplam = ozet.ilceler.filter((z) => z[3] > 0).length || 1;
        const gidilen = new Set();
        for (const x of liste) { const y = d && d.yerler.find((t) => t.q === x.q); if (y && y.i >= 0) gidilen.add(y.i); }
        oran.set(s, Math.max(0.12, Math.min(1, gidilen.size / toplam)));
      }
      let tam = 0; HARITA_ORAN = oran;
      const yollar = Object.entries(HARITA).map(([s, d]) => {
        const il = IDX.ilBy.get(s); if (!il) return "";
        const o = oran.get(il.s) || 0; if (o >= 1) tam++;
        const renk = o >= 1 ? "#1f9d55" : o > 0 ? `color-mix(in srgb,#2fb36a ${Math.round(25 + o * 60)}%,var(--hbos))` : "var(--hbos)";
        return `<path d="${d}" style="fill:${renk}" data-go="#/il/${il.s}"><title>${esc(il.ad)}${o ? " · %" + Math.round(o * 100) : ""}</title></path>`;
      }).join("");
      kutu.innerHTML = `<svg viewBox="80 0 1050 585" class="trh" role="img" aria-label="${T("Gezi haritan")}">${yollar}</svg>
        <div class="hleg"><span><i style="background:var(--hbos)"></i>${T("Gitmedin")}</span><span><i style="background:color-mix(in srgb,#2fb36a 45%,var(--hbos))"></i>${T("Başladın")}</span><span><i style="background:#1f9d55"></i>${T("Tüm ilçeler")}</span></div>
        <p class="hnot">${a.length ? TL(`${ilBy.size} ile gittin${tam ? `, ${tam} ilin tüm ilçelerini gezdin 🏆` : ""}. Bir ilin ilçelerini gezdikçe rengi koyulaşır.`, `You've been to ${ilBy.size} provinces${tam ? `, all districts of ${tam} 🏆` : ""}. A province gets darker as you visit its districts.`) : TL(`Bir yere "Buraya gittim" dediğinde o il haritada yeşile boyanmaya başlar. İlçelerini gezdikçe rengi koyulaşır.`, `Tap "I've been here" on a place and its province turns green on the map. It gets darker as you visit its districts.`)}</p>`;
      try { const sv = kutu.querySelector("svg"), b = sv.getBBox(); if (b.width) { sv.setAttribute("viewBox", `${b.x - 4} ${b.y - 4} ${b.width + 8} ${b.height + 8}`); HARITA_KUTU = [b.x, b.y, b.width, b.height]; } } catch (e) {}
    } catch (e) {}
  }
  // ---------- gezi karnem: paylaşılabilir görsel ----------
  async function karne() {
    const a = gittiklerim(); if (!a.length) return;
    await renderHarita();
    const W = 1080, H = 1920, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), F = (w, px) => `${w} ${px}px Figtree, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const bg = g.createLinearGradient(0, 0, W * 0.4, H); bg.addColorStop(0, "#1d4a9e"); bg.addColorStop(0.55, "#0f2c66"); bg.addColorStop(1, "#071634");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const isik = g.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 700); isik.addColorStop(0, "rgba(245,181,68,.35)"); isik.addColorStop(1, "rgba(245,181,68,0)");
    g.fillStyle = isik; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.fillStyle = "#fff";
    try { const ik = new Image(); ik.src = "icon-192.png"; await ik.decode(); g.save(); g.beginPath(); g.roundRect(W / 2 - 150, 92, 64, 64, 16); g.clip(); g.drawImage(ik, W / 2 - 150, 92, 64, 64); g.restore(); } catch (e) {}
    g.font = F(800, 46); g.textAlign = "left"; g.fillText("Rota Cepte", W / 2 - 70, 140); g.textAlign = "center";
    g.font = F(800, 96); g.fillText(TL("Gezi Karnem", "My Travel Card"), W / 2, 300);
    const iller = new Set(a.map((x) => x.s)).size;
    g.textAlign = "left"; g.font = F(800, 230); const wN = g.measureText(String(iller)).width;
    g.font = F(700, 90); const w2 = g.measureText("/ 81").width, x0 = (W - wN - 24 - w2) / 2;
    g.font = F(800, 230); g.fillStyle = "#f5b544"; g.fillText(String(iller), x0, 540);
    g.font = F(700, 90); g.fillStyle = "rgba(255,255,255,.75)"; g.fillText("/ 81", x0 + wN + 24, 540); g.textAlign = "center";
    g.font = F(600, 44); g.fillStyle = "#fff"; g.fillText(TL("ili gezdim", "provinces visited"), W / 2, 620);
    // harita
    const [bx, by, bw, bh] = HARITA_KUTU, olc = 980 / bw, ox = (W - bw * olc) / 2, oy = 700;
    g.save(); g.translate(ox, oy); g.scale(olc, olc); g.translate(-bx, -by);
    for (const [s, d] of Object.entries(HARITA || {})) {
      const o = HARITA_ORAN.get(s) || 0, p = new Path2D(d);
      g.fillStyle = o >= 1 ? "#2fd17a" : o > 0 ? `rgba(47,209,122,${0.75 + o * 0.25})` : "rgba(255,255,255,.14)";
      g.fill(p); g.strokeStyle = "rgba(7,22,52,.9)"; g.lineWidth = 1.2 / olc * 1.6; g.stroke(p);
    }
    g.restore();
    // sayılar
    const R = rozetler(), rk = R.filter((x) => x.tamam);
    const kutu = (x, sayi, yazi) => {
      g.fillStyle = "rgba(255,255,255,.1)"; g.beginPath(); g.roundRect(x - 230, 1300, 460, 220, 36); g.fill();
      g.fillStyle = "#fff"; g.font = F(800, 96); g.fillText(sayi, x, 1420); g.font = F(600, 38); g.fillStyle = "rgba(255,255,255,.8)"; g.fillText(yazi, x, 1478);
    };
    kutu(W / 2 - 255, String(a.length), TL("yer gördüm", "places seen"));
    kutu(W / 2 + 255, `${rk.length}/${R.length}`, TL("rozet", "badges"));
    if (rk.length) { g.font = F(400, 64); g.fillStyle = "#fff"; g.fillText(rk.slice(0, 8).map((x) => x.e).join(" "), W / 2, 1640); }
    g.fillStyle = "#f5b544"; g.font = F(800, 50); g.fillText(T("Yol senin, rotan cepte!"), W / 2, 1770);
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = F(600, 36); g.fillText(TL("Sen de gez: me7rt.github.io/Rota-Cepte", "Explore too: me7rt.github.io/Rota-Cepte"), W / 2, 1835);
    const url = c.toDataURL("image/png");
    // önizleme + paylaş
    const d = document.createElement("div"); d.className = "tanit";
    d.innerHTML = `<div class="tkart karnek"><img src="${url}" alt=""><div class="tbtn"><button class="linkbtn" data-k="kapat">${T("Kapat")}</button><button class="btn primary" data-k="paylas">📤 ${TL("Paylaş", "Share")}</button></div></div>`;
    const kapat = () => { d.classList.add("out"); setTimeout(() => d.remove(), 300); };
    d.addEventListener("click", async (e) => {
      if (e.target === d || e.target.closest("[data-k=kapat]")) return kapat();
      if (!e.target.closest("[data-k=paylas]")) return;
      const metin = TL(`Türkiye'nin ${iller} ilini gezdim! Sen kaç ili gezdin? Rota Cepte ile bak: https://me7rt.github.io/Rota-Cepte/`, `I've visited ${iller} of Türkiye's 81 provinces! How many have you? https://me7rt.github.io/Rota-Cepte/`);
      const P = window.Capacitor && window.Capacitor.Plugins;
      try {
        if (P && P.Share && P.Filesystem) {
          const yaz = await P.Filesystem.writeFile({ path: "gezi-karnem.png", data: url.split(",")[1], directory: "CACHE" });
          await P.Share.share({ title: "Rota Cepte", text: metin, files: [yaz.uri] });
          return;
        }
        const blob = await (await fetch(url)).blob(), dosya = new File([blob], "gezi-karnem.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [dosya] })) { await navigator.share({ files: [dosya], text: metin }); return; }
        const l = document.createElement("a"); l.href = url; l.download = "gezi-karnem.png"; document.body.appendChild(l); l.click(); l.remove();
        toast(TL("Görsel indirildi. Galeriden paylaşabilirsin.", "Image saved. You can share it from your gallery."));
      } catch (err) { if (err && err.name !== "AbortError") toast(TL("Paylaşılamadı. Görsele basılı tutup kaydedebilirsin.", "Couldn't share. Long-press the image to save it.")); }
    });
    document.body.appendChild(d);
  }
  // ---------- paylaş ----------
  function paylas(p) {
    const url = `https://me7rt.github.io/Rota-Cepte/#/il/${p.ilS}/yer/${p.q}`;
    const yer = [...new Set([p.ilce, p.il].filter(Boolean))].join(", ");
    const metin = TL(`${p.ad} (${yer}) çok güzel bir yer, Rota Cepte uygulamasında buldum:`, `${adi(p)} (${yer}, Türkiye) is a beautiful place, I found it on Rota Cepte:`);
    if (navigator.share) navigator.share({ title: adi(p), text: metin, url }).catch(() => {});
    else window.open("https://wa.me/?text=" + encodeURIComponent(metin + " " + url), "_blank");
  }

  function renderHome() {
    if (!IDX) return;
    const q = $("search").value.trim();
    if (q.length >= 2) return renderSearch(q);
    renderFav(); renderGez(); gununKesfi();
    $("results").hidden = true; $("homeMain").hidden = false;
    const iller = IDX.iller.slice();
    if (me) iller.sort((a, b) => km(me, a) - km(me, b));
    $("ilGrid").innerHTML = iller.map((il) =>
      `<li><button class="ilcard" data-go="#/il/${il.s}">${thumb(il.f, "s", 500, "cover")}<span class="ilname"><b>${esc(il.ad)}</b><small>${me ? fmt(km(me, il)) + " · " : ""}${il.n} ${TL("yer", "places")} · ${il.ilceler.length} ${TL("ilçe", "districts")}</small></span></button></li>`).join("");
  }
  function renderSearch(q) {
    const s = sade(q);
    const res = [];
    for (const il of IDX.iller) {
      const a = sade(il.ad);
      if (a.includes(s)) res.push({ p: a.startsWith(s) ? 0 : 3, go: `#/il/${il.s}`, k: "s", ad: il.ad, alt: TL(`İl · ${il.n} yer · ${il.ilceler.length} ilçe`, `Province · ${il.n} places · ${il.ilceler.length} districts`) });
      il.ilceler.forEach((z, i) => {
        const b = sade(z[0]);
        if (b.includes(s)) res.push({ p: b.startsWith(s) ? 1 : 4, go: `#/il/${il.s}/ilce/${i}`, k: "y", ad: z[0], alt: TL(`${il.ad} ilçesi${z[3] ? " · " + z[3] + " yer" : ""}`, `District of ${il.ad}${z[3] ? " · " + z[3] + " places" : ""}`) });
      });
    }
    if (ARA) {
      for (const [b, ad, ils, j] of ARA) if (b.includes(s)) res.push({ p: b.startsWith(s) ? 2 : 5, yer: `${ils}|${j}`, k: "t", ad, alt: (IDX.ilBy.get(ils) || {}).ad || "" });
    } else loadAra();
    res.sort((a, b) => a.p - b.p || a.ad.localeCompare(b.ad, "tr"));
    $("homeMain").hidden = true; $("results").hidden = false;
    $("results").innerHTML = res.length
      ? res.slice(0, 80).map((r) =>
        `<li><button class="row res" ${r.go ? `data-go="${r.go}"` : `data-yer="${r.yer}"`}><span class="thumb" style="--c:${r.k === "t" ? CATS.t.renk : BOLGE_RENK}">${icon(r.k, 20)}</span><span class="rt"><b>${esc(r.ad)}</b><small>${esc(r.alt)}</small></span><span class="km">›</span></button></li>`).join("")
      : `<li class="empty">${ARA ? T("Sonuç bulunamadı.") : T("Aranıyor…")}</li>`;
  }

  // ---------- il / ilçe / yakın ekranları ----------
  function renderHero(h) {
    $("hero").hidden = false; $("hava").hidden = $("yemek").hidden = true;
    const src = foto(h.f, 960);
    $("heroImg").style.setProperty("--c", BOLGE_RENK);
    $("heroImg").innerHTML = icon("y", 40) + (src ? `<img src="${src}" alt="" onerror="fotoHata(this)">` : "");
    $("heroCredit").textContent = h.f && h.f.a ? (h.kapak ? h.kapak + " · " : "") + T("Fotoğraf:") + " " + h.f.a + " · Wikimedia Commons" : "";
    $("heroFacts").innerHTML = h.facts.filter(Boolean).map(([k, v]) => `<span>${esc(k)} <strong>${esc(v)}</strong></span>`).join("");
    $("heroText").textContent = h.m || "";
    $("heroText").classList.add("clamp");
    $("heroText").hidden = !h.m;
    $("heroMore").hidden = !h.m || h.m.length < 240;
    $("heroWiki").hidden = !h.w;
    $("heroWiki").href = wikiUrl(h.w);
    $("heroWiki").textContent = h.w && h.w.startsWith("en:") ? T("Vikipedi (İngilizce)") : T("Vikipedi'de oku");
  }
  const nufusBilgi = (o) => (o.nuf ? [T("Nüfus") + (o.nufY ? ` (${o.nufY})` : ""), nf(o.nuf)] : null);
  const alanBilgi = (o) => (o.alan ? [T("Yüzölçümü"), nf(o.alan) + " km²"] : null);

  function showIl(d, tab) {
    view = { mode: "il", d };
    show("city");
    $("eyebrow").textContent = d.plaka ? `${d.plaka} · ${T("İl")}` : T("İl");
    $("title").textContent = d.ad;
    renderHero({ f: d.f, kapak: d.kapak, m: DIL === "en" ? d.me : d.m, w: DIL === "en" ? d.we : d.w, facts: [nufusBilgi(d), alanBilgi(d), [TL("İlçe", "Districts"), d.ilceler.length], [T("Gezilecek yer"), d.yerler.length]] });
    $("tabs").hidden = false;
    $("tabBtnIlce").textContent = `${T("İlçeler")} (${d.ilceler.length})`;
    $("tabBtnYer").textContent = `${T("Gezilecek yerler")} (${d.yerler.length})`;
    havaGoster(IDX.ilBy.get(d.s) || d); yemekGoster(d);
    planBas = 0; planGoster(d);
    indirBtn();
    places = d.yerler; cat = "hepsi"; shown = 60; fitted = false;
    ilAraSifirla();
    sortMode = me ? "yakin" : "oner";
    setTab(tab);
  }
  function setTab(tab) {
    $("tabBtnYer").setAttribute("aria-selected", tab === "yer");
    $("tabBtnIlce").setAttribute("aria-selected", tab === "ilce");
    $("tabYer").hidden = tab !== "yer";
    $("tabIlce").hidden = tab !== "ilce";
    if (tab === "yer") { ensureMap(); renderAll(); }
    else renderIlceList(view.d);
  }
  function showIlce(d, i) {
    const z = d.ilceler[i];
    view = { mode: "ilce", d, i };
    show("city");
    $("eyebrow").textContent = `${d.ad} · ${T("İlçe")}`;
    $("title").textContent = z.ad;
    // Vikipedi metni olmayan ilçeler için kısa bilgi cümlesi
    const ilceMetin = DIL === "en"
      ? `${z.ad} is a district of ${d.ad} Province, Türkiye.${z.nuf ? ` Population: ${nf(z.nuf)}${z.nufY ? " (" + z.nufY + ")" : ""}.` : ""}`
      : z.m || `${z.ad}, ${d.ad} iline bağlı bir ilçedir.${z.nuf ? ` Nüfusu ${nf(z.nuf)}${z.nufY ? " (" + z.nufY + ")" : ""}.` : ""}${z.alan ? ` Yüzölçümü ${nf(z.alan)} km².` : ""}`;
    renderHero({ f: z.f, m: ilceMetin, w: DIL === "en" ? "" : z.w, facts: [nufusBilgi(z), alanBilgi(z), [T("Gezilecek yer"), z.n]] });
    $("tabs").hidden = true;
    places = d.yerler.filter((y) => y.i === i); cat = "hepsi"; shown = 60; fitted = false;
    // İlçede kayıtlı yer yoksa ilçe merkezine en yakın yerleri göster (35 km içinde)
    view.yakin = !places.length;
    if (view.yakin) places = d.yerler.map((y) => [y, km(z, y)]).filter((x) => x[1] < 35).sort((a, b) => a[1] - b[1]).slice(0, 15).map((x) => x[0]);
    ilAraSifirla();
    sortMode = me ? "yakin" : "oner";
    $("tabYer").hidden = false; $("tabIlce").hidden = true;
    ensureMap(); renderAll();
  }
  async function showNear(no) {
    view = { mode: "near" };
    show("city");
    $("eyebrow").textContent = T("Konumuna göre"); $("title").textContent = T("Yakınımdakiler");
    $("hero").hidden = true; $("tabs").hidden = true; $("tabYer").hidden = false; $("tabIlce").hidden = true;
    places = []; cat = "hepsi"; shown = 60; fitted = false; sortMode = "yakin";
    ilAraSifirla();
    ensureMap();
    if (!me) {
      renderAll();
      $("list").innerHTML = `<li class="empty">${T("Konumunu açınca sana en yakın yerleri burada canlı mesafeyle göreceksin.")}</li>`;
      startLocation(() => { if (view.mode === "near") route(); });
      return;
    }
    $("list").innerHTML = `<li class="empty">${T("Yükleniyor…")}</li>`;
    const yakin = IDX.iller.slice().sort((a, b) => km(me, a) - km(me, b)).slice(0, 3);
    const ds = await Promise.all(yakin.map((il) => loadIl(il.s)));
    if (no !== routeNo) return;
    places = ds.flatMap((d) => d.yerler).sort((a, b) => km(me, a) - km(me, b)).slice(0, 150);
    renderAll();
  }

  // ---------- liste ----------
  let ilAra = "";
  function visible() {
    let v = places;
    if (ilAra) v = v.filter((p) => sade(p.ad + " " + (p.ilce || "")).includes(ilAra));
    if (cat === "one") v = v.filter((p) => p.one);
    else if (cat !== "hepsi") v = v.filter((p) => p.k === cat);
    if (sortMode === "yakin" && me) v = v.slice().sort((a, b) => km(me, a) - km(me, b));
    else v = v.slice().sort((a, b) => (b.one || 0) - (a.one || 0) || b.sl - a.sl);
    return v;
  }
  function ilAraSifirla() { ilAra = ""; $("ilAra").value = ""; $("ilAraSil").hidden = true; }
  function renderAll() { renderChips(); renderSort(); renderList(); drawPins(); }
  function renderChips() {
    const say = (k) => places.filter((p) => (k === "one" ? p.one : p.k === k)).length;
    const items = [["hepsi", T("Hepsi"), places.length]];
    const one = say("one");
    if (one && one < places.length) items.push(["one", T("★ Öne çıkanlar"), one]);
    for (const k of Object.keys(CATS)) { const c = say(k); if (c) items.push([k, CATS[k].ad, c]); }
    $("chips").innerHTML = places.length ? items.map(([k, ad, c]) =>
      `<button data-k="${k}" aria-pressed="${cat === k}">${CATS[k] ? `<span class="dot" style="background:${CATS[k].renk}"></span>` : ""}${ad} <small>${c}</small></button>`).join("") : "";
  }
  function renderSort() {
    $("sortSeg").innerHTML = me && view.mode !== "near"
      ? `<button data-s="oner" aria-pressed="${sortMode !== "yakin"}">${T("Önerilen")}</button><button data-s="yakin" aria-pressed="${sortMode === "yakin"}">${T("En yakın")}</button>`
      : me ? T("En yakından uzağa") : T("Mesafe için konumu aç");
  }
  function altYazi(p) {
    if (view.mode === "near") return [...new Set([p.ilce, p.il].filter(Boolean))].join(", ");
    if (view.mode === "il") return [p.ilce, CATS[p.k].ad].filter(Boolean).join(" · ");
    return CATS[p.k].ad;
  }
  function renderList() {
    if (view.mode === "home") return;
    const v = visible();
    $("count").textContent = v.length ? `${v.length} ${TL("yer", "places")}` : "";
    if (!v.length) {
      $("list").innerHTML = view.mode === "ilce"
        ? `<li class="empty">${T("Bu ilçe için henüz fotoğraflı gezi noktası yok. İlin diğer yerlerine göz atabilirsin.")}</li>`
        : view.mode === "near" && !me ? $("list").innerHTML : ilAra ? `<li class="empty">${T("Bu isimde yer bulunamadı. Tüm Türkiye'de aramak için ana sayfadaki arama kutusunu kullan.")}</li>` : `<li class="empty">${T("Bu kategoride yer yok.")}</li>`;
      $("moreBtn").hidden = true;
      return;
    }
    const not = view.mode === "ilce" && view.yakin ? `<li class="empty">${TL("Bu ilçede kayıtlı gezi noktası yok. İlçe merkezine en yakın yerler:", "No places listed in this district yet. Nearest places to the district centre:")}</li>` : "";
    $("list").innerHTML = not + v.slice(0, shown).map((p) =>
      `<li><button class="row" data-s="${p.ilS}" data-j="${p.j}">${thumb(p.f, p.k)}<span class="rt"><b>${p.one ? `<i class="star" title="${T("Öne çıkan")}">★</i>` : ""}${esc(adi(p))}</b><small>${esc(altYazi(p))}</small></span><span class="km">${me ? fmt(km(me, p)) : ""}</span></button></li>`).join("");
    $("moreBtn").hidden = v.length <= shown;
    $("moreBtn").textContent = `${T("Daha fazla göster")} (${v.length - shown})`;
  }
  function renderIlceList(d) {
    $("ilceList").innerHTML = d.ilceler.map((z, i) =>
      `<li><button class="row" data-go="#/il/${d.s}/ilce/${i}">${thumb(z.f, "y")}<span class="rt"><b>${esc(z.ad)}</b><small>${z.n ? z.n + TL(" gezilecek yer", " places") : T("İlçe bilgisi")}${z.nuf ? " · " + nf(z.nuf) + TL(" kişi", " people") : ""}</small></span><span class="km" data-lat="${z.lat}" data-lng="${z.lng}">${me ? fmt(km(me, z)) : "›"}</span></button></li>`).join("");
  }

  // ---------- harita ----------
  function ensureMap() {
    if (map) { setTimeout(() => map.invalidateSize(), 60); return; }
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([39, 35], 6);
    const osm = () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
    if (HARITA_ANAHTAR) {
      // MapTiler çalışmazsa (kota, anahtar hatası) OpenStreetMap'e geç
      let hata = 0;
      const mt = L.tileLayer(`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${HARITA_ANAHTAR}`, { maxZoom: 19, attribution: "© MapTiler © OpenStreetMap" });
      mt.on("tileerror", () => { if (++hata === 4) { map.removeLayer(mt); osm().addTo(map); } });
      mt.addTo(map);
    } else osm().addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  function drawPins() {
    if (!map) return;
    layer.clearLayers();
    meMarker = null;
    const pts = [];
    for (const p of visible()) {
      const big = !!p.one, s = big ? 34 : 26;
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: "", html: `<div class="pin${big ? " big" : ""}" style="background:${CATS[p.k].renk}">${icon(p.k, big ? 16 : 13)}</div>`, iconSize: [s, s], iconAnchor: [s / 2, s / 2] }),
        title: p.ad, alt: p.ad, zIndexOffset: big ? 500 : 0
      }).on("click", () => openDetail(p)).addTo(layer);
      pts.push([p.lat, p.lng]);
    }
    drawMe();
    if (!fitted) {
      if (view.mode === "near" && me) pts.push([me.lat, me.lng]);
      const merkez = view.mode === "ilce" ? view.d.ilceler[view.i] : view.d;
      if (pts.length > 1) map.fitBounds(pts, { padding: [28, 28], maxZoom: 14 });
      else if (pts.length) map.setView(pts[0], 13);
      else if (merkez) map.setView([merkez.lat, merkez.lng], view.mode === "ilce" ? 11 : 9);
      else if (me) map.setView([me.lat, me.lng], 11);
      fitted = true;
    }
    setTimeout(() => map.invalidateSize(), 60);
  }
  function drawMe() {
    if (!map || !me) return;
    if (!meMarker) meMarker = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: "", html: '<div class="me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, zIndexOffset: 1000 }).addTo(layer);
    else meMarker.setLatLng([me.lat, me.lng]);
  }

  // ---------- detay ----------
  function renderFacts(p) {
    const parts = [me ? `<span>${T("Uzaklık")} <strong>${fmt(km(me, p))}</strong></span>` : `<span>${T("Mesafe için konumu aç")}</span>`];
    parts.push(`<span>${esc([...new Set([p.ilce, p.il].filter(Boolean))].join(", "))}</span>`);
    if (p.yil) parts.push(`<span>${p.k === "d" ? T("Kuruluş") : T("Yapım")} <strong>${esc(p.yil)}</strong></span>`);
    if (p.rak) parts.push(`<span>${T("Rakım")} <strong>${nf(p.rak)} m</strong></span>`);
    if (p.un) parts.push(`<span class="badge">${T("UNESCO Dünya Mirası")}</span>`);
    $("dFacts").innerHTML = parts.join("");
  }
  function openDetail(p) {
    open = p;
    const c = CATS[p.k];
    $("dTitle").textContent = adi(p);
    $("dTag").textContent = c.ad; $("dTag").style.background = c.renk;
    $("dPhoto").style.setProperty("--c", c.renk);
    $("dIcon").innerHTML = icon(p.k, 54);
    const src = foto(p.f, 960);
    $("dImg").innerHTML = src ? `<img src="${src}" alt="${esc(p.ad)}" onerror="fotoHata(this)">` : "";
    $("dCredit").textContent = p.f && p.f.a ? T("Fotoğraf:") + " " + p.f.a + " · Wikimedia Commons" : "";
    // Galeri: öne çıkan yerlerde ek fotoğraflar (dokununca büyük fotoğraf değişir)
    const gal = p.f && p.g && p.g.length ? [p.f, ...p.g] : [];
    $("dGaleri").hidden = !gal.length;
    $("dGaleri").innerHTML = gal.map((f, i) => `<button class="gk${i ? "" : " on"}" data-i="${i}" aria-label="${TL("Fotoğraf", "Photo")} ${i + 1}"><img src="${foto(f, 250)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>`).join("");
    renderFacts(p);
    favBtn(p); gitBtn(p); $("dFav").hidden = $("dShare").hidden = $("dGit").hidden = !p.q;
    dinleDurdur(); $("dDinle").hidden = !sesVar;
    const ipVar = p.ip && DIL !== "en";
    $("dTip").hidden = !ipVar; $("dTip").innerHTML = ipVar ? "<b>İpucu:</b> " + esc(p.ip) : "";
    let txt;
    if (DIL === "en") txt = p.me || `${adi(p)} is one of the places worth seeing in ${p.ilce ? p.ilce + ", " : ""}${p.il}, Türkiye.`;
    else {
      txt = p.m ? (p.en ? "(İngilizce kaynaktan) " : "") + p.m : "";
      if (!txt && p.ac) txt = `${p.ad}: ${p.ac}.`;
      if (!txt) txt = `${p.ad}, ${p.ilce ? p.ilce + " / " : ""}${p.il} içinde görülmeye değer yerlerden biri.`;
    }
    $("dText").textContent = txt;
    const q = `${p.lat},${p.lng}`;
    const hedef = p.gq ? encodeURIComponent(p.gq) : q;
    $("dMap").href = `https://www.google.com/maps/search/?api=1&query=${hedef}`;
    $("dDir").href = `https://www.google.com/maps/dir/?api=1&destination=${hedef}`;
    $("dYakin").innerHTML = [["🍽️", T("Yemek"), "restoran"], ["☕", T("Kafe"), "kafe"], ["🏨", T("Konaklama"), "otel"], ["⛽", T("Benzin"), "benzin istasyonu"], ["🅿️", T("Otopark"), "otopark"]].map(([e, ad, ara]) =>
      `<a class="ykn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent(ara)}/@${p.lat},${p.lng},15z">${e} ${ad}</a>`).join("");
    // Yakındaki gezilecek yerler (aynı ilde, 25 km içinde, en yakın 5)
    const il = IL.get(p.ilS);
    const cevre = il ? il.yerler.filter((y) => y !== p).map((y) => [y, km(p, y)]).filter((x) => x[1] < 25).sort((a, b) => a[1] - b[1]).slice(0, 5) : [];
    $("dCevreBas").hidden = !cevre.length;
    $("dCevreBas").textContent = TL("Yakındaki gezilecek yerler", "Nearby places to see");
    $("dCevre").innerHTML = cevre.map(([y, d]) => `<li><button class="row" data-s="${y.ilS}" data-j="${y.j}">${thumb(y.f, y.k)}<span class="rt"><b>${y.one ? `<i class="star">★</i>` : ""}${esc(adi(y))}</b><small>${esc(CATS[y.k].ad)}</small></span><span class="km">${fmt(d)}</span></button></li>`).join("");
    const wk = DIL === "en" ? p.we || p.w : p.w;
    $("dWiki").hidden = !wk;
    $("dWiki").href = wikiUrl(wk);
    $("dWiki").textContent = wk && wk.startsWith("en:") ? T("Vikipedi'de (İngilizce) oku") : T("Vikipedi'de devamını oku");
    $("sheet").querySelector(".card").scrollTop = 0;
    if ($("sheet").hidden) { history.pushState({ sheet: 1 }, "", location.href); sheetPushed = true; }
    $("sheet").hidden = false;
    $("dClose").focus({ preventScroll: true });
  }
  function hideSheet() { dinleDurdur(); $("sheet").hidden = true; open = null; sheetPushed = false; }
  function closeDetail() {
    if ($("sheet").hidden) return;
    const geri = sheetPushed;
    hideSheet();
    if (geri) history.back();
  }

  // ---------- olaylar ----------
  let araZaman = null;
  function araTemizle() { $("search").value = ""; $("araSil").hidden = true; renderHome(); }
  $("search").addEventListener("input", () => { $("araSil").hidden = !$("search").value; clearTimeout(araZaman); araZaman = setTimeout(renderHome, 120); });
  $("araSil").addEventListener("click", () => { araTemizle(); $("search").blur(); window.scrollTo(0, 0); });
  $("results").addEventListener("click", (e) => { if (e.target.closest("[data-go],[data-yer]")) setTimeout(araTemizle, 0); });
  $("search").addEventListener("focus", () => { if (IDX) loadAra(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) { git(b.dataset.go); return; }
    const y = e.target.closest("[data-yer]");
    if (y) { const [s, j] = y.dataset.yer.split("|"); bekleyenYer = { s, j: +j }; git(`#/il/${s}`); }
  });
  $("ilAra").addEventListener("input", () => { ilAra = sade($("ilAra").value.trim()); $("ilAraSil").hidden = !ilAra; shown = 60; renderList(); drawPins(); });
  $("ilAraSil").addEventListener("click", () => { ilAraSifirla(); renderList(); drawPins(); $("ilAra").focus(); });
  $("nearBtn").addEventListener("click", () => git("#/yakin"));
  $("dilBtn").textContent = TL("🌐 English", "🌐 Türkçe");
  $("dilBtn").addEventListener("click", () => dilDegistir(TL("en", "tr")));
  $("locBtn").addEventListener("click", () => { if (watchId !== null) stopLocation(); else startLocation(); });
  $("temaLoc").addEventListener("click", () => startLocation());
  $("back").addEventListener("click", () => {
    if (view.mode === "ilce") git(`#/il/${view.d.s}/ilceler`);
    else git("#/");
  });
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b || !view.d) return;
    history.replaceState(null, "", `#/il/${view.d.s}${b.dataset.tab === "ilce" ? "/ilceler" : ""}`);
    setTab(b.dataset.tab);
  });
  $("chips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; cat = b.dataset.k; shown = 60; fitted = false; renderChips(); renderList(); drawPins(); });
  $("sortSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; sortMode = b.dataset.s; renderSort(); renderList(); });
  $("moreBtn").addEventListener("click", () => { shown += 60; renderList(); });
  $("list").addEventListener("click", (e) => {
    const b = e.target.closest(".row"); if (!b) return;
    const d = IL.get(b.dataset.s); if (d) openDetail(d.yerler[+b.dataset.j]);
  });
  $("heroMore").addEventListener("click", () => { $("heroText").classList.remove("clamp"); $("heroMore").hidden = true; });
  $("dClose").addEventListener("click", closeDetail);
  $("dGaleri").addEventListener("click", (e) => {
    const b = e.target.closest(".gk"); if (!b || !open) return;
    const gal = [open.f, ...(open.g || [])]; const f = gal[+b.dataset.i]; if (!f) return;
    $("dImg").innerHTML = `<img src="${foto(f, 960)}" alt="${esc(adi(open))}" onerror="fotoHata(this)">`;
    $("dCredit").textContent = f.a ? T("Fotoğraf:") + " " + f.a + " · Wikimedia Commons" : "";
    for (const x of $("dGaleri").children) x.classList.toggle("on", x === b);
  });
  $("dCevre").addEventListener("click", (e) => {
    const b = e.target.closest(".row"); if (!b) return;
    const d = IL.get(b.dataset.s); if (d) { dinleDurdur(); openDetail(d.yerler[+b.dataset.j]); }
  });
  $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeDetail(); });
  $("dFav").addEventListener("click", () => { if (open) favDegis(open); });
  $("dShare").addEventListener("click", () => { if (open) paylas(open); });
  $("dGit").addEventListener("click", () => { if (open) gitDegis(open); });
  document.querySelectorAll(".onerbtn").forEach((b) => b.addEventListener("click", yerOner));
  $("dDinle").addEventListener("click", dinle);
  $("gezBtn").addEventListener("click", () => { $("gezList").hidden = !$("gezList").hidden; });
  $("karneBtn").addEventListener("click", karne);
  $("indirBtn").addEventListener("click", ilIndir);
  $("plan").addEventListener("click", (e) => {
    if (e.target.closest("#planYeni")) { planBas++; planGoster(view.d); return; }
    const b = e.target.closest(".row"); if (!b) return;
    const d = IL.get(b.dataset.s); if (d) openDetail(d.yerler[+b.dataset.j]);
  });
  $("paylasBtn").addEventListener("click", uygulamaPaylas);
  puanSor();
  $("indirSil").addEventListener("click", ilIndirSil);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
  window.addEventListener("popstate", () => { if (!$("sheet").hidden) hideSheet(); });
  window.addEventListener("hashchange", route);

  // ---------- Android geri tuşu (yalnızca uygulama içinde) ----------
  const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (CapApp && CapApp.addListener) {
    let cikisZamani = 0;
    CapApp.addListener("backButton", (e) => {
      const modal = document.querySelector(".tanit");
      if (modal) { modal.remove(); return; }
      if (!$("sheet").hidden) { closeDetail(); return; }
      const ev = !location.hash || location.hash === "#/" || location.hash === "#";
      if (!ev) { if (e && e.canGoBack) history.back(); else git("#/"); return; }
      if ($("search").value) { araTemizle(); return; }
      if (Date.now() - cikisZamani < 2000) { CapApp.exitApp(); return; }
      cikisZamani = Date.now(); toast(T("Çıkmak için tekrar geri bas"));
    });
  }
  // ---------- özel günler: milli bayramlar, anma günleri, dini bayramlar ----------
  async function ozelGun() {
    try {
      const o = await getJSON(`ozel-gunler.json?v=${SURUM}`);
      const n = new Date(), iki = (x) => String(x).padStart(2, "0");
      const gun = `${n.getFullYear()}-${iki(n.getMonth() + 1)}-${iki(n.getDate())}`;
      const g = o.sabit[gun.slice(5)] || (o.degisken || []).find((x) => gun >= x.bas && gun <= x.bit);
      if (!g) return;
      const msj = TL(g.tr, g.en || g.tr);
      // açılış ekranı
      const t2 = document.querySelector(".sp-tag2"); if (t2) { t2.textContent = `${g.e} ${msj}`; t2.classList.add("sp-ozel"); }
      if (g.yas) document.documentElement.classList.add("yas");
      // ana sayfa şeridi
      const b = $("ozelGun");
      b.innerHTML = `<i>${g.e}</i><span><b>${esc(msj)}</b>${g.bayram ? `<small>${TL("Bayram tatili için hazır rotalara göz at ›", "Browse ready-made routes for the holiday ›")}</small>` : ""}</span>`;
      b.classList.toggle("yas", !!g.yas); b.hidden = false;
      if (g.bayram) b.onclick = () => { const r = $("rotaSec"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" }); };
    } catch (e) {}
  }
  ozelGun();
  temaChips();
  rotaKartlar();
  route();
  setTimeout(tanitim, 5200);
  // Konum izni daha önce verildiyse sessizce başlat
  let kapali = false; try { kapali = !!localStorage.getItem("gezi-konum-kapali"); } catch (e) {}
  if (!kapali && navigator.permissions) navigator.permissions.query({ name: "geolocation" }).then((s) => { if (s.state === "granted") startLocation(); }).catch(() => {});
})();
