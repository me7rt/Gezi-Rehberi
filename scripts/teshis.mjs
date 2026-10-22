// Wikidata/Vikipedi/OSM yapısını anlamak için tek seferlik teşhis sorguları (Veri hazirla > gorev: teshis)
const UA = "RotaCepte/1.0 (https://github.com/me7rt/Rota-Cepte; teshis)";
async function sparql(q) {
  const r = await fetch("https://query.wikidata.org/sparql", { method: "POST", headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ query: q }) });
  if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 300));
  return (await r.json()).results.bindings;
}
async function getJ(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return "HTTP " + r.status;
  return r.json();
}
const v = (b, k) => (b[k] ? b[k].value.replace("http://www.wikidata.org/entity/", "") : "");
const L = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }';
const dene = async (ad, f) => { console.log("== " + ad); try { await f(); } catch (e) { console.log("HATA", String(e).slice(0, 300)); } };

await dene("1. İl başına ilçe sayısı: sıkı / gevşek", async () => {
  const sik = new Map(), gev = new Map();
  for (const b of await sparql(`SELECT ?ilLabel (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x p:P31 ?s1 . ?s1 ps:P31 wd:Q1147395 . FILTER NOT EXISTS { ?s1 pq:P582 [] }
    ?x p:P131 ?s2 . ?s2 ps:P131 ?il . FILTER NOT EXISTS { ?s2 pq:P582 [] } ?il wdt:P31 wd:Q48336 . FILTER NOT EXISTS { ?x wdt:P576 [] } ?x wdt:P625 [] . ${L} } GROUP BY ?ilLabel`)) sik.set(v(b, "ilLabel"), +v(b, "n"));
  for (const b of await sparql(`SELECT ?ilLabel (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x wdt:P31 wd:Q1147395 ; wdt:P131 ?il . ?il wdt:P31 wd:Q48336 . ${L} } GROUP BY ?ilLabel`)) gev.set(v(b, "ilLabel"), +v(b, "n"));
  for (const [k, n] of gev) if (n !== sik.get(k)) console.log(k, "sıkı", sik.get(k) || 0, "gevşek", n);
});

await dene("2. Siirt'in eksik ilçeleri: etiketle bul, P31/P131 ve niteleyicileri", async () => {
  for (const b of await sparql(`SELECT ?x ?l ?cls ?clsLabel ?end ?up ?upLabel ?upEnd ?rank ?dis WHERE {
    VALUES ?l { "Baykan"@tr "Eruh"@tr "Kurtalan"@tr "Pervari"@tr "Şirvan"@tr "Tillo"@tr "Adaklı"@tr "Karlıova"@tr "Akçakale"@tr "Harran"@tr "Kumluca"@tr }
    ?x rdfs:label ?l . ?x wdt:P17 wd:Q43 .
    ?x p:P31 ?s1 . ?s1 ps:P31 ?cls . OPTIONAL { ?s1 pq:P582 ?end } OPTIONAL { ?s1 wikibase:rank ?rank }
    OPTIONAL { ?x p:P131 ?s2 . ?s2 ps:P131 ?up . OPTIONAL { ?s2 pq:P582 ?upEnd } }
    OPTIONAL { ?x wdt:P576 ?dis }
    ${L} } LIMIT 200`)) console.log(v(b, "l"), v(b, "x"), "|", v(b, "cls"), v(b, "clsLabel"), v(b, "end") ? "BİTTİ" : "", v(b, "rank").split("#")[1] || "", "| üst:", v(b, "upLabel"), v(b, "upEnd") ? "BİTTİ" : "", v(b, "dis") ? "P576" : "");
});

await dene("3. ilçe sınıfının alt sınıfları ve 'ilçe' etiketli sınıflar", async () => {
  for (const b of await sparql(`SELECT ?c ?cLabel (COUNT(?x) AS ?n) WHERE { ?x wdt:P31 ?c . ?x wdt:P17 wd:Q43 . ?c rdfs:label ?l . FILTER(LANG(?l)="tr" && CONTAINS(LCASE(?l), "ilçe")) ${L} } GROUP BY ?c ?cLabel`)) console.log(v(b, "c"), v(b, "cLabel"), v(b, "n"));
});

await dene("4. Nominatim", async () => {
  for (const q of ["Sütüven Şelalesi, Edremit, Balıkesir", "Hasanboğuldu, Edremit, Balıkesir", "Kızılkeçili, Edremit, Balıkesir", "Harbiye Şelalesi, Hatay", "Şavşat Karagöl, Artvin"]) {
    const j = await getJ("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&countrycodes=tr&accept-language=tr&q=" + encodeURIComponent(q));
    console.log(q, "=>", typeof j === "string" ? j : JSON.stringify(j.map((x) => [x.name, x.category, x.type, x.lat, x.lon, x.address && (x.address.province || x.address.state), x.address && (x.address.town || x.address.county)])));
    await new Promise((r) => setTimeout(r, 1200));
  }
});

await dene("5. Wikidata arama", async () => {
  for (const q of ["Sütüven", "Hasanboğuldu", "Harbiye Şelalesi", "Şavşat Karagöl", "Kaleiçi", "Sultanahmet Camii"]) {
    const j = await getJ("https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=tr&uselang=tr&limit=5&search=" + encodeURIComponent(q));
    console.log(q, "=>", typeof j === "string" ? j : JSON.stringify((j.search || []).map((x) => [x.id, x.label, x.description])));
  }
});

await dene("6. Vikipedi arama", async () => {
  for (const q of ["Sultan Ahmed Camii", "Harbiye Şelalesi Hatay", "Kaleiçi Antalya", "Ulu Cami Bursa", "Şavşat Karagöl", "Deyrulzafaran Manastırı", "Şeytan Sofrası Ayvalık", "Cennet ve Cehennem Obrukları"]) {
    const j = await getJ("https://tr.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=4&srsearch=" + encodeURIComponent(q));
    console.log(q, "=>", typeof j === "string" ? j : (j.query.search || []).map((x) => x.title).join(" | "));
  }
});

await dene("7. Maddesiz ama fotoğraflı + Türkçe etiketli doğa/tarih yerleri (sınıf başına)", async () => {
  for (const b of await sparql(`SELECT ?c ?cLabel (COUNT(DISTINCT ?x) AS ?n) WHERE {
    VALUES ?c { wd:Q34038 wd:Q23397 wd:Q8502 wd:Q35509 wd:Q150784 wd:Q40080 wd:Q23442 wd:Q39816 wd:Q46169 wd:Q179049 wd:Q177380 wd:Q23413 wd:Q839954 wd:Q15661340 wd:Q12518 wd:Q32815 wd:Q16970 wd:Q12280 wd:Q1785071 wd:Q33506 }
    ?x wdt:P31 ?c ; wdt:P17 wd:Q43 ; wdt:P18 [] ; wdt:P625 [] ; rdfs:label ?l . FILTER(LANG(?l)="tr")
    FILTER NOT EXISTS { ?a schema:about ?x ; schema:isPartOf <https://tr.wikipedia.org/> }
    FILTER NOT EXISTS { ?b schema:about ?x ; schema:isPartOf <https://en.wikipedia.org/> }
    ${L} } GROUP BY ?c ?cLabel`)) console.log(v(b, "c"), v(b, "cLabel"), v(b, "n"));
});

await dene("8. Commons dosya arama", async () => {
  for (const q of ["Sütüven", "Hasanboğuldu", "Kızılkeçili"]) {
    const j = await getJ("https://commons.wikimedia.org/w/api.php?action=query&list=search&format=json&srnamespace=6&srlimit=10&srsearch=" + encodeURIComponent(q));
    console.log(q, "=>", typeof j === "string" ? j : (j.query.search || []).map((x) => x.title).join(" | "));
  }
});
