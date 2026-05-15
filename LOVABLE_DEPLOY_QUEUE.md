# Lovable Paste Queue

Tracker for client-side fixes that exist on the `dev` branch but haven't been pasted into Lovable's editor yet. These changes only affect the **live demo URL** if you apply them in Lovable (Lovable commits them to `main` automatically).

The fixes are stable on `dev`. Pasting any of them is safe — each is a self-contained patch that doesn't depend on other dev-only changes. Apply at your discretion.

## Already pasted into Lovable (✅ live)

| Date | File | Commit on `dev` | Effect on live |
|---|---|---|---|
| 2026-05-13 | `supabase/functions/_shared/require-jwt.ts` | `8c70a56` | Replaced manual HS256 verification with `supabase.auth.getUser()`. Unblocked 10+ auth-requiring edge functions (document-ai, newton, manual-verify, etc.). |
| 2026-05-13 | `src/services/newtonActionService.ts` | `608b03c` | Send user JWT (not anon key) so `newton-action` accepts authenticated requests. Fixes the "Unknown error" / "Action needs attention" that appeared when clicking Newton chips (Generate KYC, list blockers, etc.). |

## Still queued — paste when ready

### Auth-bearer pattern (5 files)

Same root pattern as `newtonActionService.ts`. Five client files were sending the anon key as the Bearer token; the rewrite makes them send the user's session JWT (with anon as fallback). Each is one file, ~5-10 line change, self-contained.

| Priority | File | What it fixes |
|---|---|---|
| **High** if you use Newton chat | `src/components/newton/NewtonGlobalChat.tsx` | Global Newton chat panel (the floating sparkle button). Chat would fail or partially work without the user JWT. |
| **High** if you use Newton chat | `src/components/pivt-complete/cover/NewtonCover.tsx` | Newton cover section (full-page Newton view). Same chat function. |
| **Medium** | `src/components/pivt-complete/cover/NewtonAgentPanel.tsx` | Alternate Newton agent panel that also calls `newton-action`. Mirrors the fix already pasted in `newtonActionService.ts`. |
| **Medium** | `src/components/pivt-complete/cover/DocumentsCover.tsx` | Document Q&A panel — lets you ask Newton questions about uploaded docs. The "qa" action against `document-ai` would fail without the user JWT. |
| **Low** | `src/components/support/SupportPanel.tsx` | In-app support chat (the question mark / help button). Would fall back to anon, may still work via the chat function's lenient auth, but should send user JWT for consistency. |

### UX hardening (independent)

| Priority | File(s) | Commit | What it fixes |
|---|---|---|---|
| **Medium** | `src/components/pivt-complete/cover/DealsCover.tsx` + `src/hooks/useDealOperations.ts` | `952f61d` | Gates the "+ New Deal" button and "Create your first deal" CTA behind auth. Signed-out users now get redirected to `/login?next=…` instead of being allowed to fill the modal and then getting a cryptic Postgres RLS error on submit. Defense-in-depth toast in `createDeal` for any caller that bypasses the gating (Newton, Command Palette, etc.). |
| **Medium** | `src/components/pivt-complete/cover/ApprovalsWorkflowCover.tsx` | `0052930` | Fixes "Failed to add approver" on the Execution → Approvals tab. The `deal_approvals.approval_side` column has a CHECK constraint that only allows `'buyer'` or `'seller'`, but the UI was sending the richer UI role (e.g. "Seller Counsel", "Target Signatory") straight through, which the DB rejected. A `sideFromRole()` mapper now collapses any seller/target-ish role to `'seller'` and everything else to `'buyer'`. Also surfaces the real DB error message in the toast so future failures are diagnosable instead of showing the same opaque "Failed to add approver". |
| **Medium** | `src/components/pivt-complete/cover/ContactsDealTab.tsx` + `KycKybDealTab.tsx` + `VerificationReviewCover.tsx` | `4683f16` | Adds manual Approve / Reject controls across the three places a deal owner reviews people: Contacts tab (per-row Approve/Reject buttons + reject-reason dialog), KYB/KYC tab (the inline Review/Manual button now works for any non-verified row, not just `submitted`; review queue rows are now actionable too), and the Verification review queue cover (the inline Verify and the expanded Mark Verified / Mark Failed buttons were previously gated to platform admin via `isAdmin` — backend `manual-verify` only requires a valid JWT and RLS gates the underlying write, so the client gate was over-restrictive). |
| **Low** | `src/services/dealMetricsService.ts` | `1dc4bab` | Fixes the yellow dot next to "Stakeholders" in the workspace sidebar — it was wired to "every stakeholder verified" so it stayed yellow until KYC was 100% done, even after the roster was complete. Verification already has its own sidebar dot just below, so KYC was being tracked twice. New rule: stakeholders dot is green once buyer side + seller side are both present (`stakeholdersConfigured`); KYC progress continues to drive the verification dot. |
| **Low** | `src/services/dealMetricsService.ts` | `63f17b6` | Fixes the yellow dot next to "Deal Inputs" — it was gated on satisfying all 8 categoryChecks (financial + cap_table + waterfall + wire_instructions + tax + contracts + governance + obligations). The bar was so high that even the test's "Clean Deal — Healthy Close" scenario failed it (3/8 missing), which is why the test deliberately doesn't assert `deal_inputs` is complete. The non-required categories (waterfall, wires, tax, governance, obligations) are already gated under the Execution dot. New rule: Deal Inputs is complete when `cap_table` and `contracts` are both present (stakeholders + a core contract uploaded). |
| **Medium** | `src/services/dealMetricsService.ts` + `src/components/pivt-complete/cover/ApprovalsWorkflowCover.tsx` | `f349661` | Fixes two bugs on the Approvals tab: (a) the sidebar dot was blank because `stageStatuses` had no `approvals` key — `getStepDot('approvals')` always read undefined and fell through to grey. Added the key with a rule that turns green when every approval is granted (handles the all-optional case too), blocked when any row has a declined/expired/failed/blocked status, in_progress otherwise. (b) Added manual Approve / Decline buttons on every actionable row. Approve writes `status='approved' + completed_at`; Decline opens a reason dialog and writes `status='rejected' + declined_at + blocker_reason`. Both append to `audit_log`. Uses the two CHECK-constraint-safe values; `mapDbStatus` translates them to the UI's completed/declined badges. |

## How to apply one

When you're ready to update any of these in live:

1. Tell me which file and I'll paste its full new content (or a focused diff if the file is large), the same way I did for `require-jwt.ts` and `newtonActionService.ts`.
2. Paste the change into Lovable's code editor at the file's path.
3. Save. Lovable commits to `main` and redeploys the frontend (usually under a minute).

## How to find the pattern in the file you're pasting into

Each file currently has a `fetch(..., { headers: { Authorization: \`Bearer \${...ANON_KEY}\` } })` shape. The fix replaces that with the user JWT pattern:

```ts
const { data: { session } } = await supabase.auth.getSession();
const bearer = session?.access_token || ANON_KEY;
// then: Authorization: `Bearer ${bearer}`,  apikey: ANON_KEY
```

A few files also need `import { supabase } from '@/integrations/supabase/client';` at the top if not already imported.

## When this list is empty

When all five are pasted (or after a future `dev` → `main` merge handles them all in one go), delete this file. It's a temporary index, not part of the product architecture.
