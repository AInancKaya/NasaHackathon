// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.

interface Entry {
  term: string;
  def: string;
  cite?: { text: string; url: string };
}

const doi = (d: string) => `https://doi.org/${d}`;

const ENTRIES: Entry[] = [
  {
    term: "Trend",
    def: "A steady rise or fall over many years, once the ups and downs of single seasons and years are set aside.",
  },
  {
    term: "Anomaly",
    def: "How far a month is from what is normal for that calendar month. A January that is 2 °C warmer than the usual January has an anomaly of +2 °C. Anomalies remove the seasons so a trend is easier to see.",
  },
  {
    term: "Sen's slope",
    def: "The typical change per decade: the median of the slopes between every pair of data points. One extreme year barely moves it.",
    cite: { text: "Sen (1968), J. American Statistical Association", url: doi("10.1080/01621459.1968.10480934") },
  },
  {
    term: "Mann-Kendall test",
    def: "A test that asks whether later values tend to be higher (or lower) than earlier ones, by comparing every pair. It does not need bell-curve data. We use the seasonal version, which only compares the same months with each other.",
    cite: { text: "Mann (1945), Econometrica; seasonal version: Hirsch et al. (1982)", url: doi("10.2307/1907187") },
  },
  {
    term: "p-value",
    def: "If there were really no trend, the chance of seeing a pattern at least this strong by luck alone. A small p-value means luck is an unlikely explanation. It is not the probability that the trend is real.",
  },
  {
    term: "Significance",
    def: "We call a trend significant when its p-value is below 0.05. It means the trend is unlikely to be chance. It does not mean the trend is large or important.",
  },
  {
    term: "Autocorrelation",
    def: "When one month tends to resemble the next. It makes a trend look more convincing than the evidence really is, so we correct the p-value for it (Hamed-Rao method).",
    cite: { text: "Hamed & Rao (1998), Journal of Hydrology", url: doi("10.1016/S0022-1694(97)00125-X") },
  },
  {
    term: "FDR (false discovery rate)",
    def: "The map tests thousands of places at once, and some will look significant by luck. FDR control keeps the expected share of such false alarms among the highlighted cells at 5%. Faded cells did not pass.",
    cite: { text: "Benjamini & Hochberg (1995), J. Royal Statistical Society B", url: doi("10.1111/j.2517-6161.1995.tb02031.x") },
  },
  {
    term: "Confidence interval",
    def: "The range of slopes that fit the data well; we show 95% intervals. If the range includes zero, the data cannot tell a rise from a fall.",
  },
  {
    term: "Years to detect",
    def: "How many years of data are needed before a trend of this size stands out from natural ups and downs. It is only shown when the trend is not yet significant.",
    cite: { text: "Weatherhead et al. (1998), J. Geophysical Research", url: doi("10.1029/98JD00995") },
  },
];

export default function Glossary() {
  return (
    <dl className="glossary">
      {ENTRIES.map((e) => (
        <div key={e.term} className="gloss-item">
          <dt>{e.term}</dt>
          <dd>
            {e.def}
            {e.cite && (
              <>
                {" "}
                <a className="small" href={e.cite.url} target="_blank" rel="noopener noreferrer">
                  {e.cite.text}
                </a>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
