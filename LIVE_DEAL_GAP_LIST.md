# Live Deal Gap List — Test 1

**Test deal:** Project MERIDIAN — $120M stock purchase, deliberately seeded with ten realistic problems.
**Method:** the fixture was run through PIVT's *actual* rule code, not a description of it —
`supabase/functions/discrepancy-engine` (36 evaluators), `supabase/functions/funds-flow-agent`
(8 validators), and `src/services/dealMetricsService` (the closing-readiness gates).
Harness + raw output: `scratchpad/stress/` (`stress.test.ts`, `gate.test.ts`).

---

---

## Status — updated after the Test 2 fix pass

Re-running the same fixture through the fixed code: **10/10 seeded problems detected**, and
Scenario B (clear the two verification gaps, change nothing else) now reports
`readyToClose: false` with 20 blocking items instead of "Ready".

| Gap | Status |
|---|---|
| G1 readiness ignores blockers | ✅ closed — `getDealMetrics` reads `discrepancies` + `deal_change_events` |
| G2 re-upload duplicates payments | ✅ closed — diff-based reconciliation replaces blind insert |
| G3 no document versioning | ✅ closed — `version` / `is_current` / `supersedes_id` + trigger |
| G4 approvals never go stale | ✅ closed — bound to version, invalidated on material change |
| G5 changed wires stay "verified" | ✅ closed — DB trigger resets verification + writes history |
| G6 rule set not installed | ✅ closed — seeded in migration |
| G7 exact-string duplicate matching | ✅ closed — `normalizePayee` in `_shared/entity-match.ts` |
| G8 failures swallowed | ✅ closed — wire insert failure now throws instead of reporting success |
| G12 duplicate rule keys | ✅ closed — aliases removed from the map, disabled in the table |
| G16 confidence never gated | ✅ closed — `low_extraction_confidence` rule |
| G17 SPA escrow not cross-checked | ✅ closed |
| G18 cap-table validation false-positives | ✅ closed — reconciles to equity consideration, net of debt/fees/escrow |
| G9 disbursement mock / floats / idempotency | ⏸ deliberately out of scope |
| G10 blockers render as warnings | ⏳ open — Test 3 |
| G13 no single readiness view | ⏳ open — Test 3 (service layer ready, UI pending) |
| G11, G14, G15, G19–G24 | ⏳ open |

---

## Scoreboard

| # | Seeded problem | Result |
|---|---|---|
| P1 | Conflicting purchase prices (SPA 118.5M / deal 120M / funds flow v12 120.75M) | ⚠️ **Partial — and backwards** |
| P2 | Multiple document versions (funds flow v10/v11/v12, SPA + Amendment No.1) | ❌ Missed |
| P3 | Changed wire instructions (seller bank swapped in v12, row still `verified`) | ❌ Missed |
| P4 | Missing KYC (Nordic Ventures unverified, no W-8BEN-E) | ✅ Caught |
| P5 | Duplicate payments (exact dup + `Apex Advisory, LLC` near-dup) | ⚠️ **Partial — 1 of 2** |
| P6 | Removed recipient (J. Okafor dropped from funds flow v12) | ✅ Caught (by luck — see G16) |
| P7 | Stale approvals (granted 2026-07-28, v12 landed 2026-08-05) | ❌ Missed |
| P8 | Missing closing documents (officer cert / board consent / escrow agmt) | ✅ Caught |
| P9 | Wrong extracted values (SPA escrow 6M vs 9M; 42% classify confidence) | ❌ Missed |
| P10 | Incomplete stakeholder info (no bank name / holder / email) | ✅ Caught |

**4 clean catches, 2 partial, 4 misses.** But the headline finding is not the miss rate — it is
that none of the catches change the answer to "can this close?"

---

## The headline finding

Scenario A produced **22 discrepancies** (12 blockers) and **7 funds-flow findings**
(4 critical/high). Closing Readiness reported `readyToClose: false` — but only because two
stakeholders were unverified. So Scenario B did *exactly what PIVT told the user to do* and
nothing else: mark the stakeholders and wires verified.

```
open blocker discrepancies : 12
open critical/high findings : 4   (incl. $2M wire overpayment, duplicate $1.25M wire,
                                   missing $2.4M recipient)

>>> gates.readyToClose = true
>>> UI badge would read: "Ready"
```

PIVT would tell an operator this $120M deal is **ready to close** while holding an open,
computed, persisted list of twelve blockers. `getDealMetrics()` never queries the
`discrepancies` table or `agent_runs` — the detection engines and the readiness gate are two
disconnected systems.

---

## P0 — blocks live use

### G1. Closing readiness ignores every blocker it computes
`src/services/dealMetricsService.ts:115-134` issues 14 queries. `discrepancies` and `agent_runs`
are not among them. `readyToClose` (line 221) is seven boolean gates about presence and
verification status — no discrepancy, no funds-flow finding, and no severity ever reaches it.
**Evidence:** Scenario B above.

### G2. Re-uploading a funds flow duplicates the entire payment set
`deal-workflow-orchestrator/index.ts:56-68` "supersedes" prior extraction by deleting rows where
`source_document_id = <this document's id>`. Funds flow v12 is a *new* `contract_documents` row
with a *new* id, so it matches nothing — v11's wires are left in place and v12's are inserted
alongside them (`processFundsFlow`, line 203, a blind `.insert()` with no diff and no dedupe).
Every funds-flow re-upload silently doubles the deal's payments. This is the production
mechanism behind "duplicate payments."

### G3. There is no document versioning anywhere in the schema
No `version`, `supersedes`, or `is_current` column on `contract_documents`, `deal_documents`, or
`ontology_documents`. `getExtractedField()` (`discrepancy-engine/index.ts:35`) resolves values via
`docs.find(...)` — **the first row wins**. Consequences observed in the run:

- The engine read funds flow **v10's** `total_uses` of $120,000,000 and reported it as current
  (`intent_funds_flow_mismatch` message), so the real v12 conflict of $120,750,000 vs a $120M deal
  was never raised.
- v12's `line_items` were never read at all, so the line-item-sum check (`evalFundsFlowArithmetic`,
  line 209) silently no-op'd.
- It raised a **false blocker** off the superseded SPA — "SPA states $118,500,000" — when
  Amendment No.1 restates the price at $120,000,000 and is the operative document.

Version-blindness produces false positives and false negatives from the same root cause. Every
other item in tests 2–4 depends on fixing this first.

### G4. Approvals can never go stale
`deal_approvals` (buyer/seller) and `ontology_approvals` carry no reference to *what* was
approved — no document id, no version, no content hash, no amount snapshot. There is no
invalidation path anywhere in the codebase. In the run, all three approvals predate funds flow
v12 by eight days and `approvalsComplete` still reported `true`.

### G5. Changed wire instructions are invisible and verification never resets
`wire_instructions` has no history table and no trigger. Nothing recomputes `verification_status`
when `routing_number` / `account_number_last4` / `bank_name` change. The seller row in the
fixture carries new bank details from v12 while still reading `verification_status: 'verified'`
with its 2026-07-20 `verified_at`. This is precisely the business-email-compromise vector the
product exists to prevent, and PIVT currently reports it as verified.

### G6. The discrepancy rule set is not installed by default
`discrepancy_rules` is seeded with exactly **one** row (`missing_tax_form`, migration
`20260304165108`). The other 34 rules exist only inside `generate-ontology-rules`, and that
function has **zero callers** in the app or in any other edge function — it must be curl'd by
hand. On a fresh deployment the engine loops over one rule. Every catch reported above assumes
someone remembered to run it.

### G7. Duplicate detection is exact-string only
`funds-flow-agent/index.ts:167` keys on `` `${payee.toLowerCase().trim()}|${amount}` ``. It caught
`Apex Advisory LLC` × 2 and missed `Apex Advisory, LLC` — same entity, same $1,250,000, same
account ending 5511, one comma apart. The deal overpays $1.25M with no flag. `resolve-entity` and
the `entity_resolution` table exist but neither engine uses them.

### G8. Pipeline failures are swallowed and leave partial state
`processFundsFlow` logs `wireErr` to the console and continues; the orchestrator returns success
with `wires_created` absent. The delete-then-insert in G2 is not transactional. A failure between
the two leaves a deal with zero wire instructions, a document marked processed, and no error
surfaced anywhere.

### G9. Known-blocker carry-over (already in `ARCHITECTURE.md`, still open, still on this path)
`disbursement-engine` is a `MockProvider` (B1); money is computed in JS floats (B5); no
idempotency keys on money-moving endpoints (B6); KYC is not gated before disbursement (B7). A
live deal cannot transact through these.

---

## P1 — important for the pilot

### G10. Blockers render as yellow warnings
`DealWorkspaceCover.tsx:428` maps `d.severity === 'critical' ? 'critical' : 'warning'`, but the
`discrepancy_severity` enum is `('blocker','warn','info')` — `'critical'` is never emitted. **Every
blocker in the reconciliation view displays as a warning.** The same block treats
`status === 'acknowledged'` as "Resolved", greying out live blockers.

### G11. Discrepancy messages don't carry what test 2 requires
The six required fields (what changed, why it matters, source, severity, blocks-closing,
recommended action) are not present. Actual output includes
`"Warning: Intent totals don't match expected waterfall outputs."` and
`"Warning: FX rate moved beyond tolerance since quote."` — no numbers, no source document, no
action. The funds-flow agent's findings *do* carry `expected_value` / `actual_value` /
`recommendation`, but they are stored on `agent_runs` and never persisted as discrepancies or
shown in readiness.

### G12. Three rules are registered twice, producing phantom duplicate blockers
`dual_counsel_approval` / `dual_counsel_missing`, `waterfall_reconciliation` /
`waterfall_intent_total_mismatch`, and `wire_instructions_missing` /
`payee_account_missing_or_mismatch` map to the same evaluator. 3 of the 22 discrepancies in the
run were literal duplicates of another row.

### G13. There is no single closing-readiness view; three are dead code
`ClosingReadinessPanel`, `GlassCockpitCover`, `DealReadinessHeader`, and
`deal-inputs/ReadinessPanel` have **zero mount sites**. What ships is readiness scattered across
`ExecutionPrepCover`, `VerificationReadinessBanner`, `ExecutionReadinessPanel` (inside Payments),
and a separate `binder_readiness` score returned by the discrepancy engine — four competing
numbers, no single answer. This is test 3's whole scope.

### G14. Recipient ↔ bank-detail matching is naive string equality
`validateCapTableVsWires` keys on `shareholder_name.toLowerCase().trim()` vs
`payee_entity.toLowerCase().trim()`. `Meridian Holdings, LLC` and `Meridian Holdings LLC` do not
match, which would produce a spurious "no wire instruction" blocker *and* hide a real one.

### G15. Missing-recipient detection only works cap-table-first
J. Okafor was caught because he sits on the cap table. A recipient present in funds flow v11 and
deleted in v12 — an advisor, a lienholder, an escrow agent — has no cap-table row and is
undetectable without G3.

### G16. Extraction confidence is never gated
The v12 funds flow classified at `doc_type_confidence: 0.42` and its extracted values flowed
straight into wire creation with no flag. `AiConfidenceBadge` and `field_corrections` exist for
display and correction; nothing blocks or escalates on low confidence.

### G17. Escrow is only cross-checked against two document types
`evalEscrowAmountConsistency` reads `escrow_amount` from `ESCROW_AGREEMENT` and `FUNDS_FLOW`
only. The SPA's $6,000,000 against the deal's $9,000,000 was never compared — the seeded wrong
extracted value passed through silently.

### G18. Cap-table total validation compares against the wrong number
`evalCapTableTotalValidation` flags a blocker when cap-table payouts ≠ deal value. Any deal with
debt payoff, advisory fees, or an escrow funding line will fail this permanently. It fired in the
run ($109.5M vs $120M) on a deal where the difference is entirely legitimate uses.

### G19. Cross-currency has no locked rate requirement
The EUR wire on a USD deal is `medium` severity only. `fx_quotes` exists; nothing requires a
locked quote before execution.

---

## P2 — can wait

- **G20.** `deal_documents.deal_id` is `TEXT` with no foreign key to `deals`.
- **G21.** `good_standing_missing`, `legal_opinion_missing`, and `working_capital_missing` fire on
  every deal regardless of deal type or the `required_document_matrix`.
- **G22.** The discrepancy engine returns its own `binder_readiness` score, a second readiness
  number competing with `dealMetricsService`. One of them should go.
- **G23.** Newton answers from a deal-context blob with no version stamp, so "what changed?" has
  nothing structured to read (test 4 dependency, but downstream of G3).
- **G24.** `evalObligationRules` matches obligations to intents by
  `payee_label.includes(recipient_id.slice(0,8))` — matching a name against the first 8 characters
  of a UUID. It cannot match anything in practice.

---

## What this locks for tests 2–4

Test 2 (funds flow & discrepancy tightening) is blocked on **G3** (versioning) — change detection,
recipient diffing, and "what changed between v11 and v12" all require it. **G2**, **G4**, **G5**,
and **G7** are the substance of test 2's downstream-consequence requirement.

Test 3 (closing readiness) is blocked on **G1** and **G13** — the gate must consume discrepancies,
and there must be one view.

Test 4 (end-to-end pilot) cannot pass its acceptance criteria until G1–G8 are closed; **G6** and
**G8** in particular are what make the run non-reproducible today.
