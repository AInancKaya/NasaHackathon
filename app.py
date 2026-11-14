from datetime import date

import plotly.graph_objects as go
import streamlit as st

from nasa_api import VARIABLES, fetch_monthly
from stats_engine import analyze_trend

st.set_page_config(layout="wide", page_title="TerraTrend", page_icon="🛰️")

st.markdown(
    """
    <style>
    .stApp {background: radial-gradient(ellipse at top, #0b1530 0%, #05070f 60%, #000 100%); color:#e6edf7;}
    section[data-testid="stSidebar"] {background:#080d1c; border-right:1px solid #1b2a52;}
    h1,h2,h3 {color:#fff; letter-spacing:.5px;}
    [data-testid="stMetric"] {background:rgba(16,28,60,.65); border:1px solid #1f3a7a;
        border-radius:12px; padding:18px;}
    [data-testid="stMetricLabel"] {color:#8fb4ff;}
    [data-testid="stMetricValue"] {font-size:2.2rem;}
    .nasa-title {color:#fc3d21; font-weight:700; letter-spacing:2px; font-size:.85rem;}
    .footer {text-align:center; color:#7f8fb3; font-size:.85rem; padding:12px 0;}
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data(show_spinner="NASA POWER'dan veri çekiliyor…", ttl=3600)
def load(lat, lon, y0, y1, param):
    return fetch_monthly(lat, lon, y0, y1, param)


with st.sidebar:
    st.markdown('<div class="nasa-title">NASA SPACE APPS</div>', unsafe_allow_html=True)
    st.header("Konum ve Değişken")
    lat = st.number_input("Enlem", -90.0, 90.0, 41.01, 0.1, format="%.2f")
    lon = st.number_input("Boylam", -180.0, 180.0, 28.98, 0.1, format="%.2f")
    y0 = st.number_input("Başlangıç yılı", 1981, date.today().year, 2004, 1)
    y1 = st.number_input("Bitiş yılı", 1981, date.today().year, 2024, 1)
    var_name = st.selectbox("Değişken", list(VARIABLES))
    v = VARIABLES[var_name]
    st.info(f"**{v['label']}** ({v['unit']})\n\n{v['desc']}")

st.title("🛰️ TerraTrend — Earth System Trend & Significance Detective")
st.caption(f"{v['label']} · {lat:.2f}°, {lon:.2f}° · {int(y0)}–{int(y1)} · aylık")

try:
    series = load(lat, lon, int(y0), int(y1), v["param"])
    res = analyze_trend(series, v["label"], v["unit"])
except Exception as e:
    st.error(f"Analiz yapılamadı: {e}")
    st.stop()

# ---- Metrics ----
c1, c2, c3 = st.columns(3)
c1.metric("Anlamlılık", "Significant" if res["significant"] else "Not Significant",
          f"p = {res['mk_p']:.4f}", delta_color="off")
c2.metric("Trend Yönü", res["trend_direction"].capitalize(),
          f"{res['sen_slope_per_decade']:+.3f} {v['unit']}/on yıl", delta_color="off")
c3.metric("Mann-Kendall τ", f"{res['mk_tau']:+.3f}", f"n = {res['n']} ay", delta_color="off")

(st.success if res["significant"] else st.warning)(
    f"**What is changing?** {res['what_is_changing']}  \n"
    f"**How much?** {res['how_much']}  \n"
    f"**Significant?** {res['is_significant']}"
)

# ---- Chart ----
tr = res["trend"]
fig = go.Figure()
fig.add_trace(go.Scatter(x=series.index, y=series, name="Aylık gözlem", mode="lines",
                         line=dict(color="#4fc3f7", width=1.5)))
fig.add_trace(go.Scatter(x=tr.index, y=tr["hi"], mode="lines", line=dict(width=0),
                         showlegend=False, hoverinfo="skip"))
fig.add_trace(go.Scatter(x=tr.index, y=tr["lo"], mode="lines", line=dict(width=0),
                         fill="tonexty", fillcolor="rgba(252,61,33,.25)",
                         name="%95 güven aralığı", hoverinfo="skip"))
fig.add_trace(go.Scatter(x=tr.index, y=tr["fit"], name="Lineer trend", mode="lines",
                         line=dict(color="#fc3d21", width=3, dash="dash")))
fig.update_layout(
    template="plotly_dark", height=520, hovermode="x unified",
    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(8,13,28,.6)",
    xaxis_title="Tarih", yaxis_title=f"{v['label']} ({v['unit']})",
    legend=dict(orientation="h", y=-0.2), margin=dict(l=10, r=10, t=20, b=10),
)
st.plotly_chart(fig, width="stretch")

with st.expander("İstatistiksel ayrıntılar"):
    lo, hi = res["reg_ci95_per_decade"]
    st.write({
        "Mann-Kendall p": round(res["mk_p"], 5),
        "Sen eğimi (/on yıl)": round(res["sen_slope_per_decade"], 4),
        "Regresyon eğimi (/on yıl)": round(res["reg_slope_per_decade"], 4),
        "Regresyon p": round(res["reg_p"], 5),
        "R²": round(res["reg_r2"], 4),
        "Eğim %95 GA (/on yıl)": [round(lo, 4), round(hi, 4)],
        "Welch t-testi (ilk yarı vs son yarı, yıllık ortalamalar) t": round(res["ttest_t"], 3),
        "Welch t-testi p": round(res["ttest_p"], 5),
    })

st.divider()
st.markdown(
    '<div class="footer">Data Source: NASA POWER / MERRA-2<br>'
    'SI-assisted code generation via Claude</div>',
    unsafe_allow_html=True,
)
