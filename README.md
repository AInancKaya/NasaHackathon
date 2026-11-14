---
title: TerraVestige
emoji: 🌍
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

<!-- AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant. Reviewed and directed by the project author. -->

# TerraVestige — Be an Earth System Trend Detective

*Terra* (Earth) + *vestige* (a trace left behind): reading the traces of change that the Earth leaves in its data.

**NASA Space Apps Challenge 2026** · Challenge: *Be An Earth System Trend Detective!*

**English** · [Türkçe](#türkçe)

---

## English

### What is TerraVestige?

The same Earth variable can rise in one place and fall in another. TerraVestige shows this on a 3D globe.
Pick a variable, see where it is rising or falling across the whole planet, click any spot, and open a
"case file" that tells you, in plain words, what is changing, where, by how much, and whether the change
is statistically real. Everything is computed live from real data. There is no synthetic or bundled data.

### Features

1. **Global trend globe.** A 3D Earth coloured by the trend of the chosen variable (Sen's slope per decade).
   Cells whose trend is not statistically significant are faded, so noise is not mistaken for signal.
   Significance on the map uses Benjamini-Hochberg false-discovery-rate correction (q = 0.05).
2. **Case file for any place.** Click the globe or search for a city in the top bar (the case tours analyse a box average, up to 10° wide, instead of one point). You get the monthly series, the seasonality-free anomaly, a trend line with a 95% confidence band,
   and four answer cards: **What** is changing, **Where**, **How much**, and **Is it significant?**
3. **Evidence chart.** An interactive chart of the data, the fitted trend and its confidence band.
4. **Second witness.** The trend is re-computed from a second, partly independent dataset (Copernicus ERA5 through Open-Meteo; a different reanalysis that still shares many input observations with MERRA-2)
   and a badge shows whether both datasets agree on the direction. Available for 8 of 14 variables.
5. **Opposite twin.** Finds the cell with the strongest significant trend in the *opposite* direction and flies
   the globe there. This answers the challenge's core idea: a variable can go up here and down there.
6. **"How many more years?"** If a trend is not yet significant, the case file estimates how many more years of
   data would be needed to detect it (Weatherhead et al., 1998).
7. **Detective guide.** A three-question wizard (what are you curious about, where, what kind of place) that
   suggests a variable, plus a plain-language glossary and a short definition and "why it matters" for every variable.
8. **Ready-made case tours.** Six guided investigations (Arctic warming, Arctic sea ice, the Antarctic Peninsula
   pause, the Mediterranean rainfall, the Sahel's rain, the US Southwest's soil moisture). Each links to a peer-reviewed
   paper. The tours store only place, variable and citation. Every number is computed live.
9. **Honest errors.** If a data source fails, the API returns a clear error. It never silently shows fallback data.
   Every result shows when its data was fetched (`fetched_at`).

### Variables (14)

- **Atmosphere** (NASA POWER / MERRA-2): surface air temperature, daily maximum and minimum temperature,
  precipitation, relative humidity, wind speed, total column water vapour.
- **Ocean and ice** (NASA POWER / MERRA-2): sea and land surface temperature, sea ice cover, snow cover.
  Over the ocean, MERRA-2's sea surface temperature and sea ice come from satellite-based analyses.
- **Land and plants** (NASA POWER / MERRA-2): surface soil wetness, evapotranspiration (water given off by soil
  and plants).
- **Radiation and clouds** (NASA POWER / CERES): surface solar radiation, cloud cover.

The 12 MERRA-2 variables have a global trend map. Eight variables have a second-witness check against ERA5.
There is no vegetation index (NDVI) in NASA POWER; evapotranspiration is the closest plant-related quantity.

### Methods

- Seasonal Mann-Kendall test and Sen's slope, with a 95% confidence interval for the slope.
- Hamed-Rao correction of the p-value for autocorrelation. The "significant" verdict uses this corrected p-value.
- OLS regression on the anomalies and a Welch t-test (first half vs second half) as supporting evidence.
- On the map, each cell's p-value is first corrected for lag-1 autocorrelation (the lag-1 form of the Hamed-Rao
  correction), then Benjamini-Hochberg FDR is applied across all cells (Wilks, 2016).
- Scale: the map grid is about 2° (~200 km) and a case file reads one ~50 km model cell. Values are regional
  averages from reanalysis, so they do not resolve a city's own heat island.
- Years-to-detect estimate (Weatherhead et al., 1998).
- "Has the pace changed?": a continuous two-segment line on the annual anomalies (at least 10 years per side)
  gives the rate before and after the best-fitting break year. It is exploratory, with no p-value, because the
  break year is chosen from the data. (A Pettitt test is not used: it flags a "break" in any steady trend.)
- A vectorised map implementation is checked against the `pymannkendall` library in the test suite.
- Significance level α = 0.05. Slopes are per decade, in SI-based units shown next to every number
  (°C, mm/day, m/s, kg/m², MJ/m²/day, % and fraction).

### Data sources (all live, no login)

- **NASA POWER** point and regional APIs (MERRA-2 and CERES).
- **NASA POWER Zarr** on the open AWS bucket `nasa-power` (global grid for the trend maps).
- **Copernicus ERA5** through the **Open-Meteo** archive API (the second witness).

Responses are cached on disk (`cache/`, git-ignored) together with the original fetch time. No data files are in this repository.

### Architecture

- **Backend:** Python, FastAPI, xarray + zarr + s3fs, pandas, numpy, scipy, pymannkendall (`backend/`).
- **Frontend:** React + TypeScript + Vite, globe.gl / three.js, Plotly (`frontend/`).
- **Deployment:** one Docker container serving the API and the built frontend on port 7860 (deployable to Google Cloud Run). See [docs/DEPLOY.md](docs/DEPLOY.md).
- **API contract:** [docs/CONTRACT.md](docs/CONTRACT.md).

### Run locally

```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
uvicorn backend.main:app --port 7860
# open http://localhost:7860
```

Tests: `pytest`.

### Use of artificial intelligence

This project was built with assistance from **Claude (Anthropic)**, an AI coding assistant, used through
Claude Code. Claude helped write the code, tests and documentation. The project author set the idea and the
requirements, directed the work, and reviewed the results. Each source file carries an AI-disclosure header.
**No AI model runs inside the product at request time.** All verdict texts are rule-based and all numbers come
from live data and the statistical code above.

### Branding and units

No NASA logos, emblems or insignia are used. NASA is named only as a data source. Units follow the International
System of Units (SI) or are shown explicitly next to every value.

### Acknowledgements

NASA POWER Project, NASA Earth science data, Copernicus Climate Change Service (ERA5), Open-Meteo, and the
open-source libraries listed above.

---

## Türkçe

### TerraVestige nedir?

Aynı Dünya değişkeni bir yerde artarken başka bir yerde azalabilir. TerraVestige bunu 3D bir küre üzerinde gösterir.
Bir değişken seç, gezegenin neresinde arttığını ya da azaldığını gör, herhangi bir noktaya tıkla ve bir "vaka dosyası"
aç. Dosya sade bir dille neyin değiştiğini, nerede, ne kadar değiştiğini ve değişimin istatistiksel olarak gerçek olup
olmadığını söyler. Her şey gerçek veriden, anlık hesaplanır. Sentetik ya da depoya gömülü veri yoktur.

### Özellikler

1. **Küresel trend küresi.** Seçilen değişkenin trendine (on yıl başına Sen eğimi) göre renklenen 3D Dünya.
   Trendi istatistiksel olarak anlamlı olmayan hücreler soluk gösterilir, böylece gürültü sinyal sanılmaz.
   Haritadaki anlamlılık Benjamini-Hochberg yanlış keşif oranı düzeltmesiyle (q = 0,05) belirlenir.
2. **Her yer için vaka dosyası.** Küreye tıkla ya da üst çubuktan bir şehir ara (vaka turları tek nokta yerine 10°'ye kadar bir kutunun ortalamasını analiz eder).
   Aylık seri, mevsimselliği çıkarılmış anomali, %95 güven bandıyla trend çizgisi ve dört cevap kartı gelir:
   **Ne** değişiyor, **Nerede**, **Ne kadar** ve **Anlamlı mı?**
3. **Kanıt grafiği.** Veriyi, uydurulan trendi ve güven bandını gösteren etkileşimli grafik.
4. **İkinci tanık.** Trend, kısmen bağımsız ikinci bir veri setiyle (Open-Meteo üzerinden Copernicus ERA5; farklı bir reanaliz, ama MERRA-2 ile birçok gözlemi paylaşır) yeniden hesaplanır.
   Bir rozet, iki veri setinin yön konusunda uyuşup uyuşmadığını gösterir. 14 değişkenin 8'inde vardır.
5. **Zıt ikiz.** Zıt yönde en güçlü anlamlı trende sahip hücreyi bulur ve küreyi oraya uçurur. Görevin ana fikrini
   karşılar: bir değişken burada artarken orada azalabilir.
6. **"Kaç yıl daha gerekir?"** Trend henüz anlamlı değilse, trendi yakalamak için kaç yıllık ek veri gerektiğini
   tahmin eder (Weatherhead ve ark., 1998).
7. **Dedektif rehberi.** Üç soruluk bir sihirbaz (neyi merak ediyorsun, nerede, ne tür bir yer) değişken önerir.
   Ayrıca sade bir sözlük ve her değişken için kısa bir tanım ile "neden önemli" açıklaması bulunur.
8. **Hazır vaka turları.** Altı rehberli inceleme: Arktik ısınması, Arktik deniz buzu, Antarktika Yarımadası'ndaki duraklama, Akdeniz
   yağışları, Sahel yağmurları, ABD Güneybatısı toprak nemi. Her biri hakemli bir makaleye bağlanır. Turlar yalnızca
   yer, değişken ve atıf içerir. Bütün sayılar canlı hesaplanır.
9. **Dürüst hatalar.** Bir veri kaynağı çökerse API açık bir hata döner. Sessizce yedek veri göstermez.
   Her sonuç, verinin ne zaman çekildiğini (`fetched_at`) gösterir.

### Değişkenler (14)

- **Atmosfer** (NASA POWER / MERRA-2): yüzey hava sıcaklığı, günlük en yüksek ve en düşük sıcaklık, yağış,
  bağıl nem, rüzgâr hızı, toplam sütun su buharı.
- **Okyanus ve buz** (NASA POWER / MERRA-2): deniz ve kara yüzey sıcaklığı, deniz buzu örtüsü, kar örtüsü.
  Okyanus üzerinde MERRA-2'nin deniz yüzeyi sıcaklığı ve deniz buzu uydu tabanlı analizlerden gelir.
- **Kara ve bitki** (NASA POWER / MERRA-2): yüzey toprak nemi, evapotranspirasyon (topraktan ve bitkilerden
  havaya geçen su).
- **Radyasyon ve bulut** (NASA POWER / CERES): yüzey güneş radyasyonu, bulut örtüsü.

12 MERRA-2 değişkeninin küresel trend haritası vardır. 8 değişkende ERA5 ile ikinci tanık kontrolü yapılır.
NASA POWER'da bitki örtüsü indeksi (NDVI) yoktur; bitkiyle en ilgili büyüklük evapotranspirasyondur.

### Yöntemler

- Mevsimsel Mann-Kendall testi ve Sen eğimi, eğim için %95 güven aralığıyla.
- p-değerinin otokorelasyon için Hamed-Rao düzeltmesi. "Anlamlı" kararı bu düzeltilmiş p-değerine dayanır.
- Destekleyici kanıt olarak anomaliler üzerinde OLS regresyonu ve Welch t-testi (ilk yarı ve ikinci yarı).
- Haritada her hücrenin p-değeri önce lag-1 otokorelasyon için düzeltilir (Hamed-Rao düzeltmesinin lag-1 biçimi),
  ardından tüm hücrelere Benjamini-Hochberg FDR uygulanır (Wilks, 2016).
- Ölçek: harita ızgarası yaklaşık 2° (~200 km), vaka dosyası ise ~50 km'lik tek bir model hücresini okur. Değerler
  reanalizden gelen bölgesel ortalamalardır; bir şehrin kendi ısı adasını göstermez.
- "Kaç yıl gerekir" tahmini (Weatherhead ve ark., 1998).
- "Değişimin hızı değişti mi?": yıllık anomalilere sürekli iki parçalı bir doğru uydurulur (her yanda en az 10 yıl)
  ve en iyi uyan kırılma yılından önceki ve sonraki hız verilir. Keşif amaçlıdır, p-değeri yoktur, çünkü kırılma
  yılı veriden seçilir. (Pettitt testi kullanılmaz: düzenli her trendde bir "kırılma" bulur.)
- Vektörel harita uygulaması, test paketinde `pymannkendall` kütüphanesiyle karşılaştırılır.
- Anlamlılık düzeyi α = 0,05. Eğimler on yıl başınadır. Her sayının yanında birim yazar (SI tabanlı:
  °C, mm/gün, m/s, kg/m², MJ/m²/gün, % ve oran).

### Veri kaynakları (hepsi canlı, girişsiz)

- **NASA POWER** nokta ve bölgesel API'leri (MERRA-2 ve CERES).
- Açık AWS kovası `nasa-power` üzerindeki **NASA POWER Zarr** (trend haritaları için küresel ızgara).
- **Open-Meteo** arşiv API'si üzerinden **Copernicus ERA5** (ikinci tanık).

Yanıtlar, ilk çekim zamanıyla birlikte diske (`cache/`, git'e girmez) önbelleğe alınır. Depoda veri dosyası yoktur.

### Mimari

- **Backend:** Python, FastAPI, xarray + zarr + s3fs, pandas, numpy, scipy, pymannkendall (`backend/`).
- **Frontend:** React + TypeScript + Vite, globe.gl / three.js, Plotly (`frontend/`).
- **Dağıtım:** API'yi ve derlenmiş arayüzü 7860 portunda sunan tek Docker konteyneri (Google Cloud Run ile dağıtılabilir).
  Bkz. [docs/DEPLOY.md](docs/DEPLOY.md).
- **API sözleşmesi:** [docs/CONTRACT.md](docs/CONTRACT.md).

### Yerelde çalıştırma

```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
uvicorn backend.main:app --port 7860
# http://localhost:7860 adresini aç
```

Testler: `pytest`.

### Yapay zeka kullanımı

Bu proje, Claude Code üzerinden kullanılan yapay zeka kodlama asistanı **Claude (Anthropic)** desteğiyle geliştirildi.
Claude kodun, testlerin ve belgelerin yazılmasına yardım etti. Proje sahibi fikri ve gereksinimleri belirledi, işi
yönlendirdi ve sonuçları gözden geçirdi. Her kaynak dosyada yapay zeka kullanım bildirimi başlığı bulunur.
**Ürünün içinde, çalışma anında hiçbir yapay zeka modeli çalışmaz.** Bütün karar metinleri kural tabanlıdır ve bütün
sayılar canlı veriden ve yukarıdaki istatistik kodundan gelir.

### Marka ve birimler

NASA logosu, amblemi ya da armasının hiçbiri kullanılmamıştır. NASA yalnızca veri kaynağı olarak anılır. Birimler
Uluslararası Birim Sistemi'ne (SI) uygundur ya da her değerin yanında açıkça yazılıdır.

### Teşekkür

NASA POWER Projesi, NASA Dünya bilimi verileri, Copernicus İklim Değişikliği Servisi (ERA5), Open-Meteo ve yukarıda
sayılan açık kaynak kütüphaneler.
