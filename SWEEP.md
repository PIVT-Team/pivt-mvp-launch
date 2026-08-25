# Codebase sweep — "built but not wired"

Systematic pass for the pattern that has bitten five times today: code that is
written, correct, and unreachable. Everything below was found by script, not by
memory, and each entry says how it was detected.

---

## The finding in one line

**17 of 53 edge functions have no caller. 21 of 79 cover components are never
mounted. 14 tables are never touched by any code.** That is roughly a third of
the backend and a quarter of the UI that exists but does nothing.

Not all of it is a bug — webhooks and cron targets are called from outside the
repo — but the ones that aren't are invisible failures: the feature looks built,
reviews clean, and never runs.

---

## P0 — silently breaks a live deal

### S1. `obligation-extractor` is never triggered
Extracts payment obligations from contracts — the input to
`evalObligationRules`, which gates amount/currency/instruction mismatches at
execution. Nothing invokes it. `document-ai` and the orchestrator both skip it.

**Effect:** `obligations` stays empty, so `evalObligationRules` returns early and
four blocker rules never fire on any deal.

**Fix:** call it from `deal-workflow-orchestrator` after SPA/contract processing,
alongside the discrepancy engine. ~15 lines.

### S2. `generate-ontology-rules` has no caller
Already known (G6), and the migration now seeds the rules — but this function is
still the only way to add rules later, and nothing calls it. Any new rule needs
a manual curl.

**Fix:** either delete it as superseded by the migration, or wire it to an admin
action. Don't leave both paths.

### S3. `disbursement-engine` unreachable *and* still a mock
Nothing calls it, and it uses `MockProvider`. The money path is both disconnected
and simulated.

**Fix:** out of scope for now, but it should not be presented as working. Worth a
banner in the UI until it's real.

---

## P1 — the product looks broken to a user

### S4. Newton chat is dead code
`NewtonGlobalChat.tsx` is never mounted. It's the floating chat entry point, and
it's in the Lovable paste queue as a "high priority" auth fix — for a component
nothing renders.

**Fix:** mount it, or remove it and the queue entry.

### S5. `get-deal-context` has no caller
Newton's deal-context provider. Without it Newton answers from whatever the
client passes, not a server-assembled view of the deal.

**Fix:** call it from the `newton` function before building the prompt.

### S6. Blockers still render as warnings in two places
`DealWorkspaceCover.tsx:270-274` compares `severity === 'critical'`, but the
`discrepancy_severity` enum is `blocker | warn | info`. `'critical'` is never
emitted, so **every blocker renders in the amber "warning" style**.

**Fix:** compare against `'blocker'`. One line, three occurrences.

### S7. `resolve-entity` unused
Entity resolution exists but neither the funds-flow agent nor the extractors use
it — they use my `normalizePayee`, which is deliberately conservative. Two
competing approaches, one unused.

**Fix:** pick one. If `resolve-entity` is better, route `normalizePayee` through it.

---

## P2 — noise and drift

### S8. 21 dead cover components
Including `GlassCockpitCover`, `ClosingReadinessPanel`, `StakeholdersCover`,
`CommandCenterCover`, `NewtonCover`, `AnalyticsDashboard`, `LPPortalCover`,
`MessagesCover`, `NotificationsCover`, `AutonomyCover`, `MCPIntegrationsCover`,
plus 7 escrow sub-components and 5 Newton sub-components.

Some are earlier versions of screens that were rebuilt; some were never
finished. Either way they are read during every code review and every AI-assisted
change, and they make the codebase look larger and more capable than it is.

**Fix:** delete, or move to `src/_archive/` so intent is explicit.

### S9. 14 unreferenced tables
`checklist_templates`, `checklist_template_items`, `ontology_terms`,
`obligation_intent_map`, `execution_events`, `job_status`, `comment_mentions`,
`user_activity_events`, `admin_allowlist`, `admin_audit_log`,
`email_unsubscribe_tokens`, `suppressed_emails`, `deal_entity_graph`,
`wire_instruction_history`.

`wire_instruction_history` is mine and is written by a trigger — it needs a
**reader**: the wire change history should be visible in the UI, since it is the
audit trail for the re-verification behaviour.

`user_activity_events` and `admin_audit_log` being unwritten is a compliance gap,
not just tidiness.

### S10. Four types the classifier can silently override
Fixed the symptom today (documents no longer vanish), but `document-ai` still
overwrites the user's chosen `doc_type` with no record of what the human picked.

**Fix:** keep the user's choice in `document_role` (column already exists) and let
the AI classification live in `doc_type`, so disagreement is visible rather than
destructive.

---

## Plan, ordered by impact per hour

| # | Work | Effort | Why first |
|---|---|---|---|
| 1 | S6 — blocker severity display | 10 min | One-line fix; every blocker currently looks like a warning to a user deciding whether to close |
| 2 | S1 — trigger `obligation-extractor` | 30 min | Unlocks four dormant blocker rules on every deal |
| 3 | S5 — wire `get-deal-context` | 30 min | Newton currently answers without server-side deal state |
| 4 | S4 — mount or delete Newton chat | 30 min | Either ship the feature or stop maintaining it |
| 5 | S9a — reader for `wire_instruction_history` | 1 h | The re-verification trail exists but nobody can see it |
| 6 | S10 — preserve the user's doc type | 45 min | Stops AI silently overriding a human choice |
| 7 | S8 — archive 21 dead components | 1 h | Compounding: every future change gets cheaper |
| 8 | S7 — reconcile entity resolution | 1 h | Two approaches, pick one |
| 9 | S2 — resolve the rules duplication | 30 min | Delete or wire; don't keep both |
| 10 | S3 — mark disbursement as non-functional | 20 min | Honesty in the UI until it's real |

**Items 1–4 are half a day and remove the four most visible defects.**
Items 5–10 are a second day and are mostly hygiene.

---

## The systemic fix

Every one of these passed code review and tests. The pattern is always the same:
the unit works, and nothing calls it.

Two cheap guards would have caught most of it:

1. **An orphan check in CI.** The scripts at the top of this document run in
   seconds. Fail the build — or just warn — when a new edge function or route
   component has no caller.
2. **Ship-a-path, not a unit.** Treat "how does a person reach this?" as part of
   done. I made exactly this mistake today: built the Requirements view, wired
   the router, ran the tests, and left it unreachable because no nav entry
   pointed at it.
