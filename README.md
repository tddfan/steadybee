# 🐝 Steadybee

A retirement decision workspace for people considering retirement, reduced work or a change in spending.

**Current status:** working research prototype. It organises information entered by a person or household. Three separately labelled fictional examples demonstrate scenario comparisons and a decision brief. Personal retirement forecasts, accounts and payments are not connected.

## What you can try

- An interactive landing preview with an accessible-savings chart, pension-access split, spending comparison and household dates. Selected fictional choices carry into the workspace.
- A short DC or income-led start, with unknown, estimated and zero values kept distinct.
- Progressive details: partner, dated income, pension access, savings, contributions, housing/costs and manual accounts.
- Owner-aware summaries and calendar timelines. Account details reconcile against entered totals without being added twice.
- Baseline plus two named alternatives, combining timing, spending, part-time income and major costs. Personal choices record changes without calculated outcomes; fictional examples have inspectable annual workings.
- A compact printable household example brief, optional workings appendix and CSV export. A personal brief preserves entered facts and missing information.
- Optional local save, resume, validated JSON backup/import and deletion. Saving is limited to this browser profile, unencrypted and not shared across devices.
- A feedback download for research notes. It does not submit anything to a server or take payment.

Fictional calculations are deterministic demonstrations using authored assumptions, not a UK tax or pension engine. They do not establish the correctness of personal planning. See the [build plan and agent findings](docs/2026-10-09-prototype-loop-plan.md) and [build review](docs/2026-10-09-prototype-build-review.md).

The latest [example validation loop](docs/2026-10-09-example-validation-loop.md) records the founder’s two-year-shortfall feedback, three simulated review rounds, annual funding/shortfall explanations, simpler comparisons and 49 checks. Customer willingness to pay remains unverified.

## Run and verify

No npm application dependencies or frontend framework are required.

```sh
node scripts/build-prototype.mjs
node --test tests/test_state.mjs tests/test_app_updates.cjs
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000/`. Browser interaction checks require Playwright and a Chromium executable:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CHROME_EXECUTABLE_PATH=/absolute/path/to/chrome-headless-shell \
node --test tests/test_browser.mjs
```

The browser suite runs its own local HTTP server. It checks intake, household dates, mode separation, compound scenarios, save/import/delete, deployment restoration, keyboard focus, mobile reflow and printable output. Generated screenshots/PDFs stay in ignored `test-artifacts/`.

## Deployment and installed app

The existing GitHub → Netlify pipeline builds with `node scripts/build-prototype.mjs` and publishes `dist/`. Each build stamps its version into all HTML pages and `version.json`.

The installed web app checks on reopen, focus, reconnection and once a minute while visible. A new deployment refreshes after a short idle period. A one-use snapshot preserves the current workspace and unfinished form edits in the same tab; it is removed after restoration. This is separate from optional persistent local saving. The manifest and existing bee icons support Home Screen installation. There is no offline service worker.

## Product direction

A future paid release must answer a real personal decision with verified accessible-money cash flow, declared tax/pension support, explainable assumptions and reproducible outputs. Price, access cadence, purchase and return behavior still require real-user evidence. Simulated persona reviews are critique, not interviews or observed demand; not everyone has a paid need.

The static prototype is an experience experiment. The agreed production direction remains Python/FastAPI with server-rendered templates, as recorded in [project rules](CLAUDE.md). Older [vision](docs/VISION.md), [strategy](docs/STRATEGY.md), [functionality](docs/FUNCTIONALITY.md) and [journey](docs/USER_JOURNEY.md) documents describe aspirations; current build limits above take precedence for prototype claims.

Steadybee is decision-support and educational software. It does not recommend securities, allocations or pension transfers.
