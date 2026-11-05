# TTSC Takım

TTSC Buchen için kulüp içi kayıt ve oyuncu gelişimi uygulaması (prototip).

**Aç:** https://mehmetustattsc.github.io/TTSC/

## Yapı

Giriş → ana sayfa (sıradaki etkinlik + kare modüller). Herkes sadece rolünün izin verdiği modülleri görür.

| Modül | Oyuncu | Antrenör | Yönetim | Admin |
|---|:-:|:-:|:-:|:-:|
| Takvim (maç, antrenman, kulüp etkinliği; geliyorum/gelemiyorum) | ✓ | ✓ + ekler, maç kaydı | ✓ + ekler | ✓ + ekler |
| Mesajlar: takım sohbeti | ✓ | ✓ | ✓ | ✓ |
| Mesajlar: yönetim sohbeti | – | – | ✓ | ✓ |
| Mesajlar: özel notlar (antrenör ↔ oyuncu) | kendi notları | hepsi | – | – |
| İstatistik (takım, oyuncular, benim) | ✓ | ✓ | ✓ + CSV | ✓ + CSV |
| Oyunlar | ✓ | ✓ | ✓ | ✓ |
| Oyuncu takibi (durum, uyarılar, katılım) | – | ✓ | ✓ | ✓ |
| Üye takibi (aidat) | – | – | ✓ | ✓ + rol atama |
| Kulüp evi (etkinlikler, arızalar) | – | – | ✓ | ✓ |

Geri bildirim etiketleri ve mazeretler anahtar olarak saklanır, herkes kendi dilinde görür. Serbest yazılan notların ve sohbetin otomatik çevirisi sunucu adımında gelecek (tablolarda yeri hazır).

## Prototip sınırları

- Veriler Supabase'te (AB). Giriş: e-postaya gelen 6 haneli kod; sadece davet edilen adresler rol alır. Giriş ekranındaki "Önce demoyu dene" uydurma verilerle sadece o cihazda çalışır.
- Demo verisi uydurmadır (isimler, rakipler, skorlar).

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html`, `css/app.css` | Sayfa ve tasarım |
| `js/app.js` | Ekranlar ve akışlar |
| `js/store.js` | Veri katmanı: sunucu modu + demo verisi |
| `js/remote.js`, `js/config.js` | Supabase bağlantısı (giriş kodu, tablolar) |
| `js/i18n.js` | Dört dil (TR/DE/EN/FR), etiketler, mazeretler |
| `afis.html` | Yazdırılabilir katılma afişi (A4, QR kod) |
| `assets/join-qr.svg` | Uygulama adresinin QR kodu (nayuki QR-Code-generator ile üretildi, MIT) |
| `datenschutz.html` | Datenschutzhinweise (DE, TR) – Entwurf, gelbe Stellen vom Vorstand ergänzen |
| `assets/fonts/` | Barlow-Schriften, lokal (kein Google-Aufruf), SIL OFL |
| `sw.js`, `manifest.webmanifest` | Ana ekrana ekleme ve internetsiz açılış |
| `supabase/schema.sql` | Sunucu tabloları, davet listesi, rol ve gizlilik kuralları |
| `tests/i18n.spec.mjs` | Dört dilde de aynı anahtarlar ve {yer tutucular} var mı |
| `tests/server.spec.mjs` | Gerçek veritabanı + şema ile çok kişili uçtan uca test |
| `tests/smoke.spec.mjs` | Tüm roller ve ana akışlar için tarayıcı testi (gizlilik kontrolleri dahil) |
| `.github/workflows/ci.yml` | Her gönderimde test, geçerse GitHub Pages'e yayın |
