// Sanity-check physics.js against numeric values explicitly stated in the
// Katti et al. 2010 paper's body text (Table data itself is embedded as
// images in the PDF and not machine-extractable, but the text calls out
// several concrete numbers we can cross-check against).
//
// Run: node test/validate.js
import {
  R_dc, R_ac, L_tsv, skinCrossoverFreq, C_ox, C_dep_min, C_tsv_min,
  V_fb, V_th, C_tsv_of_V, MATERIALS,
} from "../physics.js";

let failures = 0;
function check(label, got, expected, tolPct) {
  const pct = Math.abs(got - expected) / Math.abs(expected) * 100;
  const ok = pct <= tolPct;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}: got=${got.toPrecision(4)}  expected~${expected}  (${pct.toFixed(1)}% diff, tol ${tolPct}%)`
  );
}

console.log("=== R_TSV_DC: 5um diameter, 20um length, Cu -> paper states ~18 mOhm ===");
check(
  "R_dc",
  R_dc({ D_tsv_um: 5, tox_nm: 100, l_tsv_um: 20, rho: MATERIALS.Cu.rho }),
  18e-3,
  10
);

console.log("\n=== Skin-depth crossover frequency ===");
check(
  "f(delta=r), D=5um, tox=100nm -> paper: 738 MHz",
  skinCrossoverFreq({ D_tsv_um: 5, tox_nm: 100, rho: MATERIALS.Cu.rho }),
  738e6,
  5
);
check(
  "f(delta=r), D=2um, tox=50nm -> paper: 4.71 GHz",
  skinCrossoverFreq({ D_tsv_um: 2, tox_nm: 50, rho: MATERIALS.Cu.rho }),
  4.71e9,
  5
);

console.log("\n=== L_TSV: 5um diameter, 20um length -> paper: ~10 pH ===");
check(
  "L_tsv",
  L_tsv({ D_tsv_um: 5, tox_nm: 100, l_tsv_um: 20 }),
  10e-12,
  10
);

console.log("\n=== R_AC continuity / monotonic increase with frequency ===");
{
  const p = { D_tsv_um: 5, tox_nm: 100, l_tsv_um: 20, rho: MATERIALS.Cu.rho };
  const rdc = R_dc(p);
  const rLow = R_ac(1e3, p);
  const rHigh = R_ac(100e9, p);
  const ok = Math.abs(rLow - rdc) / rdc < 1e-6 && rHigh > rdc;
  console.log(`${ok ? "PASS" : "FAIL"}  R_ac(1kHz)=${rLow.toExponential(3)} ~= R_dc=${rdc.toExponential(3)}; R_ac(100GHz)=${rHigh.toExponential(3)} > R_dc`);
  if (!ok) failures++;
}

console.log("\n=== Capacitance trends (Fig. 4/5/7 qualitative checks) ===");
{
  const base = { D_tsv_um: 5, tox_nm: 100, l_tsv_um: 20, Na_cm3: 2e15, eps_ox_r: 3.9, eps_si_r: 11.9, T_K: 300 };
  const coxThin = C_ox({ ...base, tox_nm: 50 });
  const coxThick = C_ox({ ...base, tox_nm: 150 });
  ok1("Cox increases as oxide liner thins", coxThin > coxThick);

  const coxSmallD = C_ox({ ...base, D_tsv_um: 2 });
  const coxBigD = C_ox({ ...base, D_tsv_um: 10 });
  ok1("Cox increases with TSV diameter", coxBigD > coxSmallD);

  const cminLowDope = C_tsv_min({ ...base, Na_cm3: 1e14 });
  const cminHighDope = C_tsv_min({ ...base, Na_cm3: 1e16 });
  ok1("CTSV_min increases with doping concentration", cminHighDope > cminLowDope);

  const cminThin = C_tsv_min({ ...base, tox_nm: 50 });
  const cminThick = C_tsv_min({ ...base, tox_nm: 150 });
  ok1("CTSV_min decreases as oxide liner thickens", cminThin > cminThick);
}

console.log("\n=== C-V curve monotonicity & region continuity ===");
{
  const p = { D_tsv_um: 5, tox_nm: 118.2, l_tsv_um: 20, Na_cm3: 2e15, eps_ox_r: 3.9, eps_si_r: 11.9, phi_m_eV: 4.7, Qot_cm2: 1e11, T_K: 300 };
  const vfb = V_fb(p);
  const vth = V_th(p);
  ok1("VTh > VFB", vth > vfb);
  const cAcc = C_tsv_of_V(vfb - 1, p);
  const cMid = C_tsv_of_V((vfb + vth) / 2, p);
  const cMin = C_tsv_of_V(vth + 1, p);
  ok1("C decreases monotonically from accumulation -> depletion -> min", cAcc > cMid && cMid > cMin);
  console.log(`   VFB=${vfb.toFixed(3)}V  VTh=${vth.toFixed(3)}V  Cacc=${(cAcc*1e15).toFixed(2)}fF  Cmid=${(cMid*1e15).toFixed(2)}fF  Cmin=${(cMin*1e15).toFixed(2)}fF`);
}

function ok1(label, cond) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
