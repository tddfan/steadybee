# Steadybee prototype v2 — design (approved 2026-06-28)

**Goal:** Rebuild the clickable prototype as **Option B** — a single calm "Your Plan" dashboard —
removing back-and-forth and folding the X-ray, the retirement answer, a projection chart, and the
scenario levers into one scrollable page.

**Journey (4 pages, down from 6):** `index` → `input` → **`plan`** → `reserve`.
`plan.html` is new and replaces `demo` + `checkup` + `report`.

**`plan` dashboard, top→bottom:**
1. Header — "Your Plan · Bella, 60 · valued just now at live prices · nothing stored".
2. Hero answer — "money lasts to age N" + confidence chip + **projection chart** (pot to age 100,
   confidence band, retirement + event markers).
3. Levers (~5, illustrative) — work longer · spend less · pay more into SIPP · lower fees · one-off
   event (windfall / big expense). Update the answer + chart live.
4. Portfolio X-ray — crash headline (£), concentration, correlation, **currency risk**, fees; each
   one line + "show me why". Fees shows category benchmark + impact, never a buy recommendation.
5. Premium teaser (locked) — "Advanced planning … Coming as Premium" (the C path, shown not built).
6. CTA → reserve + compliance/trust footer.

**Look & feel:** calm & editorial (Wealthfront Path) — serif numbers, soft chart, whitespace, teal+honey.

**Rules baked in:** model consequences not recommendations · "illustration, not advice" · no
fund/buy recs · DB pension immutable · store nothing in free mode · levers free · IHT interest-probe only.

**Out of scope:** the real deterministic engine (numbers illustrative) and the full Premium "C" depth.
