# Archive

Files unreachable from `src/main.tsx` / `src/App.tsx`, determined by following
the import graph (including lazy `import()`), not by name matching.

They are kept rather than deleted because several are earlier versions of
screens that were later rebuilt, and the history is worth having. Nothing here
is compiled into the app.

**If you need one back:** move it out of `_archive/` and import it. Note that
several were unreachable because a nav entry was never added, not because the
work was abandoned — check whether the feature was meant to ship before
deleting anything.

Excluded from the sweep: `src/components/ui/**` (the shadcn primitive kit — kept
whole so future components can use it) and `vite-env.d.ts` (consumed by tsc, not
imported).

## Later additions

`ApprovalsCover.tsx` and `DealInputsCover.tsx` were imported by
`DealWorkspaceCover` but never rendered — the switch returns
`ApprovalsWorkflowCover` (which reads and writes `deal_approvals` for real) and
the individual `deal-inputs/*` panels instead. Both were pure `MOCK_*`
constants: `ApprovalsCover` showed a $840M wire approval for "Project ATLAS"
with approve and reject buttons that only raised a toast. Approving a wire is
the most consequential action in this product, and that screen was theatre for
a deal that does not exist.
