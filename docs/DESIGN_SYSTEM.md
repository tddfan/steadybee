# Steadybee — Design System

## Current prototype contract · 27 October 2026

The approved Apple Health / Copilot Money Bento specification is implemented through `prototype/bento-system.css`. Main sections are Assets & debt, Income & spending and Planning. Planning has a separate raised segmented switch for Lifeline and Goals & insights; owner/category filters remain pills. The saved routes and the default Lifeline journey stay supported.

Use a #F2F2F7 canvas, white 18px Bento cards and 10px controls. Primary blue is #007AFF; liquid assets use #1F8A5B, pensions #7C5CBF, property #C58B3B, liabilities #FF3B30 and review warnings #CC6600. User ownership must not recolour an asset-category icon. Numeric values always use tabular numerals.

Follow outcome → three driver KPIs → unified chart workspace → grouped item lists. The five-tier scale is hero `clamp(1.85rem,3vw,2.5rem)`, KPI `clamp(1.3rem,2vw,1.65rem)`, card heading 1.15rem, row .95rem and metadata .8rem on the 18px root. This latest user-approved metadata scale supersedes the older minimum-size guidance below; primary prose and controls remain readable and targets are at least 44px.

At widths below 768px, dialogs become bottom sheets with swipe-to-close handles and a keyboard close option. The 340px desktop scenario inspector becomes a resizable, swipeable bottom sheet. Respect safe areas and reduced motion. Currency values are grouped while typing; debts and expenses derive their display sign from category and are stored as positive amounts.

Access-gap warnings reuse the drawdown engine's eligibility rules and actual projected shortfalls. Future retirement inputs require a retirement age above current age and below an explicitly chosen horizon age. Past retirement records remain valid and are never rewritten to satisfy an input control.

The job of the UI is **trust and clarity**, for an anxious 45–70 audience trusting us with their life
savings. Calm beats flashy. (Summary lives in [CLAUDE.md](../CLAUDE.md).)

## Brand voice — "approachable expertise"
Warm but credible; friendly but never flippant. A reassuring expert, not a cartoon. The bee signals
**steady, industrious, trustworthy** — used with restraint. Tasteful hive/honey/nest-egg motifs are
fine; baby-talk and panic language are not.

## Accessibility-first (non-negotiable for this audience)
- **Base font ≥ 18px**; headings clearly larger. Never below 16px.
- **High contrast** (WCAG AA minimum; aim AAA for body text).
- **Generous tap/click targets** (≥ 44px) and spacing.
- **Plain English.** No jargon without a one-line plain explanation.
- **Minimal steps per screen.** One primary action per view.
- Full keyboard navigation; semantic HTML; alt text; visible focus states.

## Layout & information hierarchy
- **One plain-English headline + one number leads every screen.**
- Detail (correlation matrices, graphs, assumptions) lives behind **"show me why"**, collapsed by
  default. Anxious users see clarity; analytical users can drill down.
- Money-denominated, comparative numbers over abstract scores
  ("−£136k vs −£21k in a 2022 repeat", not "risk score: 72").

## Colour (calm, trustworthy; encode meaning sparingly)
- **Primary:** a deep, trustworthy blue/teal (calm, financial-credible).
- **Accent:** a warm honey/amber (the bee) — used for highlights/CTAs, not whole backgrounds.
- **Semantic:** muted green (on-track), amber (caution), restrained red (risk) — never alarmist red washes.
- Generous white space. Flat surfaces. No gradients/heavy shadows.

## Typography
- One humanist sans for UI (readable, friendly, professional). Two weights (regular/medium).
- Sentence case everywhere. No ALL CAPS, no Title Case.
- Body line-height ~1.6–1.7 for easy reading.

## Trust-UX patterns (must appear)
- **Independence + privacy banner** early: "We sell nothing. Your data is encrypted, never sold,
  deletable anytime."
- **"AI explains, code computes"** note near any calculated figure.
- **Confirm-holdings step** before calculating ("We read these — confirm").
- **Cited sources** visible on assumptions (BoE/ONS/HMRC).
- **"Illustration, not advice"** on every projection (also a compliance requirement).

## Core components
- **Headline result card** — big number + one plain sentence + "show me why".
- **Check-up summary** — concentration, fees, drawdown exposure, each one line, plain language.
- **Scenario sandbox** — behavioural-lever sliders (save more / work longer / spend less / delay
  state pension) → live probability readout. Illustrative labelling required.
- **MOT report (PDF)** — professional, calm, shareable; assumptions + risks + year-over-year + checklist.
- **Trust footer** — independence, privacy, disclaimers, sources.

## Tone examples
- ✅ "You look diversified, but 80% of your money rides on one theme."
- ✅ "Based on current rules, your money could last to age 91 — here's what would change that."
- ❌ "Your plan is lying to you." ❌ "Buy bonds now." ❌ "Guaranteed comfortable retirement."

## Don'ts
- No dark patterns, no fake urgency, no countdown timers.
- No anxiety-pinging notifications. Calm cadence only.
- No flashy animation for its own sake; motion only to aid understanding.
