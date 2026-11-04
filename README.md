# TTSC Takım

TTSC Buchen için kulüp içi kayıt ve oyuncu gelişimi uygulaması (prototip).

**Aç:** https://mehmetustattsc.github.io/TTSC/

## Ne var?

| Ekran | Kimin için | İçerik |
|---|---|---|
| Ana sayfa | Herkes | Sıradaki etkinlik, geliyorum / gelemiyorum + mazeret, oynayabilir / kısıtlı / sakat durumu, form |
| Ana sayfa | Antrenör, yönetim | Uyarılar: maça az oyuncu, cevapsız oyuncular, üst üste antrenman kaçıranlar, sakatlar |
| Takvim | Herkes | Antrenman ve maçlar; antrenör yeni etkinlik ekler (haftalık tekrar) |
| Etkinlik | Antrenör | Antrenmanda katılımı onaylama, maçta 30 saniyelik maç kaydı (skor, dakika, gol, asist, kart) |
| Kadro / Profil | Herkes | Katılım oranı, maç, dakika, gol, asist, kart, son etkinlikler şeridi |
| Profil (gizli bölüm) | Oyuncunun kendisi + antrenörler | Antrenör notları, öz değerlendirme (yıldız + etiket), oyuncudan antrenöre geri bildirim |
| İstatistik | Herkes | G-B-M, gol farkı, maç grafiği, gol krallığı, sıralanabilir tablo, CSV (yönetim/antrenör) |
| Ben | Herkes | Dil (TR/DE/EN/FR), oyun köşesi, demo sıfırlama |

Geri bildirim etiketleri ve mazeretler anahtar olarak saklanır: Türkçe yazan antrenörün seçtiği "Pas" etiketini Alman oyuncu "Passspiel" olarak görür.

## Prototip sınırları

- Veriler şimdilik **sadece o cihazın tarayıcısında** saklanıyor (`js/store.js`). Herkesin aynı veriyi görmesi için sonraki adım ortak bir sunucu (ör. Supabase) ve gerçek giriş.
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
| `tests/i18n.spec.mjs` | Dört dilde de aynı anahtarlar ve {yer tutucular} var mı |
| `tests/smoke.spec.mjs` | Tüm roller ve ana akışlar için tarayıcı testi (gizlilik kontrolleri dahil) |
| `.github/workflows/ci.yml` | Her gönderimde test, geçerse GitHub Pages'e yayın |
