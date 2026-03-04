

## Diagnosis

The Deals page (`DealsCover.tsx`) has its **own inline deal creation form** (lines 388-513) that was never updated. The changes previously applied went to a separate `CreateDealDialog.tsx` component that is not rendered on this page.

The inline form in `DealsCover.tsx` is missing:
- Signing Date field
- "Private Equity Acquisition" in the Deal Type dropdown
- Expanded currency list with region labels
- Multi-currency selection with badge tags
- `signing_date` in form state and submit handler

## Plan

### 1. Update `DealsCover.tsx` form state and submit handler

- Add `signing_date` to the form state object (line 222)
- Add `selectedCurrencies` state (default `["USD"]`)
- Add `toggleCurrency` helper function
- Update `handleCreateSubmit` to pass `signing_date` and `currency: selectedCurrencies.join(',')` to `createDeal()`
- Reset `selectedCurrencies` after successful creation

### 2. Update the Deal Type dropdown (lines 410-416)

Replace the hardcoded `SelectItem` list with the full DEAL_TYPES array that includes "Private Equity Acquisition". Use the same constant already defined in `CreateDealDialog.tsx`:
- Private Company Share Purchase
- **Private Equity Acquisition**
- Asset Acquisition
- Merger
- Leveraged Buyout
- Growth Equity
- Venture Investment
- Secondary Transaction
- Other

### 3. Add Signing Date field (between Deal Type and Expected Close Date)

Move the "Jurisdiction & Timing" section to include a Signing Date picker using the Popover + Calendar pattern (same as `CreateDealDialog.tsx`). Place it in the grid alongside Expected Close Date.

### 4. Replace currency single-select with multi-currency selector

Replace the single `<Select>` for currency (lines 477-487) with:
- A row of `<Badge>` tags showing selected currencies (with X to remove)
- A grouped `<Select>` dropdown to add currencies, using the full `CURRENCY_GROUPS` constant with region labels
- Same pattern as already implemented in `CreateDealDialog.tsx`

### 5. Update `useDealOperations.ts` `createDeal` function

Verify the `createDeal` function passes `signing_date` through to the database insert. If not, add it.

### Technical approach

Import the CURRENCY_GROUPS and DEAL_TYPES constants (or define them locally), add the Calendar/Popover/Badge imports, and restructure the form sections. No database migration needed -- `signing_date` column already exists on the `deals` table.

