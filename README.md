# Rota Cepte

**Yol senin, rotan cepte!**

Türkiye'nin 81 ili ve tüm ilçelerinde gezilecek yerler: harita, canlı konuma göre mesafe, her yer için fotoğraf ve bilgi, tek dokunuşla Google Maps'te yol tarifi. Hazır rotalar, gideceğim yerler listesi, gezi haritası ve rozetler, Gezi karnesi paylaşımı, hava durumu, yöresel lezzetler ve sesli anlatım.

- Uygulama: `docs/` (GitHub Pages buradan yayınlanır)
- Hazır veri: `docs/data/` (`index.json` iller ve ilçeler, `il/<il>.json` her ilin yerleri, `ara.json` arama listesi)
- Veri hazırlama: `scripts/uret.mjs`, GitHub Actions'ta "Veri hazirla" iş akışıyla çalışır. Wikidata'dan il, ilçe ve fotoğraflı yerleri, Vikipedi'den metinleri, Commons'tan fotoğraf yazar/lisans bilgisini toplar.
- Fotoğraf kontrolü: `scripts/kontrol.py` küçük resim sayfaları üretir ve `kontrol` dalına yükler.
- Vikipedi maddesi olmayan popüler yerler: `data/elle-yerler.json`, il kapak fotoğrafı seçimi: `data/il-kapak.json`
- Resmî ilçe listesi (973 ilçe): `data/ilceler.json`. Wikidata kayıtları bu listeyle eşlenir.
- Deneme: "Veri hazirla" iş akışını `gorev: dene` ile çalıştırınca sonuç main yerine `veri-deneme` dalına yazılır (önce bakıp sonra birleştirmek için).
- Elle seçilmiş öne çıkan yerler: `data/yerler-ham.json` (il → [Vikipedi sayfa adı, kategori]), ipuçları `data/ipuclari.json`
- Elle düzeltmeler (isteğe bağlı, dosya yoksa atlanır): `data/foto-duzelt.json` (`yasak`: kullanılmayacak dosyalar, `zorla`: Wikidata no → dosya adı, `cikar`: listeden çıkarılacak Wikidata no)
- Diller: Türkçe ve İngilizce (`docs/i18n.js`, İngilizce yer metinleri `docs/data/en/`)
- Android: Capacitor ile paketlenir; her push'ta `apk.yml` APK ve Play paketi (AAB) üretir
- Kategoriler: t = Tarihi, d = Doğa & Manzara, m = Müze, c = Çarşı & Lezzet, s = Şehir & Semt

Bilgiler Vikipedi (CC BY-SA), fotoğraflar Wikimedia Commons (her fotoğrafın yazarı ve lisansı uygulamada gösterilir), harita © OpenStreetMap katkıcıları.

## Telif

© 2026 Mert Turanlıoğlu. Tüm hakları saklıdır. Kod, tasarım, ikon ve açılış ekranı izinsiz kopyalanamaz, başka bir adla yayınlanamaz veya mağazalara yüklenemez. Ayrıntılar: [LICENSE](LICENSE).
