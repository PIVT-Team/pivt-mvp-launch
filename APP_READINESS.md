# What the application must do for the website brief to be true

The co-founder's brief (2026-09-16, Parachute reference) is a description of
the product as it will be shown. This maps each thing the page will claim or
screenshot to what the application does **today, on production**, and what has
to change. "Today" was checked against production endpoints, not the repo.

Legend: **Deploy** = code exists, not on production · **Build** = code missing ·
**Decide** = a business call · **You** = needs your action, I cannot do it.

---

## 0. The precondition everything else waits on

**Nothing backend from the last month is on production.** Nine edge functions
return 404; the other 44 exist but cannot be assumed current. Lovable's GitHub
sync ships the frontend only. Until this is fixed, no stage below can be
demonstrated end to end and no screenshot of the Coordinate stage can be taken.

| | |
|---|---|
| State | `.github/workflows/supabase.yml` is merged and runs on every push to main. It exits green with a warning until `SUPABASE_ACCESS_TOKEN` exists. |
| **You** | Either paste `scripts/lovable-deploy-functions.txt` into Lovable (deploys everything once), **or** get a Supabase access token from an account with project access — Joanna, most likely — and add it as the repository secret `SUPABASE_ACCESS_TOKEN`. The token is the permanent fix; the paste is today. |

---

## 1. Hero — "a short looping clip of Newton working through a deal"

For a clip to be honest, one deal has to go from upload to a green readiness
view with Newton answering along the way, with no engineering intervention.
That is Test 4 from the original brief, and it has never been run.

| What must be true | Today | Work |
|---|---|---|
| Upload a real SPA / funds flow / cap table and get real text out | Extraction rewritten (PDF, scan, Excel, Word) — **not deployed** | Deploy |
| Discrepancies appear from the real text | Version-aware engine, 31 rules — engine deployed, **rules seeded, obligation-extractor invocation not deployed** | Deploy |
| Newton answers about that deal from the database | `newton` → `get-deal-context` wiring — **not deployed** | Deploy |
| A seed deal exists that exhibits all of it | `scripts/seed-test-deal.sql` seeds a deal + 3 documents, no discrepancies, no requirements | **Build**: a seed that produces every blocker type, so the clip has something to resolve |
| Signed-out visitors don't see a fake dashboard | `/` renders "Welcome back" with zeroed stats to anyone — **live bug** | Build (small) |

## 2. Stage: Ingest

| What must be true | Today | Work |
|---|---|---|
| PDF, scanned PDF, Excel, Word read natively | Done, tested (76 tests) — **not deployed** | Deploy |
| Obligations, signature blocks, consents extracted | `obligation-extractor` live; `extract-signature-matrix` / `extract-consents` **404** | Deploy |
| Re-uploads versioned and diffed | Versioning trigger live (migration applied); orchestrator diff **not deployed** | Deploy |

Screenshot-able after deploy. Nothing to build.

## 3. Stage: Reconcile

| What must be true | Today | Work |
|---|---|---|
| 31 checks, 19 blocking | Seeded and live | — |
| Purchase price / escrow / sources = uses across documents | Rules live; **but the engine on production predates the `pickCurrent` version-awareness and the `low_extraction_confidence` rule** | Deploy |
| Wire change re-opens verification and invalidates approvals | Trigger live; `invalidateStaleApprovals` in the orchestrator **not deployed** | Deploy |
| Amounts compare correctly | `toCents` NaN fix **not deployed** — on production, every string amount reads as "changed" | Deploy |

## 4. Stage: Coordinate — the one with a gap after deploy

| What must be true | Today | Work |
|---|---|---|
| Signature matrix and consents proposed for review | `RequirementsCover` calls both extractors — **404** | Deploy |
| A human reviews, then a request is drafted and sent | **Built 2026-09-16.** Approved requirements get a *Request* action; the engine drafts from the source clause; the person reads and edits the text, then *Approve & send* sets the gate and sends. The UI says *prepared, not emailed* when the environment has delivery off, and shows the one-time link. | Deploy (both functions 404 today) |
| Counterparty receives a link, uploads, gets verified | `requirement-portal` and `verify-requirement-document` — **404**; portal page is live in the frontend | Deploy |
| Reminders on a cadence, escalation on silence | Cron live (migration applied) — but it reads `requirement_requests`, which nothing creates | Unblocked by the build above |

Screenshot-able once the two functions are deployed.

## 5. Stage: Close

| What must be true | Today | Work |
|---|---|---|
| One readiness view: "can this transaction close?" with clickable blockers | Live (`dealMetricsService.blockingIssues`) | — |
| Newton's "what's blocking close?" agrees with that view | **Built 2026-09-16.** One pure `computeClosingReadiness()` in `_shared/closing-readiness.ts`; the screen and `get-deal-context` both call it with the same rows. The pack now carries `closing_readiness` (can_close, numbered blockers with source and next action). | Deploy |
| Dual-counsel approvals, invalidated on upstream change | Live / orchestrator part not deployed | Deploy |
| Bank-ready wire pack, only when green | `generate-wire-pack` live | — |
| Waterfall allocations | Engine rewritten in integer cents — **not deployed**; **`WaterfallCover` never calls it** and keeps its state in a store with no persistence (T14) | Deploy + **Build** |
| "Execute" | `MockProvider`. No rails. | **Decide** — the site must say *wire pack*, not *execution* |

## 6. Feature modules

| Module | Screenshot-able today? | Blocking item |
|---|---|---|
| Closing Readiness | Yes | — |
| Funds Flow & Disbursement | Partly — funds-flow diff not deployed; waterfall screen not wired; execution is simulated | §5 |
| Stakeholder Verification | Yes — `counterparty-identity` (live, 7 call sites) and `manual-verify` are the real paths. The `persona-*` functions are unreferenced dead code; deploying them changes nothing. | — |
| Newton AI | Partly — see §7 | §7 |

## 7. Newton section — "a real prompt and a real structured response"

| What must be true | Today | Work |
|---|---|---|
| "What's blocking close?" returns a structured list with three items and their sources | **Built 2026-09-16.** Newton answers blocker questions only from `closing_readiness`, in a fixed numbered shape — title, reason, *source*, next action — verbatim, no reordering or estimation. | Deploy |
| Answer comes from the database, not the open screen | `get-deal-context` preference — **not deployed** | Deploy |

## 8. Stats strip

| Candidate | Can we say it? |
|---|---|
| 31 checks, 19 blocking | Yes, today |
| "Discrepancy detection rate" | **No data.** Would need every extraction and every discrepancy decision logged and a labelled sample. The `threshold_decision` log line exists (not deployed) and is the first step. |
| "Average days saved per closing" | **No customers. Cannot be said.** |
| FBI IC3 figures | Third-party; verify against the report — not a product task |

## 9. Security section

| Claim | True? |
|---|---|
| Built on Supabase | Yes |
| Encrypted in transit and at rest | Yes (Supabase default) |
| Row-level security on every deal table | Yes |
| Audit log of approvals, uploads, changes | Yes |
| SOC 2 in progress | **Decide** — nothing in the product or repo references it. Say it only if an audit is engaged. |

---

## Order of work

1. **You — deploy the backend** (§0). Everything marked *Deploy* clears at once. I have no way to do this.
2. Signed-out home screen (§1) — small, doing now.
3. Requirements draft → review → send actions (§4) — the missing link in Coordinate.
4. One shared blocker definition feeding both the readiness view and Newton (§5, §7).
5. Newton's fixed answer shape for blocker questions (§7).
6. `WaterfallCover` → the engine (§5).
7. A seed deal exhibiting every blocker type (§1), so Test 4 can finally be run and the clip has a story.
8. Then Test 4 itself, end to end, on production.

Items 2–7 I can do without you. Item 1 gates whether any of it is visible.
