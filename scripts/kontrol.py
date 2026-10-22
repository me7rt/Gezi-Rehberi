# Fotoğrafları gözle kontrol etmek için küçük resim sayfaları (kontak baskı) üretir.
# Girdi: kontrol/liste.json (uret.mjs yazar). Çıktı: kontrol/sayfa-XXX.jpg ve kontrol/sayfalar.txt
import json, os, io, time, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont

UA = "RotaCepte/1.0 (https://github.com/me7rt/Rota-Cepte; kontrol betigi)"
K = "kontrol"
liste = json.load(open(f"{K}/liste.json", encoding="utf-8"))

BASLA = time.time()
SURE = 20 * 60  # en fazla 20 dakika indir, kalanları atla

def url(e, W=250):
    p = e["p"]; ad = p.split("/")[-1]
    if e["w"] <= W: return "https://upload.wikimedia.org/wikipedia/commons/" + p
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{p}/{W}px-{ad}"

def indir(e):
    err = ""
    for d in range(4):
        if time.time() - BASLA > SURE: return None
        try:
            req = urllib.request.Request(url(e), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return Image.open(io.BytesIO(r.read())).convert("RGB")
        except urllib.error.HTTPError as ex:
            err = str(ex)
            bekle = ex.headers.get("Retry-After") if ex.headers else None
            time.sleep(min(int(bekle) if bekle and bekle.isdigit() else 3 + 5 * d, 30))
        except Exception as ex:
            err = str(ex)
            time.sleep(2 + 4 * d)
    print("indirilemedi", e["ad"], err)
    return None

with ThreadPoolExecutor(4) as ex:
    resimler = list(ex.map(indir, liste))

def ahash(im):
    g = im.convert("L").resize((8, 8))
    px = list(g.getdata()); m = sum(px) / 64
    return sum(1 << i for i, v in enumerate(px) if v > m)

def suphe(im):
    # Haritalar, logolar, çizimler: az renk, büyük düz alanlar, çok beyaz
    s = im.resize((64, 48)).quantize(16)
    h = sorted(s.histogram()[:16], reverse=True)
    top3 = sum(h[:3]) / (64 * 48)
    beyaz = sum(1 for p in im.resize((64, 48)).getdata() if min(p) > 225) / (64 * 48)
    return top3, beyaz

for e, im in zip(liste, resimler):
    e["ok"] = im is not None
    if not im: e["suphe"] = "indirilemedi"; continue
    e["hash"] = ahash(im)
    top3, beyaz = suphe(im)
    e["top3"], e["beyaz"] = round(top3, 2), round(beyaz, 2)
    nedenler = []
    if top3 > 0.72: nedenler.append(f"az renk {top3:.2f}")
    if beyaz > 0.3: nedenler.append(f"beyaz {beyaz:.2f}")
    if e["kaynak"] in ("yakın", "kategori", "arama", "elle", "maddesiz"): nedenler.append("yedek kaynak")
    e["suphe"] = ", ".join(nedenler)

# Aynı ilde birbirine çok benzeyen fotoğraflar
il_grup = {}
for i, e in enumerate(liste):
    if e.get("hash") is not None: il_grup.setdefault(e["il"], []).append(i)
benzer = []
for il, idx in il_grup.items():
    for a in range(len(idx)):
        for b in range(a + 1, len(idx)):
            ea, eb = liste[idx[a]], liste[idx[b]]
            if ea["dosya"] == eb["dosya"]: continue
            if bin(ea["hash"] ^ eb["hash"]).count("1") <= 4:
                benzer.append((il, ea["ad"], eb["ad"]))
                eb["suphe"] = (eb["suphe"] + ", " if eb["suphe"] else "") + "benzer: " + ea["ad"]

try:
    F1 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    F2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except Exception:
    F1 = F2 = ImageFont.load_default()

TW, TH, LH, COLS, ROWS = 240, 170, 38, 6, 5
sira = sorted(range(len(liste)), key=lambda i: (0 if liste[i]["suphe"] else 1, {"il": 0, "one": 1, "ilce": 2, "yer": 3}[liste[i]["tur"]], liste[i]["il"]))
satirlar = []
for s, start in enumerate(range(0, len(sira), COLS * ROWS)):
    grup = sira[start:start + COLS * ROWS]
    sheet = Image.new("RGB", (COLS * TW, ROWS * (TH + LH)), "white")
    d = ImageDraw.Draw(sheet)
    for j, i in enumerate(grup):
        e = liste[i]; no = start + j + 1
        x, y = (j % COLS) * TW, (j // COLS) * (TH + LH)
        im = resimler[i]
        if im:
            im = im.copy(); im.thumbnail((TW - 6, TH - 4))
            sheet.paste(im, (x + (TW - im.width) // 2, y + 2 + (TH - 4 - im.height) // 2))
        else:
            d.rectangle([x + 3, y + 2, x + TW - 3, y + TH - 2], fill="#c33")
        renk = "#b00" if e["suphe"] else "#000"
        d.text((x + 4, y + TH + 1), f"{no} {e['ad']}"[:30], font=F1, fill=renk)
        d.text((x + 4, y + TH + 19), f"{e['il']} · {e['tur']} · {e['kaynak']}"[:36], font=F2, fill="#555")
    sheet.save(f"{K}/sayfa-{s + 1:03d}.jpg", quality=72)
    for j, i in enumerate(grup):
        e = liste[i]
        satirlar.append(f"{start + j + 1}\tsayfa {s + 1}\t{e['tur']}\t{e['il']}\t{e['ad']}\t{e['kaynak']}\t{e['suphe']}\t{e['dosya']}")

with open(f"{K}/sayfalar.txt", "w", encoding="utf-8") as f:
    f.write("no\tsayfa\ttur\til\tad\tkaynak\tsuphe\tdosya\n" + "\n".join(satirlar) + "\n")
with open(f"{K}/benzer.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(f"{a}\t{b}\t{c}" for a, b, c in benzer) + "\n")
print("sayfa:", (len(sira) + COLS * ROWS - 1) // (COLS * ROWS), "| şüpheli:", sum(1 for e in liste if e["suphe"]), "| benzer çift:", len(benzer))
