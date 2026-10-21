# Gezi Rehberi

Türkiye'nin 81 ili ve tüm ilçelerinde gezilecek yerler: harita, canlı konuma göre mesafe, her yer için fotoğraf ve bilgi, tek dokunuşla Google Maps'te yol tarifi.

- Uygulama: `docs/` (GitHub Pages buradan yayınlanır)
- Hazır veri: `docs/data/` (`index.json` iller ve ilçeler, `il/<il>.json` her ilin yerleri, `ara.json` arama listesi)
- Veri hazırlama: `scripts/uret.mjs`, GitHub Actions'ta "Veri hazirla" iş akışıyla çalışır. Wikidata'dan il, ilçe ve fotoğraflı yerleri, Vikipedi'den metinleri, Commons'tan fotoğraf yazar/lisans bilgisini toplar.
- Fotoğraf kontrolü: `scripts/kontrol.py` küçük resim sayfaları üretir ve `kontrol` dalına yükler.
- Elle seçilmiş öne çıkan yerler: `data/yerler-ham.json` (il → [Vikipedi sayfa adı, kategori]), ipuçları `data/ipuclari.json`
- Elle düzeltmeler: `data/foto-duzelt.json` (`yasak`: kullanılmayacak dosyalar, `zorla`: Wikidata no → dosya adı, `cikar`: listeden çıkarılacak Wikidata no)
- Kategoriler: t = Tarihi, d = Doğa & Manzara, m = Müze, c = Çarşı & Lezzet, s = Şehir & Semt

Bilgiler Vikipedi (CC BY-SA), fotoğraflar Wikimedia Commons (her fotoğrafın yazarı ve lisansı uygulamada gösterilir), harita © OpenStreetMap katkıcıları.
