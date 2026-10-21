/* Gezi Rehberi · © 2026 Mert Turanlıoğlu · Tüm hakları saklıdır. İzinsiz kopyalanamaz ve yayınlanamaz.
   Gezi Rehberi 3: 81 il, tüm ilçeler, canlı konum.
   Veri docs/data altında; GitHub Actions'ta Wikidata, Vikipedi ve Commons'tan hazırlanır (scripts/uret.mjs). */
(function () {
  "use strict";
  const SURUM = "3.2";

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
    t: { ad: "Tarihi", renk: "#1f4fa3" },
    d: { ad: "Doğa & Manzara", renk: "#2f7d5b" },
    m: { ad: "Müze", renk: "#13707a" },
    c: { ad: "Çarşı & Lezzet", renk: "#c2462e" },
    s: { ad: "Şehir & Semt", renk: "#7a3f8c" }
  };
  const BOLGE_RENK = "#5b6f77";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sade = (s) => String(s).toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  const nf = (n) => Number(n).toLocaleString("tr-TR");
  function km(a, b) {
    const R = 6371, r = (x) => (x * Math.PI) / 180;
    const dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmt = (d) => (d < 1 ? Math.round(d * 100) * 10 + " m" : d < 100 ? d.toFixed(1).replace(".", ",") + " km" : nf(Math.round(d)) + " km");
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ---------- fotoğraf ve bağlantılar ----------
  const COM = "https://upload.wikimedia.org/wikipedia/commons/";
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
    return `<span class="${cls || "thumb"}" style="--c:${renk}">${icon(k, cls === "cover" ? 34 : 22)}${src ? `<img src="${src}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}</span>`;
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
    IDX.ilBy = new Map(IDX.iller.map((i) => [i.s, i]));
    const s = IDX.surum || "";
    $("ver").textContent = `Sürüm ${SURUM} · Veri ${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)} · ${nf(IDX.iller.reduce((t, i) => t + i.n, 0))} yer, ${nf(IDX.iller.reduce((t, i) => t + i.ilceler.length, 0))} ilçe`;
  }
  async function loadIl(s) {
    if (IL.has(s)) return IL.get(s);
    const d = await getJSON(`data/il/${s}.json?v=${IDX.surum}`);
    d.yerler.forEach((y, j) => { y.j = j; y.il = d.ad; y.ilS = d.s; y.ilce = y.i >= 0 && d.ilceler[y.i] ? d.ilceler[y.i].ad : ""; });
    IL.set(s, d);
    return d;
  }
  async function loadAra() {
    if (ARA || araYukleniyor) return;
    araYukleniyor = true;
    try {
      const a = await getJSON(`data/ara.json?v=${IDX.surum}`);
      ARA = a.map(([ad, s, j]) => [sade(ad), ad, s, j]);
      if (!$("home").hidden) renderHome();
    } catch { araYukleniyor = false; }
  }

  // ---------- durum ----------
  let me = null, watchId = null;
  let view = { mode: "home" };
  let places = [], cat = "hepsi", sortMode = "oner", shown = 60;
  let map = null, layer = null, meMarker = null, fitted = false;
  let open = null, sheetPushed = false, bekleyenYer = null, homeMe = null, sonSira = 0, routeNo = 0;

  // ---------- konum ----------
  function startLocation(cb) {
    if (!navigator.geolocation) { toast("Bu cihaz konumu desteklemiyor."); return; }
    if (watchId !== null) { if (me && cb) cb(); return; }
    let first = true;
    $("locText").textContent = "Konum aranıyor…";
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        me = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        $("locBtn").classList.add("on");
        $("locText").textContent = "Konum açık";
        $("nearSub").textContent = "Sana en yakın gezilecek yerler, canlı mesafeyle";
        if (first) { first = false; if (view.mode !== "home") sortMode = "yakin"; onMove(true); if (cb) cb(); }
        else onMove(false);
      },
      (err) => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        $("locBtn").classList.remove("on");
        $("locText").textContent = "Konum kapalı";
        toast(err.code === 1 ? "Konum izni verilmedi. Ayarlardan izin verebilirsin." : "Konum bulunamadı, tekrar dene.");
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
    $("city").hidden = v !== "city";
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
          show("city"); $("eyebrow").textContent = "İl"; $("title").textContent = ozet.ad;
          $("hero").hidden = true; $("tabs").hidden = true; $("tabIlce").hidden = true; $("tabYer").hidden = false;
          $("chips").innerHTML = ""; $("count").textContent = ""; $("moreBtn").hidden = true;
          $("list").innerHTML = '<li class="empty">Yükleniyor…</li>';
        }
        const d = await loadIl(h[1]);
        if (no !== routeNo) return;
        if (h[2] === "ilce" && d.ilceler[+h[3]]) showIlce(d, +h[3]);
        else showIl(d, h[2] === "ilceler" ? "ilce" : "yer");
        if (bekleyenYer && bekleyenYer.s === d.s) { const p = d.yerler[bekleyenYer.j]; bekleyenYer = null; if (p) openDetail(p); }
        return;
      }
      if (h[0] === "yakin") return await showNear(no);
      showHome();
    } catch (e) {
      if (no !== routeNo) return;
      show("home"); $("homeMain").hidden = false; $("results").hidden = true;
      $("ilGrid").innerHTML = '<li class="empty">Veriler yüklenemedi. İnternet bağlantını kontrol edip <button class="linkbtn" id="retry">tekrar dene</button>.</li>';
      $("retry").onclick = route;
    }
  }
  const git = (h) => { if (location.hash === h) route(); else location.hash = h; };

  // ---------- ana sayfa ----------
  function showHome() {
    view = { mode: "home" }; show("home");
    $("eyebrow").textContent = "Gezi Rehberi"; $("title").textContent = "Nereye gidiyorsun?";
    renderHome();
  }
  function renderHome() {
    if (!IDX) return;
    const q = $("search").value.trim();
    if (q.length >= 2) return renderSearch(q);
    $("results").hidden = true; $("homeMain").hidden = false;
    const iller = IDX.iller.slice();
    if (me) iller.sort((a, b) => km(me, a) - km(me, b));
    $("ilGrid").innerHTML = iller.map((il) =>
      `<li><button class="ilcard" data-go="#/il/${il.s}">${thumb(il.f, "s", 500, "cover")}<span class="ilname"><b>${esc(il.ad)}</b><small>${me ? fmt(km(me, il)) + " · " : ""}${il.n} yer · ${il.ilceler.length} ilçe</small></span></button></li>`).join("");
  }
  function renderSearch(q) {
    const s = sade(q);
    const res = [];
    for (const il of IDX.iller) {
      const a = sade(il.ad);
      if (a.includes(s)) res.push({ p: a.startsWith(s) ? 0 : 3, go: `#/il/${il.s}`, k: "s", ad: il.ad, alt: `İl · ${il.n} yer · ${il.ilceler.length} ilçe` });
      il.ilceler.forEach((z, i) => {
        const b = sade(z[0]);
        if (b.includes(s)) res.push({ p: b.startsWith(s) ? 1 : 4, go: `#/il/${il.s}/ilce/${i}`, k: "y", ad: z[0], alt: `${il.ad} ilçesi${z[3] ? " · " + z[3] + " yer" : ""}` });
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
      : `<li class="empty">${ARA ? "Sonuç bulunamadı." : "Aranıyor…"}</li>`;
  }

  // ---------- il / ilçe / yakın ekranları ----------
  function renderHero(h) {
    $("hero").hidden = false;
    const src = foto(h.f, 960);
    $("heroImg").style.setProperty("--c", BOLGE_RENK);
    $("heroImg").innerHTML = icon("y", 40) + (src ? `<img src="${src}" alt="" onerror="this.remove()">` : "");
    $("heroCredit").textContent = h.f && h.f.a ? "Fotoğraf: " + h.f.a + " · Wikimedia Commons" : "";
    $("heroFacts").innerHTML = h.facts.filter(Boolean).map(([k, v]) => `<span>${esc(k)} <strong>${esc(v)}</strong></span>`).join("");
    $("heroText").textContent = h.m || "";
    $("heroText").classList.add("clamp");
    $("heroText").hidden = !h.m;
    $("heroMore").hidden = !h.m || h.m.length < 240;
    $("heroWiki").hidden = !h.w;
    $("heroWiki").href = wikiUrl(h.w);
    $("heroWiki").textContent = h.w && h.w.startsWith("en:") ? "Vikipedi (İngilizce)" : "Vikipedi'de oku";
  }
  const nufusBilgi = (o) => (o.nuf ? ["Nüfus" + (o.nufY ? ` (${o.nufY})` : ""), nf(o.nuf)] : null);
  const alanBilgi = (o) => (o.alan ? ["Yüzölçümü", nf(o.alan) + " km²"] : null);

  function showIl(d, tab) {
    view = { mode: "il", d };
    show("city");
    $("eyebrow").textContent = d.plaka ? `${d.plaka} · İl` : "İl";
    $("title").textContent = d.ad;
    renderHero({ f: d.f, m: d.m, w: d.w, facts: [nufusBilgi(d), alanBilgi(d), ["İlçe", d.ilceler.length], ["Gezilecek yer", d.yerler.length]] });
    $("tabs").hidden = false;
    $("tabBtnIlce").textContent = `İlçeler (${d.ilceler.length})`;
    $("tabBtnYer").textContent = `Gezilecek yerler (${d.yerler.length})`;
    places = d.yerler; cat = "hepsi"; shown = 60; fitted = false;
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
    $("eyebrow").textContent = `${d.ad} · İlçe`;
    $("title").textContent = z.ad;
    renderHero({ f: z.f, m: z.m, w: z.w, facts: [nufusBilgi(z), alanBilgi(z), ["Gezilecek yer", z.n]] });
    $("tabs").hidden = true;
    places = d.yerler.filter((y) => y.i === i); cat = "hepsi"; shown = 60; fitted = false;
    sortMode = me ? "yakin" : "oner";
    $("tabYer").hidden = false; $("tabIlce").hidden = true;
    ensureMap(); renderAll();
  }
  async function showNear(no) {
    view = { mode: "near" };
    show("city");
    $("eyebrow").textContent = "Konumuna göre"; $("title").textContent = "Yakınımdakiler";
    $("hero").hidden = true; $("tabs").hidden = true; $("tabYer").hidden = false; $("tabIlce").hidden = true;
    places = []; cat = "hepsi"; shown = 60; fitted = false; sortMode = "yakin";
    ensureMap();
    if (!me) {
      renderAll();
      $("list").innerHTML = '<li class="empty">Konumunu açınca sana en yakın yerleri burada canlı mesafeyle göreceksin.</li>';
      startLocation(() => { if (view.mode === "near") route(); });
      return;
    }
    $("list").innerHTML = '<li class="empty">Yükleniyor…</li>';
    const yakin = IDX.iller.slice().sort((a, b) => km(me, a) - km(me, b)).slice(0, 3);
    const ds = await Promise.all(yakin.map((il) => loadIl(il.s)));
    if (no !== routeNo) return;
    places = ds.flatMap((d) => d.yerler).sort((a, b) => km(me, a) - km(me, b)).slice(0, 150);
    renderAll();
  }

  // ---------- liste ----------
  function visible() {
    let v = places;
    if (cat === "one") v = v.filter((p) => p.one);
    else if (cat !== "hepsi") v = v.filter((p) => p.k === cat);
    if (sortMode === "yakin" && me) v = v.slice().sort((a, b) => km(me, a) - km(me, b));
    else v = v.slice().sort((a, b) => (b.one || 0) - (a.one || 0) || b.sl - a.sl);
    return v;
  }
  function renderAll() { renderChips(); renderSort(); renderList(); drawPins(); }
  function renderChips() {
    const say = (k) => places.filter((p) => (k === "one" ? p.one : p.k === k)).length;
    const items = [["hepsi", "Hepsi", places.length]];
    const one = say("one");
    if (one && one < places.length) items.push(["one", "★ Öne çıkanlar", one]);
    for (const k of Object.keys(CATS)) { const c = say(k); if (c) items.push([k, CATS[k].ad, c]); }
    $("chips").innerHTML = places.length ? items.map(([k, ad, c]) =>
      `<button data-k="${k}" aria-pressed="${cat === k}">${CATS[k] ? `<span class="dot" style="background:${CATS[k].renk}"></span>` : ""}${ad} <small>${c}</small></button>`).join("") : "";
  }
  function renderSort() {
    $("sortSeg").innerHTML = me && view.mode !== "near"
      ? `<button data-s="oner" aria-pressed="${sortMode !== "yakin"}">Önerilen</button><button data-s="yakin" aria-pressed="${sortMode === "yakin"}">En yakın</button>`
      : me ? "En yakından uzağa" : "Mesafe için konumu aç";
  }
  function altYazi(p) {
    if (view.mode === "near") return [p.ilce, p.il].filter(Boolean).join(", ");
    if (view.mode === "il") return [p.ilce, CATS[p.k].ad].filter(Boolean).join(" · ");
    return CATS[p.k].ad;
  }
  function renderList() {
    if (view.mode === "home") return;
    const v = visible();
    $("count").textContent = v.length ? `${v.length} yer` : "";
    if (!v.length) {
      $("list").innerHTML = view.mode === "ilce"
        ? '<li class="empty">Bu ilçe için henüz fotoğraflı gezi noktası yok. İlin diğer yerlerine göz atabilirsin.</li>'
        : view.mode === "near" && !me ? $("list").innerHTML : '<li class="empty">Bu kategoride yer yok.</li>';
      $("moreBtn").hidden = true;
      return;
    }
    $("list").innerHTML = v.slice(0, shown).map((p) =>
      `<li><button class="row" data-s="${p.ilS}" data-j="${p.j}">${thumb(p.f, p.k)}<span class="rt"><b>${p.one ? '<i class="star" title="Öne çıkan">★</i>' : ""}${esc(p.ad)}</b><small>${esc(altYazi(p))}</small></span><span class="km">${me ? fmt(km(me, p)) : ""}</span></button></li>`).join("");
    $("moreBtn").hidden = v.length <= shown;
    $("moreBtn").textContent = `Daha fazla göster (${v.length - shown})`;
  }
  function renderIlceList(d) {
    $("ilceList").innerHTML = d.ilceler.map((z, i) =>
      `<li><button class="row" data-go="#/il/${d.s}/ilce/${i}">${thumb(z.f, "y")}<span class="rt"><b>${esc(z.ad)}</b><small>${z.n ? z.n + " gezilecek yer" : "İlçe bilgisi"}${z.nuf ? " · " + nf(z.nuf) + " kişi" : ""}</small></span><span class="km" data-lat="${z.lat}" data-lng="${z.lng}">${me ? fmt(km(me, z)) : "›"}</span></button></li>`).join("");
  }

  // ---------- harita ----------
  function ensureMap() {
    if (map) { setTimeout(() => map.invalidateSize(), 60); return; }
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([39, 35], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
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
    const parts = [me ? `<span>Uzaklık <strong>${fmt(km(me, p))}</strong></span>` : `<span>Mesafe için konumu aç</span>`];
    parts.push(`<span>${esc([p.ilce, p.il].filter(Boolean).join(", "))}</span>`);
    if (p.yil) parts.push(`<span>${p.k === "d" ? "Kuruluş" : "Yapım"} <strong>${esc(p.yil)}</strong></span>`);
    if (p.rak) parts.push(`<span>Rakım <strong>${nf(p.rak)} m</strong></span>`);
    if (p.un) parts.push(`<span class="badge">UNESCO Dünya Mirası</span>`);
    $("dFacts").innerHTML = parts.join("");
  }
  function openDetail(p) {
    open = p;
    const c = CATS[p.k];
    $("dTitle").textContent = p.ad;
    $("dTag").textContent = c.ad; $("dTag").style.background = c.renk;
    $("dPhoto").style.setProperty("--c", c.renk);
    $("dIcon").innerHTML = icon(p.k, 54);
    const src = foto(p.f, 960);
    $("dImg").innerHTML = src ? `<img src="${src}" alt="${esc(p.ad)}" onerror="this.remove()">` : "";
    $("dCredit").textContent = p.f && p.f.a ? "Fotoğraf: " + p.f.a + " · Wikimedia Commons" : "";
    renderFacts(p);
    $("dTip").hidden = !p.ip; $("dTip").innerHTML = p.ip ? "<b>İpucu:</b> " + esc(p.ip) : "";
    let txt = p.m ? (p.en ? "(İngilizce kaynaktan) " : "") + p.m : "";
    if (!txt && p.ac) txt = `${p.ad}: ${p.ac}.`;
    if (!txt) txt = `${p.ad}, ${p.ilce ? p.ilce + " / " : ""}${p.il} içinde görülmeye değer yerlerden biri.`;
    $("dText").textContent = txt;
    const q = `${p.lat},${p.lng}`;
    $("dMap").href = `https://www.google.com/maps/search/?api=1&query=${q}`;
    $("dDir").href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    $("dWiki").hidden = !p.w;
    $("dWiki").href = wikiUrl(p.w);
    $("dWiki").textContent = p.w && p.w.startsWith("en:") ? "Vikipedi'de (İngilizce) oku" : "Vikipedi'de devamını oku";
    $("sheet").querySelector(".card").scrollTop = 0;
    if ($("sheet").hidden) { history.pushState({ sheet: 1 }, "", location.href); sheetPushed = true; }
    $("sheet").hidden = false;
    $("dClose").focus({ preventScroll: true });
  }
  function hideSheet() { $("sheet").hidden = true; open = null; sheetPushed = false; }
  function closeDetail() {
    if ($("sheet").hidden) return;
    const geri = sheetPushed;
    hideSheet();
    if (geri) history.back();
  }

  // ---------- olaylar ----------
  let araZaman = null;
  $("search").addEventListener("input", () => { clearTimeout(araZaman); araZaman = setTimeout(renderHome, 120); });
  $("search").addEventListener("focus", () => { if (IDX) loadAra(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) { git(b.dataset.go); return; }
    const y = e.target.closest("[data-yer]");
    if (y) { const [s, j] = y.dataset.yer.split("|"); bekleyenYer = { s, j: +j }; git(`#/il/${s}`); }
  });
  $("nearBtn").addEventListener("click", () => git("#/yakin"));
  $("locBtn").addEventListener("click", () => startLocation());
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
  $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
  window.addEventListener("popstate", () => { if (!$("sheet").hidden) hideSheet(); });
  window.addEventListener("hashchange", route);

  route();
  // Konum izni daha önce verildiyse sessizce başlat
  if (navigator.permissions) navigator.permissions.query({ name: "geolocation" }).then((s) => { if (s.state === "granted") startLocation(); }).catch(() => {});
})();
