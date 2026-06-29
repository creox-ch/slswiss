# Repository Guide for AI Agents

You are working on **slswiss.ch** — single-page community platform for Russian speakers in Switzerland.
Read this entire file before touching any code.

> 🔑 **Start here after any session loss:** read `STATE.md` (repo root) — it is the canonical
> snapshot of current sprint, paused work, deadlines, real file names and selectors.

---

## What this repo is

- Vanilla HTML/CSS/JS monolith + Supabase backend
- Deployed to GitHub Pages at `https://creox-ch.github.io/slswiss/`
- Production target: `slswiss.ch` (via Netlify, later)
- Owner: Kseniia Chudina (Creox)
- Repo: `creox-ch/slswiss`, default branch `main`

---

## File map

```
slswiss/
├── index.html                   # ⭐ main app (~440KB, single-file SPA). NO soiludi_v4.html, NO admin file.
├── STATE.md                     # canonical state snapshot — read first after session loss
├── CLAUDE.md                    # this file
├── AGENT-PROMPT.md              # sprint launch template
├── HANDOFF.md                   # testing notes, known bugs
├── tests/
│   ├── helpers.js               # shared selectors, loginUser()
│   ├── 01-auth.spec.js          # working
│   ├── 02-content.spec.js       # working
│   ├── 03-pages.spec.js         # working (one .skip with TODO)
│   ├── 04-supabase.spec.js      # working
│   ├── 05-profile-edit.spec.js
│   ├── 06-registration.spec.js
│   └── 07-google-auth.spec.js
├── .github/workflows/test.yml   # CI, triggers on site changes only
├── playwright.config.js         # CommonJS (NOT ESM)
├── package.json
└── docs/                        # ⭐ source of truth for process (moved from Project knowledge 2026-06-24)
    ├── PROCESS.md
    ├── BACKLOG.md
    ├── roadmap-to-2026-09-01.md
    ├── IVANNA-NEXT-SPRINT.md
    ├── meetings/meeting-extract-2026-06-18.md
    └── contracts/{_template, registration-fix, forms-mvp-backend}.md
```

> ⚠️ Main app is `index.html`. Older notes call it `soiludi_v4.html` — that file does NOT exist.

---

## Where the source of truth lives

Process docs now live **in this repo under `docs/`** (moved from Project knowledge 2026-06-24 so
they survive session/Cowork loss). For each sprint the contract is the source of truth:

- `STATE.md` (repo root) — canonical state: current sprint, paused work, deadlines, real selectors
- `docs/IVANNA-NEXT-SPRINT.md` — current sprint brief and concrete steps
- `docs/contracts/<feature>.md` — full list of testable assertions (the contract)
- `docs/BACKLOG.md` — what comes after current sprint
- `docs/PROCESS.md` — the planner-agent-evaluator process
- `docs/roadmap-to-2026-09-01.md` — roadmap to launch
- `HANDOFF.md` — testing setup notes, real selectors, known bugs

If contract and code disagree, contract wins. If contract is wrong, STOP and ask Kseniia — do not improvise.

> **Current sprint:** `forms-mvp-backend` (see `STATE.md`). `registration-fix` is PAUSED
> (waiting on SendPulse SMTP + DNS). Do not assume the sprint — confirm in `STATE.md`.

---

## Sprint cycle (planner-agent-evaluator)

```
Planner (Kseniia)  →  drafts contracts/<feature>.md
Evaluator (testing chat) →  critiques contract, adds edge cases
Planner  →  finalizes
Agent (you)  →  implements per contract
Evaluator (GitHub Actions + testing chat)  →  verifies via Playwright
Agent  →  reads CI, fixes, loops until green
Agent  →  updates BACKLOG.md (sprint → done)
```

You are the Agent. Your evaluator is GitHub Actions CI.

### ⚠️ TDD — обязательно
Наш процесс — **test-driven**: любой новый функционал идёт **в паре с Playwright-тестами** под него,
в том же спринте/PR. Не «код сейчас, тесты потом». Тесты пишет сам Agent (не отдельный чат).
- Каждая фича → тесты в `tests/NN-<feature>.spec.js`, покрывающие пункты контракта (happy path,
  валидация, edge cases, проверка данных в Supabase через `SUPABASE_SERVICE_KEY`).
- CI запускается и на изменения `tests/**` (paths-ignore их больше НЕ исключает), так что новые
  тесты прогоняются автоматически на пуш. Прогон — на задеплоенном сайте (GitHub Pages).
- Залогиненный юзер в тестах — подтверждённый `TEST_USER_EMAIL`/`TEST_USER_PWD` (секреты CI).

---

## Critical learnings — do NOT repeat these

### HTML / JS

- **NEVER** use inline `onclick="..."` with nested string quotes. It silently breaks parsing.
  Use `addEventListener` or named helpers like `closeOverlay(id)`.
- **NEVER** name functions matching DOM/native APIs.
  Real example: `createEvent` collided with `document.createEvent()`. Use `openEventForm()` etc.
- **NEVER** introduce duplicate IDs in HTML (there's been a duplicate `#login-email-input` — fix it if you see it).

### Supabase

- `_supabase` can return null on init. Use retry loop in `initSupabase()`.
- For email-confirmation flow: `email_confirmed_at = null` until link click, then `now()`.
- Create profile via trigger `on_auth_user_created` calling `handle_new_user()`.

### Tests

- Selector priority: `data-testid` > stable ID > semantic role > text. Text matchers fail when multiple elements have same text.
- Use `:visible` filter when DOM has duplicates.
- Use `.last()` or scope (e.g. `#m-login button:has-text("Войти")`) when trigger + submit share text.
- Replace `waitForTimeout` with state-based waits (`waitForSelector`, `waitForResponse`, `waitForFunction`).
- baseURL is `https://creox-ch.github.io/slswiss/` — use `page.goto('')` NOT `'/'`.

### Real selectors (verified, use these)

- Login modal: `#m-login`
  - Email: `#login-email-input`
  - Password: `#login-pwd-input`
  - Submit: `getByRole('button', { name: 'Войти', exact: true }).last()`
- Registration modal: `#m-reg`
  - Steps: `#rs1`, `#rs2`, `#rs3`
  - Step 1 fields: `getByPlaceholder('Имя')`, etc.
  - Step 2: `#rs2 select` (kanton), `#rs2 input` (PLZ)
- Header login button: `button.btn-login`
- Header register button: `button.btn-join:has-text("Вступить")`
- Navigation: `nav li:has-text("Кантоны")` (it's `<li>` NOT `<a>`)

### JS validation pattern (run before commit)

```bash
python3 -c "import re,sys; \
  content=open('index.html').read(); \
  scripts=re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL); \
  open('/tmp/main.js','w').write(max(scripts, key=len))"
node --check /tmp/main.js
```

If `node --check` fails, fix syntax before commit. Custom parsers miss things, `node --check` doesn't.

### Git discipline

- **NEVER** commit if local `node --check` fails on main script
- **NEVER** push if previous CI is still red and you haven't fixed the cause
- **NEVER** delete tests to make CI green — fix the code, or `.skip()` with a TODO
- GitHub Pages cache is deceptive — verify in incognito + Cmd+Shift+R

---

## Workflow per sprint

1. Read the current contract from Project knowledge: `contracts/<sprint-name>.md`
2. Read `IVANNA-NEXT-SPRINT.md` for concrete subtasks and order
3. Read existing code you'll touch (use grep/view, don't reason from memory)
4. Implement changes — small commits with clear messages
5. Before each commit:
   - Run JS validation (see above)
   - Run relevant tests locally if quick: `npx playwright test tests/01-auth.spec.js --ui`
6. Push to `main`
7. Wait for GitHub Actions CI (~3-5 min)
8. Read CI result:
   - `gh run list --limit 1 --workflow=test.yml`
   - `gh run view <run-id> --log-failed` if red
9. If red:
   - Classify: site bug | test bug | flake
   - Fix site bug locally → push
   - For test bug: only fix tests if scope says so, otherwise ping testing chat
10. If green AND all contract items satisfied:
    - Update `BACKLOG.md` (sprint → done, date)
    - Update `slswiss-architecture.md` if architecture changed
    - Ping Kseniia for final review

---

## What you can do autonomously

- Read repo files, search, grep
- Edit `soiludi_v4.html`, `soiludi_admin.html`, `tests/`, configs
- Commit + push to `main`
- Read GitHub Actions CI results
- Update `BACKLOG.md` when sprint closes

## What requires asking Kseniia first

- Anything not in the current contract (scope expansion)
- Product decisions (prices, what user sees, UX flow)
- Schema migrations beyond what contract specifies
- New dependencies in `package.json`
- Repo restructuring
- Force push, branch creation, tag creation

## What you must NEVER do

- Push to `main` if local syntax check fails
- Push if last CI was red and root cause unresolved
- Delete or `.skip()` tests just to make CI green
- Commit secrets (API keys, passwords) — check `.gitignore` is respected
- Reorganize repo or rename files without explicit instruction
- Hardcode credentials anywhere

---

## Tooling notes

- **Local Playwright UI**: `npx playwright test --ui`
- **CI status**: `gh run list --limit 5`
- **CI logs**: `gh run view <id> --log-failed`
- **Last commit on remote**: `git log origin/main -1 --oneline`
- **JS syntax check**: see pattern above

---

## When in doubt

- Technical: try small, fail fast, iterate
- Product: STOP, ask Kseniia
- Architecture: read `slswiss-architecture.md` first, then ask
- Stuck for >30 min: write down what's blocking and ask

Be conservative with scope, aggressive with correctness.
