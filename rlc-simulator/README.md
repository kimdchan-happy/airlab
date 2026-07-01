# TSV RLC Simulator

TSV(Through Silicon Via) 공정 조건(직경, 산화막 라이너 두께, 길이, 기판 도핑 농도, 도체 재질 등)에 따라
전기적 특성(R/L/C, C-V, 지연, 전력)이 어떻게 달라지는지 인터랙티브하게 탐색하는 브라우저 기반 시뮬레이터입니다.

기반 논문: G. Katti, M. Stucchi, K. De Meyer, W. Dehaene, "Electrical Modeling and
Characterization of Through Silicon Via for Three-Dimensional ICs," *IEEE Trans.
Electron Devices*, vol. 57, no. 1, pp. 256–262, Jan. 2010.

## 실행 방법

### 방법 A: 단일 HTML 파일 (서버 불필요, 추천)
`tsv-rlc-simulator-standalone.html` 하나만 있으면 됩니다. Plotly.js와 physics.js/app.js가
모두 이 파일 안에 인라인되어 있어 더블클릭으로 열거나 `file://` 경로로 브라우저에 바로
드래그해도 그대로 동작합니다. 인터넷 연결도 필요 없습니다.

### 방법 B: 소스 파일 그대로 (개발용)
`index.html`/`app.js`/`physics.js`는 ES 모듈(`import`)로 분리되어 있어 `file://`로 직접
열면 브라우저 CORS 정책에 막힙니다. 로컬 웹서버로 띄워서 여세요.

```bash
cd rlc-simulator
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

`tsv-rlc-simulator-standalone.html`은 `index.html`/`style.css`/`physics.js`/`app.js`/
`vendor/plotly.min.js`를 하나로 합쳐 생성한 빌드 산출물입니다. 소스 파일을 수정했다면
아래로 다시 생성하세요:

```bash
cd rlc-simulator
python3 - <<'PY'
import re
html = open("index.html", encoding="utf-8").read()
css = open("style.css", encoding="utf-8").read()
physics = re.sub(r'(?m)^export\s+', '', open("physics.js", encoding="utf-8").read())
app = re.sub(r'(?m)^import \* as P from "\./physics\.js";\n', '', open("app.js", encoding="utf-8").read())
plotly = open("vendor/plotly.min.js", encoding="utf-8").read()
names = ["CONST","MATERIALS","geometry","R_dc","skinDepth","skinCrossoverFreq","R_ac","L_tsv",
         "C_ox","n_i","Vt","phi_F","R_max","C_dep_min","C_tsv_min","V_fb","V_th",
         "C_tsv_of_V","elmoreDelay","dynamicPower","DEFAULT_PARAMS"]
combined = physics + "\nconst P = { " + ", ".join(names) + " };\n" + app
html = html.replace('<link rel="stylesheet" href="style.css" />', f"<style>\n{css}\n</style>")
html = html.replace('<script src="vendor/plotly.min.js"></script>', f"<script>\n{plotly}\n</script>")
html = html.replace('<script type="module" src="app.js"></script>', f"<script>\n{combined}\n</script>")
open("tsv-rlc-simulator-standalone.html", "w", encoding="utf-8").write(html)
PY
```

Plotly.js(MIT license, v3.6.0)는 `vendor/plotly.min.js`에 오프라인으로 번들되어 있어
인터넷 연결 없이도 동작합니다.

## 화면 구성

- **개요**: 현재 파라미터에서 R/ωL/1/ωC 중 어느 임피던스 성분이 지배적인지 Bode 형태로 보여주고,
  Fig. 8의 RLC→RC 근사가 타당한 주파수 영역을 확인합니다.
- **저항 & Skin Effect**: R_AC(f)와 skin-depth 교차 주파수, 직경/길이별 R_DC 스윕.
- **인덕턴스**: 직경×길이에 따른 L_TSV 히트맵과 ωL=R_DC 교차 주파수.
- **커패시턴스**: 논문 Fig. 4/5/6/7을 재현 — C_ox, C_TSV_MIN을 직경·산화막 두께·도핑 농도별로 확인.
- **C-V 특성**: 축적/공핍/최소공핍 3영역의 quasi-static C-V 곡선, V_FB/V_Th 표시.
- **지연 & 전력**: Fig. 9/10 재현 — Elmore 지연 히트맵(R_TSV vs C_TSV)과 동적 전력.
- **민감도 분석**: 각 공정 파라미터를 ±20% 흔들었을 때 R/L/C가 얼마나 민감한지 토네이도 차트로 비교.

## 물리 모델 (`physics.js`)

### 기하 구조 정의
- `D_TSV`: 식각된 via 직경 → `R_ox = D_TSV/2`
- `t_ox`: 측벽 산화막 라이너 두께 → `R_metal = R_ox − t_ox`
- 저항/인덕턴스는 도체 core 반경(`R_metal`)을, 커패시턴스는 `R_ox`/`R_metal`을 사용합니다.

이 정의는 논문 본문에 언급된 세 개의 독립적 수치와 대조하여 역검증했습니다
(`test/validate.js` 참고):

| 항목 | 조건 | 논문 값 | 모델 값 |
|---|---|---|---|
| R_TSV_DC | D=5µm, l=20µm, Cu | ~18 mΩ | 18.6 mΩ |
| Skin-depth 교차 주파수 | D=5µm, t_ox=100nm | 738 MHz | 739 MHz |
| Skin-depth 교차 주파수 | D=2µm, t_ox=50nm | 4.71 GHz | 4.71 GHz |
| L_TSV | D=5µm, l=20µm | ~10 pH | 10.3 pH |

### 수식 목록
- **R_DC** (Eq. 1): `ρ·l / (π·R_metal²)`
- **R_AC**: Goldfarb–Pucel 환형 도체 근사. `δ = sqrt(ρ/(π f μ₀))`; `δ ≥ R_metal`이면 `R_AC=R_DC`,
  아니면 전류가 반경 표면의 두께 `δ` 환형 영역에만 흐른다고 근사.
- **L_TSV** (Eq. 2): Pucel의 부분 자기 인덕턴스 경험식.
- **C_ox** (Eq. 6): 원통형 산화막 커패시턴스 `2πε_ox l / ln(R_ox/R_metal)`.
- **C_dep_min, C_TSV_MIN** (Eq. 7): 최대 공핍반경 `R_max`와의 직렬 커패시턴스.
- **R_max**: 부록 (A1)-(A2)의 1-D 원통 Poisson 방정식 해를 강반전 조건
  `ψ_s(R_max) = 2φ_F`(`φ_F = V_t ln(N_a/n_i)`)에서 수치적으로(이분법) 구합니다.
- **V_FB, V_Th, C(V)**: 부록 (A3)-(A5)를 일반화한 실린더 MOS 관계식으로 구현
  (아래 "OCR 보정" 참고).
- **Elmore 지연** (Eq. 8), **동적 전력** `C_TSV·V_dd²·f`.

### OCR 보정 사항 (중요)
PDF에서 텍스트를 추출하는 과정에서 부록의 강반전 조건 `2ln(N_a/n_i)` 항에 열전압
`V_t = kT/q` 배율이 누락되어 있었습니다(표준 MOS 이론상 반드시 필요한 물리량이며, 없으면
`ψ_s`의 단위가 맞지 않습니다). 이 시뮬레이터는 Poisson 방정식 (3)-(5)로부터 `ψ(r)` 해를
독립적으로 재유도해 (A1)과 정확히 일치함을 확인했고, 강반전 조건에는 표준 평면 MOS 이론의
`2φ_F = 2·V_t·ln(N_a/n_i)`를 사용해 복원했습니다. 나머지 V_FB/V_Th 구조(일함수차 항,
공핍전하가 산화막에 유도하는 전압강하 항)는 이 보정을 제외하면 논문의 (A4)-(A5)와 동일한
형태입니다. Table I–V의 원본 수치는 PDF 내 이미지로 삽입되어 있어 텍스트로 추출되지 않았으므로,
대신 논문 본문에 명시된 수치(위 표)로 교차 검증했습니다.

## 검증

```bash
node test/validate.js
```

논문 본문에 언급된 수치들과의 대조 및 물리적 정합성(단조성, 부호 등)을 확인합니다.

## 파일 구조

```
rlc-simulator/
├── tsv-rlc-simulator-standalone.html  # 단일 파일 빌드 산출물 (서버 불필요, 이거 하나만 배포하면 됨)
├── index.html       # 탭형 대시보드 UI (소스, ES 모듈)
├── style.css
├── app.js           # 슬라이더 → physics.js 호출 → Plotly 렌더링
├── physics.js        # 논문 수식 구현 (프레임워크 의존성 없는 순수 JS)
├── vendor/plotly.min.js
└── test/validate.js  # 논문 대조 검증 스크립트
```
