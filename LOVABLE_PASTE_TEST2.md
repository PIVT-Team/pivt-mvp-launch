# Lovable paste guide — Test 2 edge functions

Everything else from Test 2 is already live or already merged. This is the last
piece: two Supabase edge functions that don't reach production through git,
because the repo has no CI and `vercel.json` only deploys the frontend.

**Already done — do not repeat:**
- ✅ Both migrations run against `hipjywloeveadfndzary` (versioning, triggers, rule seed)
- ✅ Code committed and pushed to `dev` (`4a0856a`, `9f0a8e2`)

**Still to do:** paste 4 files below, then merge `dev` → `main` for the frontend.

---

## Paste order matters

`deal-workflow-orchestrator` imports the two `_shared` files. If you paste the
orchestrator first it will fail to boot on a missing module. `discrepancy-engine`
has no new dependencies and can go at any point.

| # | File | New? | Lines | Why |
|---|---|---|---|---|
| 1 | `supabase/functions/_shared/entity-match.ts` | **new file** | 105 | Payee normalisation. Nothing imports it yet at this point — safe to add alone. |
| 2 | `supabase/functions/_shared/funds-flow-diff.ts` | **new file** | 177 | Version diff. Imports #1, so it must come second. |
| 3 | `supabase/functions/deal-workflow-orchestrator/index.ts` | replace | 725 | Imports #1 and #2. Must come after both. |
| 4 | `supabase/functions/discrepancy-engine/index.ts` | replace | 963 | Standalone — only needs `require-jwt.ts`, which is already deployed. |

Steps 1 and 2 are inert on their own: no deployed function imports them until
step 3. So if you have to stop partway, stop after 1, 2, or 4 — never between
3 and its dependencies.

---

## What each file changes

**1. `_shared/entity-match.ts`** — new. Normalises payee names so
`Apex Advisory, LLC` and `Apex Advisory LLC` resolve to one party. Deliberately
strips only legal-form suffixes (`LLC`, `Inc`, `Ltd`) and *not* words like
`Holdings` or `Capital` — stripping those would merge `Meridian Holdings LLC`
with `Meridian Capital LLC` and send money to the wrong account.

**2. `_shared/funds-flow-diff.ts`** — new. Pure, side-effect-free diff between
the payment set on file and the one in a newly uploaded funds flow. Returns
added / removed / amount-changed / bank-changed / duplicates.

**3. `deal-workflow-orchestrator/index.ts`** — the important one.
- Replaces the delete-then-insert step that duplicated the entire payment set on
  every funds-flow re-upload
- Writes `deal_change_events` rows describing each change in human terms
- Invalidates approvals bound to the superseded version
- Leaves manually entered wires strictly alone (a funds-flow import must never
  delete something a person typed)
- Throws on a failed wire insert instead of logging and reporting success

**4. `discrepancy-engine/index.ts`**
- Version-aware reads: evaluates the document in force, not whichever row came
  back first
- Findings carry source, why-it-matters, and a recommended action
- New `low_extraction_confidence` rule; SPA escrow now cross-checked
- Cap-table validation reconciles to the equity consideration, not the headline
  deal value
- Three duplicate rule aliases removed

---

## After pasting

Upload a funds flow to any test deal and confirm:

1. `contract_documents` shows `version` incrementing with one `is_current = true`
2. `deal_change_events` gets rows for whatever changed
3. Changing a wire's bank details flips `verification_status` to `pending`
   *(this one already works — it's a DB trigger, live since the migration)*

If the orchestrator 500s, the response body carries the real error message —
that's the new fail-loud behaviour, not a regression.

---

## Then merge for the frontend

```bash
git branch -f main trial-merge && git push origin main
```

Verified before proposing: no merge conflicts, 34/34 tests pass on the merged
result, `vite build` succeeds. The merged `types.ts` keeps both the `re_*`/`tx_*`
schema from `main` and the new tables from `dev`.

Until this merge lands, `main`'s frontend still has the old readiness logic —
the one that reported "Ready" over twelve open blockers.
