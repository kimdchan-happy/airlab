// TSV RLC physical model
//
// Reference: G. Katti, M. Stucchi, K. De Meyer, W. Dehaene,
// "Electrical Modeling and Characterization of Through Silicon Via
// for Three-Dimensional ICs," IEEE Trans. Electron Devices, vol. 57,
// no. 1, pp. 256-262, Jan. 2010.
//
// Geometry convention used throughout this file:
//   D_TSV   : as-etched TSV (via hole) diameter -> R_ox = D_TSV / 2
//   t_ox    : oxide liner thickness deposited on the via sidewall
//   R_metal : radius of the conducting (Cu/W) core = R_ox - t_ox
//   l_TSV   : TSV length (post thinning)
// This convention was reverse-validated against the paper's worked
// examples (see test/validate.js): with D=5um/t_ox=100nm it reproduces
// R_DC=18.6mOhm and the 738MHz skin-depth crossover quoted in the text,
// and with D=2um/t_ox=50nm it reproduces the quoted 4.71GHz crossover;
// L_TSV(D=5um,l=20um)=10.1pH matches the paper's "~10pH" estimate.
//
// Note on Appendix (A2)/(A4): the paper's OCR'd text drops the thermal
// voltage Vt inside the strong-inversion condition "2ln(Na/ni)". The
// physically consistent (and dimensionally correct) condition is the
// standard MOS strong-inversion criterion surface-potential = 2*phi_F,
// with phi_F = Vt*ln(Na/ni). This file restores that factor; it was
// independently re-derived from Poisson's equation (3)-(5) given in the
// paper (see derivation notes in README.md) and the rest of the
// structure (VFB, VTh, series R_dep(V)) follows the same appendix.

export const CONST = {
  q: 1.602176634e-19,      // C
  eps0: 8.8541878128e-12,  // F/m
  mu0: 4 * Math.PI * 1e-7, // H/m
  k_eV: 8.617333262e-5,    // eV/K
  Eg300: 1.12,             // eV, Si bandgap near 300K
  chi_si: 4.05,            // eV, Si electron affinity
};

export const MATERIALS = {
  Cu: { name: "Cu", rho: 16.8e-9 },  // ohm*m (paper's value)
  W:  { name: "W",  rho: 52.8e-9 },  // ohm*m (bulk tungsten, typical liner-CVD via fill)
};

// ---- geometry helpers -----------------------------------------------
export function geometry(p) {
  const Rox = (p.D_tsv_um * 1e-6) / 2;
  const Rmetal = Rox - p.tox_nm * 1e-9;
  const l = p.l_tsv_um * 1e-6;
  return { Rox, Rmetal, l };
}

// ---- Resistance (Eq. 1, Goldfarb-Pucel skin-effect approximation) ---
export function R_dc(p) {
  const { Rmetal, l } = geometry(p);
  const rho = p.rho ?? MATERIALS.Cu.rho;
  return (rho * l) / (Math.PI * Rmetal * Rmetal);
}

export function skinDepth(freqHz, rho, mu = CONST.mu0) {
  if (freqHz <= 0) return Infinity;
  return Math.sqrt(rho / (Math.PI * freqHz * mu));
}

export function skinCrossoverFreq(p) {
  // frequency where skin depth == R_metal
  const { Rmetal } = geometry(p);
  const rho = p.rho ?? MATERIALS.Cu.rho;
  return rho / (Math.PI * CONST.mu0 * Rmetal * Rmetal);
}

export function R_ac(freqHz, p) {
  const { Rmetal, l } = geometry(p);
  const rho = p.rho ?? MATERIALS.Cu.rho;
  const delta = skinDepth(freqHz, rho);
  const Rdc = R_dc(p);
  if (!isFinite(delta) || delta >= Rmetal) return Rdc;
  const areaAnnulus = Math.PI * (Rmetal * Rmetal - (Rmetal - delta) * (Rmetal - delta));
  return Math.max(Rdc, (rho * l) / areaAnnulus);
}

// ---- Inductance (Eq. 2, Pucel empirical partial self-inductance) ----
export function L_tsv(p) {
  const { Rmetal, l } = geometry(p);
  const r = Rmetal;
  const twoL = 2 * l;
  const root = Math.sqrt(r * r + twoL * twoL);
  const term1 = twoL * Math.log((twoL + root) / r);
  const term2 = r - root;
  return (CONST.mu0 / (4 * Math.PI)) * (term1 + term2);
}

// ---- Capacitance: accumulation (Eq. 6) -------------------------------
export function C_ox(p) {
  const { Rox, Rmetal, l } = geometry(p);
  const epsOx = p.eps_ox_r * CONST.eps0;
  return (2 * Math.PI * epsOx * l) / Math.log(Rox / Rmetal);
}

// ---- Silicon material helpers ----------------------------------------
export function n_i(T, prefactor = 7.42e15) {
  // calibrated so n_i(300K) ~= 1.5e10 cm^-3 with Eg=1.12eV
  const val = prefactor * Math.pow(T, 1.5) * Math.exp(-CONST.Eg300 / (2 * CONST.k_eV * T));
  return val; // cm^-3
}

export function Vt(T) {
  return CONST.k_eV * T; // volts (kT/q with k in eV/K -> already volts)
}

export function phi_F(p) {
  const T = p.T_K ?? 300;
  return Vt(T) * Math.log(p.Na_cm3 / n_i(T));
}

// ---- Maximum depletion radius (Eq. A1/A2, strong-inversion condition) --
// Solve: (qNa/4eps_si) * [Rox^2 + Rdep^2*(2ln(Rdep/Rox) - 1)] = 2*phi_F
// for Rdep = Rmax, given Rdep >= Rox.
function psiSurface(Rdep, Rox, Na_m3, epsSi) {
  const c = (CONST.q * Na_m3) / (4 * epsSi);
  return c * (Rox * Rox + Rdep * Rdep * (2 * Math.log(Rdep / Rox) - 1));
}

export function R_max(p) {
  const { Rox } = geometry(p);
  const T = p.T_K ?? 300;
  const epsSi = p.eps_si_r * CONST.eps0;
  const Na_m3 = p.Na_cm3 * 1e6; // cm^-3 -> m^-3
  const target = 2 * phi_F(p);

  let lo = Rox * 1.0000001;
  let hi = Rox * 5000; // generous upper bound; will expand if needed
  let f = (r) => psiSurface(r, Rox, Na_m3, epsSi) - target;
  while (f(hi) < 0 && hi < Rox * 1e9) hi *= 4;

  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi); // geometric bisection (log-scale)
    const fm = f(mid);
    if (Math.abs(fm) < 1e-30 && i > 5) return mid;
    if (fm > 0) hi = mid; else lo = mid;
  }
  return Math.sqrt(lo * hi);
}

export function C_dep_min(p) {
  const { Rox, l } = geometry(p);
  const Rmax = R_max(p);
  const epsSi = p.eps_si_r * CONST.eps0;
  return (2 * Math.PI * epsSi * l) / Math.log(Rmax / Rox);
}

export function C_tsv_min(p) {
  const Cox = C_ox(p);
  const Cdm = C_dep_min(p);
  return (Cox * Cdm) / (Cox + Cdm);
}

// ---- Flatband / threshold voltage, generalized to cylindrical MOS ----
// (standard planar-MOS relations mapped to cylindrical geometry; see
// README derivation notes)
export function V_fb(p) {
  const { Rox, Rmetal } = geometry(p);
  const epsOx = p.eps_ox_r * CONST.eps0;
  const Qot_m2 = (p.Qot_cm2 ?? 0) * 1e4; // cm^-2 -> m^-2
  const phi_m = p.phi_m_eV ?? 4.7;
  const T = p.T_K ?? 300;
  const phi_s = CONST.chi_si + CONST.Eg300 / 2 + phi_F(p);
  const phi_ms = phi_m - phi_s;
  const oxideDrop = (Rox * CONST.q * Qot_m2 * Math.log(Rox / Rmetal)) / epsOx;
  return phi_ms - oxideDrop;
}

export function V_th(p) {
  const { Rox, Rmetal } = geometry(p);
  const epsOx = p.eps_ox_r * CONST.eps0;
  const Na_m3 = p.Na_cm3 * 1e6;
  const Rmax = R_max(p);
  const depDrop = (CONST.q * Na_m3 * (Rmax * Rmax - Rox * Rox) * Math.log(Rox / Rmetal)) / (2 * epsOx);
  return V_fb(p) + 2 * phi_F(p) + depDrop;
}

// solve depletion radius Rdep given a bias VTSV in [VFB, VTh].
// VTSV = VFB + psi_s(Rdep) + Q_dep(Rdep)/C_ox   (series oxide voltage
// drop caused by the depletion charge itself, same term used in V_th
// with Rdep=Rmax -- see depDrop in V_th()).
function solveRdep(VTSV, p) {
  const { Rox, Rmetal } = geometry(p);
  const epsSi = p.eps_si_r * CONST.eps0;
  const epsOx = p.eps_ox_r * CONST.eps0;
  const Na_m3 = p.Na_cm3 * 1e6;
  const Vfb = V_fb(p);
  const target = VTSV - Vfb;
  const Rmax = R_max(p);

  const oxDrop = (r) => (CONST.q * Na_m3 * (r * r - Rox * Rox) * Math.log(Rox / Rmetal)) / (2 * epsOx);
  const f = (r) => psiSurface(r, Rox, Na_m3, epsSi) + oxDrop(r) - target;

  let lo = Rox * 1.0000001;
  let hi = Rmax;
  if (f(lo) >= 0) return lo;
  if (f(hi) <= 0) return hi;
  for (let i = 0; i < 100; i++) {
    const mid = Math.sqrt(lo * hi);
    if (f(mid) > 0) hi = mid; else lo = mid;
  }
  return Math.sqrt(lo * hi);
}

// Full quasi-static C-V curve: returns C(V) in Farads for a scalar V
export function C_tsv_of_V(VTSV, p) {
  const Cox = C_ox(p);
  const Vfb = V_fb(p);
  const Vth = V_th(p);
  const { Rox, l } = geometry(p);
  const epsSi = p.eps_si_r * CONST.eps0;

  if (VTSV < Vfb) return Cox; // accumulation
  if (VTSV >= Vth) return C_tsv_min(p); // minimum depletion (saturated)

  const Rdep = solveRdep(VTSV, p);
  const Cdep = (2 * Math.PI * epsSi * l) / Math.log(Rdep / Rox);
  return (Cox * Cdep) / (Cox + Cdep);
}

// ---- Lumped model: Elmore delay (Eq. 8) and dynamic power ------------
export function elmoreDelay(o) {
  const { Rdr, Rw_B, Rw_T, Cext, Cint, Cw_B, Cw_T, R_TSV, C_TSV } = o;
  return (
    0.69 * Rdr * Cext +
    0.69 * (Rdr + Rw_B) * Cw_B +
    0.69 * (Rdr + Rw_B + 0.5 * R_TSV) * C_TSV +
    0.69 * (Rdr + Rw_B + R_TSV + Rw_T) * (Cw_T + Cint)
  );
}

export function dynamicPower(C_TSV, Vdd, freqHz) {
  return C_TSV * Vdd * Vdd * freqHz;
}

// ---- default parameter set (matches paper's Fig. 3 caption values) --
export const DEFAULT_PARAMS = {
  D_tsv_um: 5,
  tox_nm: 118.2,
  l_tsv_um: 20,
  Na_cm3: 2e15,
  eps_ox_r: 3.9,
  eps_si_r: 11.9,
  phi_m_eV: 4.7,
  Qot_cm2: 1e11,
  T_K: 300,
  rho: MATERIALS.Cu.rho,
};
