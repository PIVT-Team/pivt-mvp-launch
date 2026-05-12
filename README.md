# Welcome to PIVT — A Friendly Tour for Newcomers

Hi! If you just opened this folder for the first time and have no idea what any of it is, don't worry. This document is the long-form, no-prior-knowledge-required tour. By the end you should know:

1. **What PIVT actually is** (the product)
2. **What's inside this folder** (the code)
3. **How the pieces fit together** (the architecture)
4. **How to run it on your laptop** (the practical part)
5. **Where to look when you want to change something** (the cheat sheet)

Grab a coffee — it's going to be a long, gentle read.

---

## 1. What is PIVT?

**PIVT is a SaaS platform for running complex financial transactions** — specifically mergers and acquisitions (M&A), private equity deals, and credit transactions. Think of the kind of deal where:

- A buyer wants to acquire a company for $185 million.
- There are 12 different people who'll be paid out (founders, VC funds, employees with stock options).
- 40-plus legal documents have to be signed.
- Lawyers, fund managers, and compliance officers all need to approve things in the right order.
- Wire transfers must go to the right bank accounts in the right amounts on the right day.
- If anything is off by a dollar or a digit, someone's career has a bad week.

Historically, deals like this run on spreadsheets, email threads, and a small army of associates double-checking each other. PIVT is the software that replaces the spreadsheets-and-prayers approach with a single dashboard where every party in the deal can see the same numbers, sign the same documents, and execute payments together.

The "MVP launch" in the folder name (`pivt-mvp-launch-abcef2ed-main`) means this is the **Minimum Viable Product** — the first real release. Not a prototype, not a toy, but the version meant to be put in front of paying customers.

### The product, in five sentences

PIVT lets a deal team **create a deal**, **invite the other parties** (counterparties, counsel, investors), **upload documents and stakeholder data**, **let the system reconcile and find discrepancies**, **route approvals**, and **execute the actual wire transfers** at closing. Every step is logged in a tamper-resistant audit chain. An AI assistant called **Newton** sits inside the app and answers questions about the deal in real time. Admins get a separate area to monitor users, revenue, risk, and support tickets.

### Who uses it?

The app talks to four different personas (you'll see this everywhere in the code):

- **PE Associate** — the deal owner, the person driving timing and pushing for close.
- **Buyer Counsel** — the buyer's lawyer, focused on approvals, governance, audit defensibility.
- **Seller Counsel** — the seller's lawyer, focused on payment accuracy and shareholder fairness.
- **Operating Partner** — the senior partner watching the whole portfolio.

Newton (the AI assistant) actually changes its tone and focus depending on who's logged in. You can see those instructions in [`supabase/functions/newton/index.ts`](supabase/functions/newton/index.ts).

---

## 2. The technology stack — what each piece is and why it's here

Before we walk the folders, let's name the tools. If any of these are new to you, the one-line explanations below are enough to follow the rest of this doc.

### Frontend (the part that runs in your browser)

- **React 18** — the JavaScript library that builds the user interface. It's the bread and butter of modern web apps. UI is described as components (small reusable pieces).
- **TypeScript** — JavaScript with types. Adds compile-time checks. The `.ts` and `.tsx` file extensions you'll see everywhere are TypeScript.
- **Vite** — the build tool. It's what turns the source code into something a browser can run, and what powers the fast `npm run dev` reload-on-save experience. Configured in [`vite.config.ts`](vite.config.ts).
- **Tailwind CSS** — a styling system where you write classes like `flex items-center gap-3 px-3 py-2` directly on elements instead of writing separate CSS files. Config in [`tailwind.config.ts`](tailwind.config.ts).
- **shadcn/ui + Radix UI** — a collection of pre-built, accessible UI components (buttons, dialogs, menus, tooltips). They live in [`src/components/ui/`](src/components/ui/). Lots of files there — all building blocks.
- **Framer Motion** — the animation library. The page transitions, fades, and slides.
- **React Router v6** — handles URLs like `/deals/123` and decides which page to show.
- **Zustand** — a tiny state-management library. It's like Redux but with 1% of the ceremony. All the `*Store.ts` files in [`src/stores/`](src/stores/) use it.
- **TanStack React Query** — manages data fetched from the server (caching, refetching, loading states).
- **Zod** — runtime form/data validation.
- **React Hook Form** — handles the form inputs and validation wiring.

### Backend (the part that runs on a server)

- **Supabase** — this is the entire backend. Supabase is a hosted service that bundles:
  - A **PostgreSQL database** (where all the deal data lives).
  - **Authentication** (sign-up, login, sessions).
  - **Row-Level Security (RLS)** policies — Postgres-native rules that say "user X can only read rows that belong to user X's deals." This is enforced in the database itself, not in the app, which is a much safer design.
  - **Edge Functions** — small TypeScript programs that run on Supabase's servers (in Deno, not Node) and act as your "API endpoints." Each folder in [`supabase/functions/`](supabase/functions/) is one of these.
  - **Storage** for files.

  The Supabase project ID and public URL are configured in [`.env`](.env), and the browser-side client is initialized in [`src/integrations/supabase/client.ts`](src/integrations/supabase/client.ts).

- **Deno** — the JavaScript runtime that Supabase Edge Functions use. Similar to Node.js but a different beast. You'll see `import { serve } from "https://deno.land/..."` at the top of every edge function — that's Deno-style importing.

### Tooling

- **bun** and **npm** — both are package managers (they install JavaScript libraries). This repo has both a [`bun.lock`](bun.lock) **and** a [`package-lock.json`](package-lock.json) — so either works. The team seems to lean on bun (it's also used inside the separate `remotion/` subproject).
- **ESLint** — the linter that catches mistakes and style issues. Config in [`eslint.config.js`](eslint.config.js).
- **Vitest** — the test runner. Config in [`vitest.config.ts`](vitest.config.ts). Tests live in `__tests__` folders inside `src/`.
- **Vercel** — the hosting platform for the frontend ([`vercel.json`](vercel.json) tells Vercel how to deploy it).
- **Lovable** — the project was originally generated using [lovable.dev](https://lovable.dev), an AI-powered web app builder. You'll see `lovable-tagger` in the dev dependencies — it's the Lovable plugin that lets their editor map source code back to UI elements. You can ignore it for day-to-day work; it only activates in development mode.

### One side project: Remotion

There's a subfolder called [`remotion/`](remotion/) that's a **completely separate project**. It uses **[Remotion](https://www.remotion.dev/)**, a framework for making programmatic videos in React. Inside it you'll find scenes (`SceneAudit.tsx`, `SceneIngestion.tsx`, etc.) — these are used to generate marketing/demo videos of the product. It's its own `package.json`, its own dependencies, its own world. It uses **Bun** instead of npm (the [`remotion/CLAUDE.md`](remotion/CLAUDE.md) file inside it gives instructions for that). You probably don't need to touch this unless you're making promo videos.

---

## 3. Walking through the folder

From the project root, here's what each top-level item is and whether you'll touch it.

```
.
├── .env                    ← Environment variables (Supabase keys). Don't commit secrets to git.
├── .gitignore              ← Files git should ignore.
├── README.md               ← Original Lovable template README (mostly placeholder).
├── ONBOARDING.md           ← This file!
├── bun.lock / bun.lockb    ← Bun's lockfile (pinned dependency versions).
├── package.json            ← The list of dependencies and scripts. The starting point.
├── package-lock.json       ← npm's equivalent of bun.lock.
├── components.json         ← shadcn/ui's config (tells it where to put new components).
├── eslint.config.js        ← Linter rules.
├── index.html              ← The single HTML page the whole app lives in (it's a Single Page App).
├── postcss.config.js       ← Boilerplate for Tailwind's CSS processing.
├── tailwind.config.ts      ← Tailwind theme + colors + custom utilities.
├── tsconfig*.json          ← TypeScript compiler settings.
├── vercel.json             ← Vercel deployment config.
├── vite.config.ts          ← Vite build config.
├── vitest.config.ts        ← Test runner config.
├── public/                 ← Static files (logo, favicon, robots.txt) served as-is.
├── remotion/               ← The video-generation side project (separate stack).
├── src/                    ← All the frontend source code lives here. THIS IS WHERE YOU WORK.
└── supabase/               ← Database migrations + edge functions (the backend).
```

### Inside `src/` — the frontend

```
src/
├── main.tsx                ← The entry point. Mounts <App /> into the page. 5 lines.
├── App.tsx                 ← The router. Decides which page renders for each URL.
├── index.css               ← Global styles + Tailwind directives.
├── App.css                 ← Smaller global styles.
├── vite-env.d.ts           ← TypeScript stub Vite needs.
│
├── assets/                 ← Images bundled into the JS (logos, illustrations).
├── components/             ← All the React components (UI building blocks).
├── config/                 ← App-wide configuration constants.
├── contexts/               ← React Context providers (auth, view mode, deal workspace).
├── hooks/                  ← Custom React hooks (useAuth, useDealOperations, etc.).
├── integrations/supabase/  ← The Supabase client + generated TypeScript types.
├── lib/                    ← Utility functions (animations, navigation, PDF generation).
├── pages/                  ← Top-level pages (one file = one screen).
├── services/               ← Logic that talks to Supabase (tracking, deal state machine).
├── stores/                 ← Zustand stores (client-side state).
└── test/                   ← Test setup files.
```

Let's open the most important ones.

#### `src/main.tsx` — the entry point

Five lines. It finds the `<div id="root">` in [`index.html`](index.html), and tells React: "draw `<App />` here." That's it.

#### `src/App.tsx` — the router

This is where all the URLs in the app are listed. Open it and you'll see a big block of `<Route path="..." element={...} />` lines. Reading this top-to-bottom tells you every page that exists. A few highlights:

- `/` → `PIVTCompletePage` (the main app — what most users see).
- `/login`, `/verify` → auth pages.
- `/admin/*` → the admin area (12 sub-pages), wrapped in `<AuthGuard>` so only logged-in users get in.
- `/deals/:id` → an individual deal's detail view.
- `/dashboard` → the simpler dashboard layout (under `<AppLayout>` — a more traditional sidebar+main layout).

There are actually **two different shells** in the app:

1. **`PIVTCompleteUnified`** (the main thing) — a fancy 3-panel SaaS layout with command palette, AI rail, and the "cover/glass" view-mode toggle. This is what `/` shows.
2. **`AppLayout`** — a simpler classic sidebar+content layout used for `/dashboard` and `/deals/:id`.

Why two? Because PIVT is iterating. The "unified" shell is the future; the simpler layout exists for legacy pages still being migrated. Don't be confused if you see both — they coexist.

#### `src/pages/` — every screen the user can see

The big ones:

- **`PIVTCompletePage.tsx`** — the main multi-section app shell. Almost everything happens inside this.
- **`LoginPage.tsx`**, **`VerifyPage.tsx`** — auth flow.
- **`DealDetail.tsx`**, **`DealCommandCenter.tsx`** — deal-specific screens.
- **`Dashboard.tsx`** — legacy dashboard.
- **Policy pages** — `PrivacyPolicyPage`, `TermsOfServicePage`, `CookiePolicyPage`, `DataSecurityPage`, `AcceptableUsePage`. Legal boilerplate every B2B SaaS needs.
- **`admin/`** — twelve admin-only pages (analytics, audit log, user directory, revenue, risk, etc.).
- **`CounterpartyJoinPage.tsx`** — the page someone lands on when they're invited to join a deal as a counterparty.
- **`DemoPage.tsx`** — a public demo route.

#### `src/components/` — the building blocks

A few hundred components live here. To make sense of the chaos, look at the subfolders:

- **`ui/`** — generic shadcn/ui primitives (button, dialog, tooltip, table). These are "dumb" reusable widgets. Don't put product logic here.
- **`pivt-complete/`** — the bulk of the actual product. This is where the magic happens. Inside it:
  - **`PIVTCompleteUnified.tsx`** — the master layout component. Sidebar + main + Newton AI rail.
  - **`CommandPalette.tsx`** — the ⌘K quick-jump menu.
  - **`NotificationsDrawer.tsx`** — the bell-icon drawer.
  - **`ImportDataModal.tsx`**, **`InviteTeamMemberModal.tsx`**, **`SendReminderModal.tsx`** — pop-up modals.
  - **`cover/`** — a folder packed with ~70 `*Cover.tsx` files. Each "cover" is one section of the app (DealsCover, IntelligenceMapCover, AuditConsoleCover, WaterfallCover, etc.). When you click "Deals" in the sidebar, it renders `DealsCover`. When you click "Audit Log", it renders `AuditCover`. The cover-section mapping lives at the top of `PIVTCompleteUnified.tsx`.
  - **`glass/`** — alternative "glass" view-mode renderings.
- **`deal/`** — components specific to the legacy deal-detail page (overview, escrow tab, waterfall tab, approvals tab, etc.).
- **`deal-wizard/`** — the multi-step wizard for creating a new deal.
- **`newton/`** — the AI assistant's UI (chat, intelligence panels).
- **`admin/`** — small admin-specific cards.
- **`counterparty/`**, **`wirepack/`**, **`demo/`**, **`support/`** — other feature areas.

#### `src/stores/` — Zustand state

Each file is one store of client-side state (data that lives in the browser, not the server).

- **`pivtStore.ts`** — the big one. Holds the currently active section, selected deal, view mode, plus a bunch of demo data (`Project ATLAS`, `Project BEACON`, `Project CIPHER`) used to make screenshots look real even before any real data is loaded.
- **`dealWizardStore.ts`** — state for the new-deal wizard.
- **`auditStore.ts`**, **`kycStore.ts`**, **`notificationStore.ts`**, **`reminderStore.ts`**, **`reportStore.ts`**, **`teamStore.ts`**, **`timelineStore.ts`**, **`waterfallStore.ts`** — one store per feature.

The pattern is the same in every file: `create<StoreType>((set, get) => ({ ... }))`. The exported hooks (`usePIVTStore`, `useNotificationStore`, etc.) are what components call.

#### `src/contexts/` — React Context providers

These wrap the whole app and let any child component grab shared state without prop-drilling.

- **`AuthContext.tsx`** — wraps the whole app. Tracks the logged-in user, fetches admin roles from Supabase, and exposes `useAuth()`. **This is the gatekeeper of who-can-do-what.** Roles supported: `admin`, `super_admin`, `ops_admin`, `support_admin`, `read_only`, `intelligence`, plus a "platform admin" flag that adds an allowlist check.
- **`ViewModeContext.tsx`** — toggles between "cover" and "glass" rendering modes (a design system experiment).
- **`DealWorkspaceContext.tsx`** — provides the currently-open deal to anything inside the workspace.
- **`NewtonContext.tsx`** — state for the Newton AI assistant.
- **`DemoAuthContext.tsx`** — fake auth for the public demo route.

#### `src/hooks/` — custom React hooks

Reusable logic packaged as hooks. `useAdminMetrics`, `useDealMetrics`, `useDealOperations`, `useDealWorkflow`, `useEditGuard`, `useAuthAnalytics`, `useUserAnalytics`. These are where most of the "fetch data from Supabase and return it nicely" logic lives.

#### `src/services/` — backend-facing helpers

Pure-logic modules (not hooks, not components) that wrap Supabase calls:

- **`dealStateMachineService.ts`** — the canonical deal lifecycle. Eight states: `draft → verification_pending → structuring → conditions_pending → ready_for_execution → executing → settled → archived`. Each transition has "gates" (conditions that must pass).
- **`newtonActionService.ts`** — maps detected user intents (e.g. "create a deal", "generate wire pack", "list blockers") to backend actions.
- **`activityTrackingService.ts`**, **`authTrackingService.ts`**, **`adminAuditService.ts`** — append-only loggers for telemetry and the audit trail.
- **`dealMetricsService.ts`** — computes deal-level KPIs.

#### `src/lib/` — utilities

- **`navigation.ts`** — defines the sidebar groups (M&A, Credit, Treasury, Admin "modes") and the deal-workspace tabs.
- **`animations.ts`** — shared Framer Motion spring configs.
- **`reportGenerator.ts`** — builds PDFs using jsPDF.
- **`cookieConsent.ts`** — the cookie banner logic.
- **`utils.ts`** — `cn()` helper for joining Tailwind class names.
- **`fieldCorrections.ts`** — small data-cleanup helpers.

#### `src/integrations/supabase/`

- **`client.ts`** — creates the Supabase client used by every component.
- **`types.ts`** — auto-generated TypeScript types matching the database schema. **Do not edit this by hand**; it's regenerated by Supabase tooling.

### Inside `supabase/` — the backend

```
supabase/
├── config.toml             ← Supabase project config.
├── migrations/             ← ~80 SQL files. Database schema history.
└── functions/              ← ~40 edge functions. Each subfolder is one HTTP endpoint.
```

#### `supabase/migrations/`

Every change to the database — new table, new column, new index, new RLS policy — gets one numbered SQL file here. Run in order, they reconstruct the entire schema. The oldest one ([20260212225444_…sql](supabase/migrations/20260212225444_2476615e-0d4e-442e-9f94-7b2dc01d3b4e.sql)) creates the base tables (`deals`, `profiles`, `user_roles`, `deal_participants`, etc.); the newer ones add features like the deal state machine event log, the audit chain, email infrastructure, role escalation, and more.

**Never edit an old migration.** Always write a new one for any change.

#### `supabase/functions/` — the API

Each subfolder = one HTTP endpoint, deployed independently. The interesting ones:

- **`newton/`** — the AI assistant. Reads deal context and answers questions. The system prompt inside [`index.ts`](supabase/functions/newton/index.ts) is worth reading on its own — it tells you exactly what Newton is allowed and not allowed to do (no fabricating bank details, no overriding execution authority, role-aware behavior, etc.).
- **`newton-action/`**, **`newton-execute/`**, **`newton-intake/`** — Newton's "do something" siblings (intent → real action).
- **`document-ai/`** — extracts data from uploaded PDFs.
- **`discrepancy-engine/`** — finds mismatches between cap-table data, waterfall, and SPA.
- **`obligation-extractor/`** — pulls payment obligations out of contracts.
- **`disbursement-engine/`**, **`funds-flow-agent/`** — payment execution logic.
- **`generate-wire-pack/`** — assembles the final "send this to the bank" bundle.
- **`docusign-*/`** — DocuSign integration (oauth, envelope creation, webhook).
- **`esignature-webhook/`** — handles signature events.
- **`elevenlabs-tts/`**, **`elevenlabs-music/`** — text-to-speech and music (used for demos/videos).
- **`auth-email-hook/`** — custom email templating on auth events.
- **`send-verification/`**, **`verify-token/`** — email verification flow.
- **`export-audit-chain/`**, **`verify-audit-chain/`** — produces and verifies the tamper-evident audit log.
- **`admin-insights/`**, **`intelligence-dashboard/`** — analytics backends.
- **`seed-demo-user/`**, **`qa-seed-deals/`**, **`demo-reset/`** — testing/demo helpers.
- **`_shared/`** — utility code (audit-chain helpers, deal-graph builder, JWT requirement check, email templates) imported by multiple functions.

#### How the frontend talks to the backend

Two ways:

1. **Direct Supabase client calls** for normal CRUD: `supabase.from('deals').select('*')`. Row-level-security policies in the database enforce who can read what. You'll see this in components and hooks.
2. **Edge function calls** for anything that needs server-side logic or secrets: `fetch(\`${VITE_SUPABASE_URL}/functions/v1/newton\`, ...)`. Example: [`newtonActionService.ts`](src/services/newtonActionService.ts).

---

## 4. Running it on your laptop

You'll need **Node.js 18+** (any recent version) and either **npm** or **bun** installed. Open a terminal in this folder.

### Step 1 — install dependencies

```sh
npm install
# or, if you prefer bun:
bun install
```

This downloads everything listed in [`package.json`](package.json) into a `node_modules/` folder (which is gitignored — never commit it).

### Step 2 — confirm `.env` is in place

The repo already includes a [`.env`](.env) file with the public Supabase URL and **anon key** (a public key — fine to commit because it only gives you access that RLS allows). If you ever need to point at a different Supabase project, edit those values.

### Step 3 — start the dev server

```sh
npm run dev
```

Open the URL it prints (usually [http://localhost:8080](http://localhost:8080)). You should see the PIVT app. Saves trigger hot-reload — the page updates in milliseconds as you edit files.

### The other useful scripts

From [`package.json`](package.json):

- `npm run dev` — start the dev server.
- `npm run build` — build a production bundle into `dist/`.
- `npm run build:dev` — production-format build but with development-mode flags (Lovable-tagger active).
- `npm run preview` — serve the built bundle locally to test the production build.
- `npm run lint` — run ESLint.
- `npm run test` — run the Vitest suite once.
- `npm run test:watch` — re-run tests as you save.

---

## 5. Cheat sheet — "I want to change X, where do I look?"

| If you want to… | Open this |
|---|---|
| Add a new page / URL | [`src/App.tsx`](src/App.tsx) — add a `<Route>` |
| Add a new sidebar section | [`src/lib/navigation.ts`](src/lib/navigation.ts) and add a cover component in [`src/components/pivt-complete/cover/`](src/components/pivt-complete/cover/) |
| Change the color palette / theme | [`tailwind.config.ts`](tailwind.config.ts) + [`src/index.css`](src/index.css) |
| Add a database table or column | Write a new SQL file in [`supabase/migrations/`](supabase/migrations/) |
| Add a new backend endpoint | Create a folder in [`supabase/functions/`](supabase/functions/) with an `index.ts` |
| Change who can see what (auth) | [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) for the client checks + RLS policies in migrations for the real enforcement |
| Tweak the AI assistant's behavior | The system prompt at the top of [`supabase/functions/newton/index.ts`](supabase/functions/newton/index.ts) |
| Adjust the deal state machine | [`src/services/dealStateMachineService.ts`](src/services/dealStateMachineService.ts) |
| Change demo seed data (Project ATLAS, etc.) | [`src/stores/pivtStore.ts`](src/stores/pivtStore.ts) |
| Change a generic UI primitive (button, dialog) | [`src/components/ui/`](src/components/ui/) |
| Generate a PDF differently | [`src/lib/reportGenerator.ts`](src/lib/reportGenerator.ts) |
| Add a unit test | Create a `*.test.ts(x)` file alongside the code, or in `__tests__/` |
| Update the homepage dashboard | [`src/components/pivt-complete/cover/HomeCover.tsx`](src/components/pivt-complete/cover/HomeCover.tsx) |
| Touch the admin panel | [`src/pages/admin/`](src/pages/admin/) |

---

## 6. Things that will surprise you (the gotchas)

A few non-obvious things worth knowing up front so you don't waste an afternoon:

1. **There are two layouts.** `PIVTCompleteUnified` is the new, fancy 3-panel shell at `/`. `AppLayout` is the older, simpler shell at `/dashboard` and `/deals/:id`. Don't assume the codebase is consistent — it's mid-migration.

2. **Demo data lives alongside real data.** `pivtStore.ts` has hard-coded `DEMO_DEALS`, `DEMO_STAKEHOLDERS`, etc. used for screenshots and the public demo. Real data comes from Supabase. Some screens read from one, some from the other, some from both. Always check whether you're looking at `useDealOperations()` (real) or `usePIVTStore()` (demo).

3. **Lazy loading is everywhere.** Most pages in `App.tsx` are wrapped in `React.lazy(() => import(...))`. That means they only download when needed. If a page seems to not exist, search for it as a `lazy` import.

4. **Edge functions run on Deno, not Node.** That's why you see `https://deno.land/...` imports in the `supabase/functions/` files. You can't use Node packages there.

5. **The `.env` file is committed.** Normally you'd never commit secrets, but Supabase **anon keys** are designed to be public — security is enforced by Row-Level Security in the database. If you ever add a real secret (a service role key, a third-party API key), it goes in `.env.local` or in Supabase's dashboard, **not** in `.env`.

6. **The `remotion/` folder is a different project.** Different dependencies, different runtime (bun), different purpose (videos). Treat it as a sibling, not a part.

7. **Newton has guardrails.** Look at its system prompt before assuming what it can do. It explicitly refuses to fabricate bank details, override execution authority, or invent data. That's by design.

8. **The audit chain is cryptographically linked.** The export-audit-chain and verify-audit-chain functions produce a tamper-evident log of every action. Don't shortcut around it.

---

## 7. Where to go from here

A good first day:

1. Run `npm install && npm run dev` and click through every sidebar item.
2. Open `src/App.tsx` and trace one URL all the way through — say, `/` → `PIVTCompletePage` → `PIVTCompleteUnified` → `DealsCover`.
3. Open `supabase/functions/newton/index.ts` and read the system prompt. It's the clearest single document explaining what the product is trying to be.
4. Skim the most recent five files in `supabase/migrations/` to see what the team has been building lately.
5. Pick one cover screen, change a heading, save, and watch it hot-reload.

Welcome aboard. The codebase is big but it's tidy — every folder is named for what's in it, and the patterns repeat. Once you've read one Cover component, you've basically read all seventy.

Have fun.
