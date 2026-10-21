// Wikidata yapısını anlamak için tek seferlik teşhis sorguları
const UA = "RotaCepte/0.3 (https://github.com/me7rt/RotaCepte)";
async function sparql(q) {
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } });
  if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 300));
  return (await r.json()).results.bindings;
}
const v = (b, k) => (b[k] ? b[k].value.replace("http://www.wikidata.org/entity/", "") : "");
const L = 'SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }';

console.log("== 1. il sınıfı");
for (const b of await sparql(`SELECT ?cls ?clsLabel (COUNT(?il) AS ?n) WHERE { wd:Q406 wdt:P131 ?il . ?il wdt:P31 ?cls . ${L} } GROUP BY ?cls ?clsLabel`)) console.log(v(b,"cls"), v(b,"clsLabel"), v(b,"n"));
for (const b of await sparql(`SELECT (COUNT(?il) AS ?n) WHERE { ?il wdt:P31 wd:Q48336 . FILTER NOT EXISTS { ?il wdt:P576 ?e } }`)) console.log("Q48336 sayısı:", v(b,"n"));

console.log("== 2. il içindeki doğrudan birimlerin sınıfları");
for (const b of await sparql(`SELECT ?cls ?clsLabel (COUNT(DISTINCT ?x) AS ?n) WHERE { ?il wdt:P31 wd:Q48336 . ?x wdt:P131 ?il . ?x wdt:P31 ?cls . ${L} } GROUP BY ?cls ?clsLabel ORDER BY DESC(?n) LIMIT 25`)) console.log(v(b,"cls"), v(b,"clsLabel"), v(b,"n"));

console.log("== 3. Türkiye'de fotoğraflı + koordinatlı + trwiki maddeli yerlerin sınıfları");
for (const b of await sparql(`SELECT ?cls ?clsLabel (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x wdt:P17 wd:Q43 ; wdt:P18 ?img ; wdt:P625 ?c ; wdt:P31 ?cls . ?a schema:about ?x ; schema:isPartOf <https://tr.wikipedia.org/> . ${L} } GROUP BY ?cls ?clsLabel ORDER BY DESC(?n) LIMIT 300`)) console.log(v(b,"cls"), "|", v(b,"clsLabel"), "|", v(b,"n"));
