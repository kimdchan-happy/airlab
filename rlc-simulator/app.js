import * as P from "./physics.js";

// ---------------------------------------------------------------------
// Parameter reading / UI wiring
// ---------------------------------------------------------------------
const els = {};
["D_tsv_um", "tox_nm", "l_tsv_um", "metal", "Na_log", "Qot_log", "T_K",
 "freq_log", "Vdd", "Rdr", "Rw", "Cw", "Cio"].forEach((id) => {
  els[id] = document.getElementById(id);
});

function readParams() {
  const metal = els.metal.value;
  return {
    D_tsv_um: +els.D_tsv_um.value,
    tox_nm: +els.tox_nm.value,
    l_tsv_um: +els.l_tsv_um.value,
    Na_cm3: Math.pow(10, +els.Na_log.value),
    Qot_cm2: Math.pow(10, +els.Qot_log.value),
    eps_ox_r: 3.9,
    eps_si_r: 11.9,
    phi_m_eV: 4.7,
    T_K: +els.T_K.value,
    rho: P.MATERIALS[metal].rho,
    _freqHz: Math.pow(10, +els.freq_log.value),
    _Vdd: +els.Vdd.value,
    _Rdr: +els.Rdr.value,
    _Rw: +els.Rw.value,
    _Cw: +els.Cw.value * 1e-15,
    _Cio: +els.Cio.value * 1e-15,
  };
}

function fmt(x, unit, digits = 3) {
  if (!isFinite(x)) return "—";
  return `${x.toPrecision(digits)} ${unit}`;
}
function engFmt(x, unit) {
  // pick a sensible SI prefix for display
  const abs = Math.abs(x);
  const table = [
    [1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"],
    [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"], [1e-15, "f"], [1e-18, "a"],
  ];
  for (const [scale, prefix] of table) {
    if (abs >= scale) return `${(x / scale).toPrecision(3)} ${prefix}${unit}`;
  }
  return `${x.toExponential(2)} ${unit}`;
}

function updateValLabels(p) {
  document.getElementById("D_tsv_um_val").textContent = `${p.D_tsv_um.toFixed(1)} µm`;
  document.getElementById("tox_nm_val").textContent = `${p.tox_nm.toFixed(0)} nm`;
  document.getElementById("l_tsv_um_val").textContent = `${p.l_tsv_um.toFixed(0)} µm`;
  document.getElementById("Na_log_val").textContent = `${p.Na_cm3.toExponential(2)} cm⁻³`;
  document.getElementById("Qot_log_val").textContent = `${p.Qot_cm2.toExponential(2)} cm⁻²`;
  document.getElementById("T_K_val").textContent = `${p.T_K} K`;
  document.getElementById("freq_log_val").textContent = engFmt(p._freqHz, "Hz");
  document.getElementById("Vdd_val").textContent = `${p._Vdd.toFixed(2)} V`;
  document.getElementById("Rdr_val").textContent = `${p._Rdr.toFixed(0)} Ω`;
  document.getElementById("Rw_val").textContent = `${p._Rw.toFixed(0)} Ω`;
  document.getElementById("Cw_val").textContent = `${(p._Cw * 1e15).toFixed(1)} fF`;
  document.getElementById("Cio_val").textContent = `${(p._Cio * 1e15).toFixed(1)} fF`;
}

const plotlyLayoutBase = {
  paper_bgcolor: "#161d2e",
  plot_bgcolor: "#0f1420",
  font: { color: "#e7ecf7", size: 12 },
  margin: { t: 40, r: 20, b: 45, l: 60 },
  legend: { orientation: "h", y: -0.2 },
};

function darkLayout(extra) {
  return Object.assign({}, plotlyLayoutBase, extra, {
    xaxis: Object.assign({ gridcolor: "#2a3550", zerolinecolor: "#2a3550" }, extra?.xaxis || {}),
    yaxis: Object.assign({ gridcolor: "#2a3550", zerolinecolor: "#2a3550" }, extra?.yaxis || {}),
  });
}

const plotConfig = { responsive: true, displaylogo: false };

// ---------------------------------------------------------------------
// Scorecard
// ---------------------------------------------------------------------
function renderScorecard(p) {
  const rdc = P.R_dc(p);
  const rac = P.R_ac(p._freqHz, p);
  const fx = P.skinCrossoverFreq(p);
  const l = P.L_tsv(p);
  const cox = P.C_ox(p);
  const cmin = P.C_tsv_min(p);
  const vfb = P.V_fb(p);
  const vth = P.V_th(p);

  const items = [
    ["R_DC", engFmt(rdc, "Ω")],
    [`R_AC @ ${engFmt(p._freqHz, "Hz")}`, engFmt(rac, "Ω")],
    ["Skin-depth 교차 주파수", engFmt(fx, "Hz")],
    ["L_TSV", engFmt(l, "H")],
    ["C_ox (축적)", engFmt(cox, "F")],
    ["C_TSV_MIN (최소공핍)", engFmt(cmin, "F")],
    ["V_FB", `${vfb.toFixed(3)} V`],
    ["V_Th", `${vth.toFixed(3)} V`],
  ];
  document.getElementById("scorecard").innerHTML = items
    .map(([k, v]) => `<div class="sc-item"><div class="k">${k}</div><div class="v">${v}</div></div>`)
    .join("");
}

// ---------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------
function plotBode(p) {
  const freqs = logspace(1e3, 1e11, 200);
  const rVals = freqs.map((f) => P.R_ac(f, p));
  const lVals = freqs.map((f) => 2 * Math.PI * f * P.L_tsv(p));
  const cmin = P.C_tsv_min(p);
  const cVals = freqs.map((f) => 1 / (2 * Math.PI * f * cmin));

  const traces = [
    { x: freqs, y: rVals, name: "R_TSV(f)", mode: "lines", line: { color: "#5aa9ff" } },
    { x: freqs, y: lVals, name: "ωL_TSV", mode: "lines", line: { color: "#ff8a5a" } },
    { x: freqs, y: cVals, name: "1/(ωC_TSV_MIN)", mode: "lines", line: { color: "#7be37b" } },
    {
      x: [p._freqHz, p._freqHz], y: [Math.min(...rVals, ...lVals, ...cVals), Math.max(...rVals, ...lVals, ...cVals)],
      name: "현재 주파수", mode: "lines", line: { color: "#e7ecf7", dash: "dot" },
    },
  ];
  Plotly.react("plot-bode", traces, darkLayout({
    title: "임피던스 성분별 크기 비교: R vs ωL vs 1/ωC (어떤 성분이 지배적인가)",
    xaxis: { title: "주파수 (Hz)", type: "log" },
    yaxis: { title: "임피던스 (Ω)", type: "log" },
  }), plotConfig);
}

function plotLumpedCompare(p) {
  const freqs = logspace(1e6, 1e11, 200);
  const rlc = freqs.map((f) => Math.hypot(P.R_ac(f, p), 2 * Math.PI * f * P.L_tsv(p)));
  const rc = freqs.map((f) => P.R_ac(f, p));
  Plotly.react("plot-lumped-compare", [
    { x: freqs, y: rlc, name: "Full RLC |Z_series| = |R+jωL|", mode: "lines", line: { color: "#5aa9ff" } },
    { x: freqs, y: rc, name: "RC 근사 (L 무시) = R", mode: "lines", line: { color: "#ff8a5a", dash: "dash" } },
  ], darkLayout({
    title: "Fig.8 모델 근사 타당성: RLC vs RC 근사 직렬 임피던스 비교",
    xaxis: { title: "주파수 (Hz)", type: "log" },
    yaxis: { title: "직렬 임피던스 크기 (Ω)", type: "log" },
  }), plotConfig);
}

// ---------------------------------------------------------------------
// Resistance tab
// ---------------------------------------------------------------------
function plotRvsF(p) {
  const freqs = logspace(1e3, 1e11, 200);
  const rVals = freqs.map((f) => P.R_ac(f, p));
  const fx = P.skinCrossoverFreq(p);
  Plotly.react("plot-r-vs-f", [
    { x: freqs, y: rVals, name: "R_AC(f)", mode: "lines", line: { color: "#5aa9ff" } },
    { x: [fx], y: [P.R_ac(fx, p)], name: "skin-depth = 반경 교차점", mode: "markers", marker: { color: "#ff8a5a", size: 10 } },
  ], darkLayout({
    title: "R_TSV vs 주파수 (skin effect)",
    xaxis: { title: "주파수 (Hz)", type: "log" },
    yaxis: { title: "R_TSV (Ω)", type: "log" },
  }), plotConfig);
}

function plotRvsDiameter(p) {
  const diam = linspace(0.5, 20, 60);
  const lengths = [10, 20, 40];
  const traces = lengths.map((l, i) => ({
    x: diam,
    y: diam.map((d) => P.R_dc({ ...p, D_tsv_um: d, l_tsv_um: l })),
    name: `l_TSV = ${l} µm`,
    mode: "lines",
    line: { color: ["#5aa9ff", "#ff8a5a", "#7be37b"][i] },
  }));
  Plotly.react("plot-r-vs-d", traces, darkLayout({
    title: "R_DC vs TSV 직경 (길이별)",
    xaxis: { title: "TSV 직경 (µm)" },
    yaxis: { title: "R_DC (Ω)", type: "log" },
  }), plotConfig);
}

// ---------------------------------------------------------------------
// Inductance tab
// ---------------------------------------------------------------------
function plotLHeatmap(p) {
  const diam = linspace(0.5, 20, 40);
  const lens = linspace(5, 100, 40);
  const z = lens.map((l) => diam.map((d) => P.L_tsv({ ...p, D_tsv_um: d, l_tsv_um: l }) * 1e12));
  Plotly.react("plot-l-heatmap", [{
    x: diam, y: lens, z, type: "heatmap", colorscale: "Viridis",
    colorbar: { title: "L_TSV (pH)" },
  }], darkLayout({
    title: "L_TSV (pH): 직경 x 길이",
    xaxis: { title: "TSV 직경 (µm)" },
    yaxis: { title: "TSV 길이 (µm)" },
  }), plotConfig);
}

function plotLCrossover(p) {
  const diam = linspace(0.5, 20, 60);
  const fx = diam.map((d) => {
    const pp = { ...p, D_tsv_um: d };
    const rdc = P.R_dc(pp);
    const l = P.L_tsv(pp);
    return rdc / (2 * Math.PI * l); // f where 2*pi*f*L = R_dc
  });
  Plotly.react("plot-l-crossover", [{
    x: diam, y: fx, mode: "lines", line: { color: "#7be37b" }, name: "ωL=R 교차 주파수",
  }], darkLayout({
    title: "인덕턴스가 저항을 압도하기 시작하는 주파수 (ωL = R_DC)",
    xaxis: { title: "TSV 직경 (µm)" },
    yaxis: { title: "교차 주파수 (Hz)", type: "log" },
  }), plotConfig);
}

// ---------------------------------------------------------------------
// Capacitance tab (Fig 4/5/6/7 style)
// ---------------------------------------------------------------------
function plotCoxSurface(p) {
  const diam = linspace(1, 20, 30);
  const tox = linspace(20, 250, 30);
  const z = tox.map((t) => diam.map((d) => P.C_ox({ ...p, D_tsv_um: d, tox_nm: t }) * 1e15));
  Plotly.react("plot-cox-surface", [{
    x: diam, y: tox, z, type: "contour", colorscale: "Plasma",
    contours: { showlabels: true }, colorbar: { title: "C_ox (fF)" },
  }], darkLayout({
    title: "C_ox (fF): 직경 x 산화막 두께 (Fig.4 재현)",
    xaxis: { title: "TSV 직경 (µm)" },
    yaxis: { title: "산화막 두께 t_ox (nm)" },
  }), plotConfig);
}

function plotCminSurface(p) {
  const diam = linspace(1, 20, 25);
  const tox = linspace(20, 250, 25);
  const z = tox.map((t) => diam.map((d) => P.C_tsv_min({ ...p, D_tsv_um: d, tox_nm: t }) * 1e15));
  Plotly.react("plot-cmin-surface", [{
    x: diam, y: tox, z, type: "contour", colorscale: "Plasma",
    contours: { showlabels: true }, colorbar: { title: "C_TSV_MIN (fF)" },
  }], darkLayout({
    title: "C_TSV_MIN (fF): 직경 x 산화막 두께 (Fig.5 재현)",
    xaxis: { title: "TSV 직경 (µm)" },
    yaxis: { title: "산화막 두께 t_ox (nm)" },
  }), plotConfig);
}

function plotCvsTox(p) {
  const tox = linspace(20, 250, 60);
  const cox = tox.map((t) => P.C_ox({ ...p, tox_nm: t }) * 1e15);
  const cdep = tox.map((t) => P.C_dep_min({ ...p, tox_nm: t }) * 1e15);
  const cmin = tox.map((t) => P.C_tsv_min({ ...p, tox_nm: t }) * 1e15);
  Plotly.react("plot-c-vs-tox", [
    { x: tox, y: cox, name: "C_ox", mode: "lines", line: { color: "#5aa9ff" } },
    { x: tox, y: cdep, name: "C_dep_min", mode: "lines", line: { color: "#ff8a5a" } },
    { x: tox, y: cmin, name: "C_TSV_MIN", mode: "lines", line: { color: "#7be37b" } },
  ], darkLayout({
    title: "산화막 두께에 따른 C_ox / C_dep_min / C_TSV_MIN 감소 (Fig.6 재현)",
    xaxis: { title: "산화막 두께 t_ox (nm)" },
    yaxis: { title: "커패시턴스 (fF)" },
  }), plotConfig);
}

function plotCvsDoping(p) {
  const na = logspace(1e14, 1e18, 60);
  const cmin = na.map((n) => P.C_tsv_min({ ...p, Na_cm3: n }) * 1e15);
  Plotly.react("plot-c-vs-doping", [
    { x: na, y: cmin, name: "C_TSV_MIN", mode: "lines", line: { color: "#7be37b" } },
  ], darkLayout({
    title: "도핑 농도에 따른 C_TSV_MIN (Fig.7 재현)",
    xaxis: { title: "N_a (cm⁻³)", type: "log" },
    yaxis: { title: "C_TSV_MIN (fF)" },
  }), plotConfig);
}

// ---------------------------------------------------------------------
// C-V tab
// ---------------------------------------------------------------------
function plotCV(p) {
  const vfb = P.V_fb(p);
  const vth = P.V_th(p);
  const span = Math.max(1, (vth - vfb) * 0.6);
  const vs = linspace(vfb - span, vth + span, 150);
  const cs = vs.map((v) => P.C_tsv_of_V(v, p) * 1e15);
  Plotly.react("plot-cv", [
    { x: vs, y: cs, name: "C(V)", mode: "lines", line: { color: "#5aa9ff" } },
    { x: [vfb, vfb], y: [Math.min(...cs), Math.max(...cs)], name: "V_FB", mode: "lines", line: { color: "#ff8a5a", dash: "dot" } },
    { x: [vth, vth], y: [Math.min(...cs), Math.max(...cs)], name: "V_Th", mode: "lines", line: { color: "#7be37b", dash: "dot" } },
  ], darkLayout({
    title: "TSV C-V 곡선 (축적 / 공핍 / 최소공핍)",
    xaxis: { title: "V_TSV (V)" },
    yaxis: { title: "C_TSV (fF)" },
  }), plotConfig);
}

// ---------------------------------------------------------------------
// Delay & power tab (Fig 9/10 style)
// ---------------------------------------------------------------------
function plotDelayHeatmap(p) {
  const rTsv = logspace(1e-3, 1, 40);   // 1 mOhm .. 1 Ohm
  const cTsv = logspace(1e-15, 200e-15, 40); // 1fF .. 200fF
  const base = { Rdr: p._Rdr, Rw_B: p._Rw, Rw_T: p._Rw, Cext: p._Cio, Cint: p._Cio, Cw_B: p._Cw, Cw_T: p._Cw };
  const z = cTsv.map((c) => rTsv.map((r) => P.elmoreDelay({ ...base, R_TSV: r, C_TSV: c }) * 1e12));

  const curR = P.R_dc(p);
  const curC = P.C_tsv_min(p);
  Plotly.react("plot-delay-heatmap", [
    { x: rTsv, y: cTsv, z, type: "contour", colorscale: "Turbo", colorbar: { title: "지연 (ps)" } },
    { x: [curR], y: [curC], mode: "markers", marker: { color: "#fff", size: 12, symbol: "x" }, name: "현재 설정" },
  ], darkLayout({
    title: "Elmore 지연 vs R_TSV, C_TSV (Fig.10 재현) — C_TSV 지배적",
    xaxis: { title: "R_TSV (Ω)", type: "log" },
    yaxis: { title: "C_TSV (F)", type: "log" },
  }), plotConfig);
}

function plotPower(p) {
  const freqs = logspace(1e6, 1e10, 80);
  const cmin = P.C_tsv_min(p);
  const power = freqs.map((f) => P.dynamicPower(cmin, p._Vdd, f) * 1e6); // µW
  Plotly.react("plot-power", [
    { x: freqs, y: power, name: "동적 전력 C_TSV·V_dd²·f", mode: "lines", line: { color: "#ff8a5a" } },
    { x: [p._freqHz], y: [P.dynamicPower(cmin, p._Vdd, p._freqHz) * 1e6], mode: "markers", marker: { color: "#fff", size: 10 }, name: "현재 주파수" },
  ], darkLayout({
    title: "TSV 동적 전력 vs 주파수",
    xaxis: { title: "주파수 (Hz)", type: "log" },
    yaxis: { title: "전력 (µW)", type: "log" },
  }), plotConfig);
}

// ---------------------------------------------------------------------
// Sensitivity (tornado) tab
// ---------------------------------------------------------------------
function tornado(elId, title, baseline, variants) {
  const labels = variants.map((v) => v.label);
  const lowPct = variants.map((v) => ((v.low - baseline) / baseline) * 100);
  const highPct = variants.map((v) => ((v.high - baseline) / baseline) * 100);
  Plotly.react(elId, [
    { y: labels, x: lowPct, name: "-20%", type: "bar", orientation: "h", marker: { color: "#5aa9ff" } },
    { y: labels, x: highPct, name: "+20%", type: "bar", orientation: "h", marker: { color: "#ff8a5a" } },
  ], darkLayout({
    title,
    barmode: "overlay",
    xaxis: { title: "기준값 대비 변화율 (%)" },
    margin: { t: 40, r: 20, b: 45, l: 130 },
  }), plotConfig);
}

function plotTornado(p) {
  const pct = 0.2;
  const vary = (key) => ({ low: p[key] * (1 - pct), high: p[key] * (1 + pct) });

  const rBase = P.R_dc(p);
  tornado("plot-tornado-r", "R_DC 민감도 (±20%)", rBase, [
    { label: "TSV 직경", low: P.R_dc({ ...p, D_tsv_um: vary("D_tsv_um").low }), high: P.R_dc({ ...p, D_tsv_um: vary("D_tsv_um").high }) },
    { label: "산화막 두께", low: P.R_dc({ ...p, tox_nm: vary("tox_nm").low }), high: P.R_dc({ ...p, tox_nm: vary("tox_nm").high }) },
    { label: "TSV 길이", low: P.R_dc({ ...p, l_tsv_um: vary("l_tsv_um").low }), high: P.R_dc({ ...p, l_tsv_um: vary("l_tsv_um").high }) },
    { label: "저항률(재질)", low: P.R_dc({ ...p, rho: vary("rho").low }), high: P.R_dc({ ...p, rho: vary("rho").high }) },
  ]);

  const lBase = P.L_tsv(p);
  tornado("plot-tornado-l", "L_TSV 민감도 (±20%)", lBase, [
    { label: "TSV 직경", low: P.L_tsv({ ...p, D_tsv_um: vary("D_tsv_um").low }), high: P.L_tsv({ ...p, D_tsv_um: vary("D_tsv_um").high }) },
    { label: "산화막 두께", low: P.L_tsv({ ...p, tox_nm: vary("tox_nm").low }), high: P.L_tsv({ ...p, tox_nm: vary("tox_nm").high }) },
    { label: "TSV 길이", low: P.L_tsv({ ...p, l_tsv_um: vary("l_tsv_um").low }), high: P.L_tsv({ ...p, l_tsv_um: vary("l_tsv_um").high }) },
  ]);

  const cBase = P.C_tsv_min(p);
  tornado("plot-tornado-c", "C_TSV_MIN 민감도 (±20%)", cBase, [
    { label: "TSV 직경", low: P.C_tsv_min({ ...p, D_tsv_um: vary("D_tsv_um").low }), high: P.C_tsv_min({ ...p, D_tsv_um: vary("D_tsv_um").high }) },
    { label: "산화막 두께", low: P.C_tsv_min({ ...p, tox_nm: vary("tox_nm").low }), high: P.C_tsv_min({ ...p, tox_nm: vary("tox_nm").high }) },
    { label: "TSV 길이", low: P.C_tsv_min({ ...p, l_tsv_um: vary("l_tsv_um").low }), high: P.C_tsv_min({ ...p, l_tsv_um: vary("l_tsv_um").high }) },
    { label: "도핑 농도", low: P.C_tsv_min({ ...p, Na_cm3: vary("Na_cm3").low }), high: P.C_tsv_min({ ...p, Na_cm3: vary("Na_cm3").high }) },
  ]);
}

// ---------------------------------------------------------------------
// math helpers
// ---------------------------------------------------------------------
function linspace(a, b, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = a + ((b - a) * i) / (n - 1);
  return out;
}
function logspace(a, b, n) {
  const la = Math.log10(a), lb = Math.log10(b);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.pow(10, la + ((lb - la) * i) / (n - 1));
  return out;
}

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------
const renderedTabs = new Set();
function activateTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((s) => s.classList.toggle("active", s.id === `tab-${name}`));
  renderTab(name);
}

function renderTab(name) {
  const p = readParams();
  switch (name) {
    case "overview": plotBode(p); plotLumpedCompare(p); break;
    case "resistance": plotRvsF(p); plotRvsDiameter(p); break;
    case "inductance": plotLHeatmap(p); plotLCrossover(p); break;
    case "capacitance": plotCoxSurface(p); plotCminSurface(p); plotCvsTox(p); plotCvsDoping(p); break;
    case "cv": plotCV(p); break;
    case "delay": plotDelayHeatmap(p); plotPower(p); break;
    case "sensitivity": plotTornado(p); break;
  }
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

// ---------------------------------------------------------------------
// Main update loop
// ---------------------------------------------------------------------
function currentActiveTab() {
  const active = document.querySelector(".tab-btn.active");
  return active ? active.dataset.tab : "overview";
}

function updateAll() {
  const p = readParams();
  updateValLabels(p);
  renderScorecard(p);
  renderTab(currentActiveTab());
}

Object.values(els).forEach((el) => {
  el.addEventListener("input", updateAll);
});

document.getElementById("resetBtn").addEventListener("click", () => {
  els.D_tsv_um.value = 5;
  els.tox_nm.value = 118.2;
  els.l_tsv_um.value = 20;
  els.metal.value = "Cu";
  els.Na_log.value = Math.log10(2e15);
  els.Qot_log.value = 11;
  els.T_K.value = 300;
  els.freq_log.value = 9;
  els.Vdd.value = 1.0;
  els.Rdr.value = 2000;
  els.Rw.value = 200;
  els.Cw.value = 5;
  els.Cio.value = 3;
  updateAll();
});

updateAll();
