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

- Veriler şimdilik **sadece o cihazın tarayıcısında** saklanıyor (`js/store.js`). Ortak sunucu Supabase olacak: tablolar ve yetki kuralları `supabase/schema.sql` içinde hazır ve test edildi.
- Giriş ekranında herkes herhangi bir kişiyi seçebiliyor; bu sadece rolleri denemek için.
- Demo verisi uydurmadır (isimler, rakipler, skorlar).

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html`, `css/app.css` | Sayfa ve tasarım |
| `js/app.js` | Ekranlar ve akışlar |
| `js/store.js` | Veri katmanı + demo verisi (sunucuya geçişte sadece bu değişir) |
| `js/i18n.js` | Dört dil (TR/DE/EN/FR), etiketler, mazeretler |
| `sw.js`, `manifest.webmanifest` | Ana ekrana ekleme ve internetsiz açılış |
| `supabase/schema.sql` | Sunucu tabloları, davet listesi, rol ve gizlilik kuralları |
| `tests/i18n.spec.mjs` | Dört dilde de aynı anahtarlar ve {yer tutucular} var mı |
| `tests/smoke.spec.mjs` | Tüm roller ve ana akışlar için tarayıcı testi (gizlilik kontrolleri dahil) |
| `.github/workflows/ci.yml` | Her gönderimde test, geçerse GitHub Pages'e yayın |
