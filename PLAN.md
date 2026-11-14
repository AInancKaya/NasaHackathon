# TerraTrend — NASA Space Apps 2026 "Be An Earth System Trend Detective!" Planı

## Context

Şu an: 225 satır Streamlit (`app.py`, `nasa_api.py`, `stats_engine.py`). Tek nokta, 3 değişken, Türkçe arayüz. Çalışıyor ama sıradan.
Hedef: Global Nominee, ilk %10. Teslim: **15 Kasım Pazar 23:59 yerel**. Tek kişi. Claude Pro limiti dar.
Kararlar (kullanıcı onayladı): **FastAPI + React + 3D küre**, tek kişi, çalışma anında LLM yok (kural tabanlı).

Görev metninin kalbi: *"aynı değişken bir bölgede artar, başka bölgede azalır."* Rakiplerin çoğu tek nokta grafiği yapar. Biz bunu **kürede gösteririz**. Fark burada.

PDF'ten çıkan sert kurallar:
- Her şey **İngilizce** (arayüz, README, slayt, proje sayfası). Mevcut arayüz Türkçe → çevrilecek.
- Demo: **en çok 7 slayt** veya **en çok 30 sn video**. Aşan elenir.
- Linkler herkese açık, girişsiz. Gizli pencerede dene.
- NASA logosu/amblemi **yasak**. SI kullanımı kodda ve metinde açık yazılacak.
- En az bir NASA verisi şart. Partner ajans verisi artı puan.
- Jüri ölçütü: Impact, Creativity, Validity, Relevance, Presentation.

## Doğrulanmış gerçek veri kaynakları (bugün denendi, hepsi girişsiz)

| Kaynak | Ne için | Durum |
|---|---|---|
| NASA POWER point API | Nokta zaman serisi (MERRA-2, CERES) | Mevcut kodda çalışıyor |
| NASA POWER regional API (`/temporal/monthly/regional`) | Kutu ortalaması (≤10°×10°) | HTTP 200, 1.2 sn |
| NASA POWER Zarr, AWS açık kova `nasa-power` (`merra2/temporal/power_merra2_monthly_temporal_utc.zarr`, ayrıca `imerg/`, `syn1deg/`, `srb/`) | **Küresel trend haritası** | Kova listelendi, anonim |
| Open-Meteo archive (Copernicus ERA5) | "İkinci tanık" çapraz doğrulama | HTTP 200 |

Sentetik veri yok. Depoya veri dosyası konmaz. Önbellek = canlı kaynaktan çekilmiş veri + çekim zamanı damgası (arayüzde görünür).

## Ürün: 4 kazandıran özellik

1. **Küresel Trend Küresi.** Seçilen değişken için her hücrede Sen eğimi (renk) + anlamlılık (anlamsız hücre soluk). Küreye tıkla → o yer için dosya açılır.
2. **Vaka Dosyası (nokta/bölge analizi).** Zaman serisi + mevsimsellikten arındırılmış anomali + trend + %95 GA. Dört soru kartı: *What / Where / How much / Significant?*
3. **Zıt İkiz.** Analiz edilen yerin tersine, anlamlı biçimde giden en güçlü hücreyi bul, küreyi oraya uçur. Görev cümlesinin birebir karşılığı.
4. **Dedektif akışı.** 3 soruluk sihirbaz (ne merak ediyorsun / nerede / ne tür yer) → değişken önerisi. 4–5 hazır "Case File" turu (demo). Her değişken için sade tanım.

Geçerlilik (Validity) farkı — hepsi gerçek, atıflı yöntem:
- Mevsimsel Mann-Kendall + Sen eğimi + eğim GA (var).
- **Otokorelasyon düzeltmesi** (Hamed-Rao; `pymannkendall` içinde hazır).
- Haritada **çoklu test düzeltmesi** (Benjamini-Hochberg FDR; Wilks 2016).
- **"Anlamlı olması için kaç yıl daha?"** (Weatherhead 1998 formülü). Görev ipucu: "bazen sadece daha uzun süre gerekir."
- **İkinci tanık:** NASA MERRA-2 trendi ile ERA5 trendi aynı yönde mi?

## Mimari (tek depo, tek dağıtım)

```
backend/
  catalog.py        # ~10 değişken: id, kaynak, param, birim, tanım, "why it matters"
  sources/power_point.py   # nasa_api.py'den taşınır (fetch_monthly aynen)
  sources/power_region.py  # regional API, cos(lat) ağırlıklı ortalama
  sources/power_grid.py    # xarray+zarr, anonim S3, ~2° seyrek küresel ızgara
  sources/era5.py          # Open-Meteo
  stats/trend.py    # stats_engine.py'den taşınır (analyze_trend) + Hamed-Rao + years-to-detect
  stats/field.py    # vektörel hücre-başı mevsimsel MK + Sen + BH-FDR
  main.py           # FastAPI; frontend/dist'i statik sunar
frontend/           # Vite + React + TS, globe.gl, Plotly
  Globe, CaseFile, EvidenceChart, VerdictCards, Wizard, CaseFiles, Glossary
docs/CONTRACT.md    # API şeması — tüm oturumların tek ortak kaynağı
Dockerfile          # frontend build → FastAPI tek konteyner → Hugging Face Spaces
```

Yeniden kullanım: `nasa_api.py:fetch_monthly`, `nasa_api.py:VARIABLES` (kataloğun çekirdeği), `stats_engine.py:analyze_trend` (metin alanları İngilizceye, dönüşten DataFrame yerine liste). `app.py` silinir.

API sözleşmesi (P0'da `docs/CONTRACT.md` olarak dondurulur):
- `GET /api/variables` → katalog
- `GET /api/series?var&lat&lon[&box]&start&end` → `{dates, values, anomaly, fit, lo, hi, stats{mk_p, mk_p_hr, tau, sen_per_decade, sen_ci, reg…, ttest…, n, years_to_detect}, verdict{what, where, how_much, significant}, source, fetched_at}`
- `GET /api/witness?var&lat&lon&start&end` → ERA5 eğimi, p, `agrees`
- `GET /api/trendmap?var` → `{lats, lons, slope[][], sig[][], period, fetched_at}`
- `GET /api/twin?var&lat&lon` → zıt yönde en güçlü anlamlı hücre
- `GET /api/cases` → hazır vaka listesi (yalnız konum+değişken+atıf; sayı yok, sayılar canlı hesaplanır)

## Oturum / model / dal planı (tek kişi, Pro limiti)

Kural: her iş paketi = **yeni sohbet + kendi dalı**. Sohbet yalnız `CLAUDE.md` + `docs/CONTRACT.md` + kendi klasörünü okur. Bitince PR, birleştir, sohbeti kapat. Aynı anda en çok 2 oturum (biri backend, biri frontend; dosyalar çakışmaz). Alt-ajan sürüsü yok.

| # | Dal | Model | İş | Süre |
|---|---|---|---|---|
| S0 | `main` | Sonnet | git init, GitHub (public), iskelet, `CLAUDE.md` (Karpathy kuralları + "sentetik veri yok" + "English only"), `docs/CONTRACT.md`. **Kapı:** Zarr'dan 2° ızgara okuma süresini ölç | 1 sa |
| S1 | `feat/stats` | **Opus** | `stats/trend.py` + `stats/field.py`. Vektörel MK'yi `pymannkendall` ile 20 hücrede karşılaştıran test | 2.5 sa |
| S2 | `feat/api` | Sonnet | `sources/*`, `main.py`, disk önbelleği, hata durumları | 3 sa |
| S3 | `feat/globe` | Sonnet | Küre + trend dokusu (canvas → equirectangular) + tıklama + uçuş. S2 ile paralel, sözleşmeye karşı | 4 sa |
| S4 | `feat/casefile` | Sonnet | Grafik, 4 soru kartı, tanık rozeti, zıt ikiz, "kaç yıl daha" | 3 sa |
| S5 | `feat/detective` | Sonnet (kod) + **Haiku** (metin) | Sihirbaz, Case Files turu, sözlük, değişken tanımları | 2.5 sa |
| S6 | `chore/deploy` | Haiku | Dockerfile, HF Spaces, canlı tutma pingi, FortiGuard sınıflandırma formu | 1.5 sa |
| S7 | `main` | **Opus** (tek geçiş) | Uçtan uca inceleme: istatistik doğruluğu, uydurma sayı taraması, İngilizce taraması | 1 sa |
| S8 | `docs/submission` | Haiku taslak, Sonnet son okuma | README, 7 slayt, proje sayfası alanları, SI beyanı | 3 sa |

Opus yalnız S1 ve S7. Limit biterse S1 Sonnet'e düşer, S7 kalır.
Graphify: depo GitHub'a çıkınca indeksle. Oturumlar dosya okumak yerine `graphify_find` / `graphify_callers` sorar. Depo küçük, kazanç orta; asıl tasarruf dar brif + temiz sohbetten gelir.
UI: S3–S5 başında `ui-ux-pro-max` veya `impeccable` ile bir kez tasarım dili belirlenir (koyu uzay teması, tek vurgu rengi, ıraksak renk skalası renk körü dostu). Sonra dokunulmaz.

## Zaman çizelgesi (bugün ~14:00 → yarın 23:59)

- **Cmt 14–15:** S0 + Zarr kapısı.
- **Cmt 15–19:** S1, ardından S2 ∥ S3.
- **Cmt 19–24:** S3 biter, S4.
- **Gece:** ilk dağıtım (S6) + **erken "Submit for Judging"** (sonradan düzenlenebilir). Uyku 6 sa.
- **Paz 08–11:** S5. **Özellik dondurma 11:00.**
- **Paz 11–13:** S7 inceleme + düzeltme.
- **Paz 13–18:** S8 teslim paketi, gizli pencerede link testi.
- **Paz 18–21:** tampon. **Son teslim 21:00**, 23:59'u bekleme.

Geride kalınırsa kesme sırası: ERA5 tanık → kutu ortalaması → sihirbaz → zıt ikiz. **Asla kesilmez:** küre haritası, istatistik, Case Files, İngilizce, canlı link.

Zarr kapısı tutmazsa (okuma > 60 sn): yedek = regional API ile 10° karolar, arka planda doldur, önbellekle.

## Teslim paketi → jüri ölçütü

- **Impact:** öğrenci 3 tıkla kendi şehrinin trendini ve anlamını görür.
- **Creativity:** trend küresi + zıt ikiz + "kaç yıl daha".
- **Validity:** otokorelasyon, FDR, ikinci tanık, yöntem sayfası atıflı.
- **Relevance:** görevdeki 4 hedef ve "What/Where/How much/Significant" birebir kartlarda.
- **Presentation:** 7 slayt (başlık, sorun, çözüm, canlı ekran, yöntem, veri, gelecek) + canlı link + temiz README.
- Veri alanları: NASA POWER (MERRA-2, CERES, IMERG/GPM), partner: Copernicus ERA5. Kütüphaneler listelenir. SI beyanı: README, alt bilgi, kod başlıkları.

## Doğrulama

1. `pytest`: vektörel MK = `pymannkendall` (20 hücre, tolerans 1e-6); bilinen yapay *test girdisi* yalnız testte, ürüne girmez.
2. `curl` ile her uç nokta: gerçek yanıt, `fetched_at` dolu, hata durumunda açık mesaj (sessiz yedek veri yok).
3. Tarayıcıda uçtan uca: küre açılır → değişken değişir → tıkla → dosya → ikiz uçuşu → Case File turu. Mobil genişlik dahil.
4. Bilim sağlaması: Arktik T2M ısınması anlamlı ve pozitif çıkmalı; haritada hem kırmızı hem mavi bölge görünmeli. Her Case File iddiası canlı sonuçla ve atıfla uyuşmalı; uyuşmayan vaka çıkarılır.
5. `grep` taraması: Türkçe metin, NASA logosu, sabit gömülü veri sayısı yok.
6. Dağıtım linki + slayt linki gizli pencerede, girişsiz açılır.
