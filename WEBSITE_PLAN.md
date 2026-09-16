# pivt.space redesign — plan

Reference: goparachute.ai. Brief from the co-founder, 2026-09-16.

I read both sites rendered (not just the brief) before writing this. Two things
in the brief don't match what Parachute actually does, and one thing on our
current site isn't true about our product. All three are in §1.

---

## 1. Three corrections before anything gets built

### 1a. Parachute's four stages are not tabs

The brief asks for "Parachute's tabbed section that lets you click between
Gather / Review / Draft / Finalise." That section is **four tiles that anchor-link
to four stacked, full-width sections** further down the page. Each stacked
section has a small colour-coded label chip, one H2, and three or four feature
cards with a screenshot each. Nothing is hidden behind a tab.

This matters because it's *why* the page breathes: tabs would hide three
quarters of the product from anyone who scrolls, and scrolling is the only
interaction most visitors perform. **Recommendation: tiles + stacked sections,
matching what Parachute really does.** If we want a tabbed control as well, it
can sit inside the hero as the thing the video cycles through — but not as the
product section.

### 1b. Parachute's type discipline is in weights, not size count

Measured on the live page: **12 distinct size/weight combinations**, which is
more than we'd guess. What makes it feel controlled is that it uses only three
weights (400/500/600) and one display serif (IvyOra) for H1/H2 with a plain sans
(Geograph) for everything else. The display face carries the hierarchy so the
scale doesn't have to.

So the fix for us isn't "fewer sizes" — it's **one display face, one body face,
three weights, and a fixed scale**. See §6.

### 1c. Our current site claims something the product doesn't do

pivt.space today says PIVT "orchestrates execution through partner rails" and
"triggers execution." **The disbursement engine executes through a `MockProvider`.
No bank API, no settlement.** This is tracked as T2 in `TECH_DEBT.md`, and the app
itself now shows a "Simulation — no funds move" notice on those screens.

A marketing site for a product about to take paying customers cannot say this.
What *is* true and still strong: PIVT generates bank-ready wire packs, gates them
behind dual-counsel approval, and re-opens verification on any change to wire
instructions. Every copy draft below says that and nothing more.

Same rule for **SOC 2**: the brief says "SOC 2 in progress." Nothing in the app
or repo mentions SOC 2 today. If an audit has genuinely been engaged, say so; if
not, the security section still works without it (§7).

---

## 2. The four stages — recommendation

The brief proposes Ingest / Understand / Coordinate / Verify / Execute (five) and
asks for my instinct.

**Four, not five**, and the verbs should be the ones a closing team already uses
rather than the system's internal names. "Understand" describes what the software
does; nobody on a deal team says it.

| Stage | What it covers (all true today) | Why this word |
|---|---|---|
| **Ingest** | Upload the SPA, funds flow, wire instructions, cap table, escrow agreement. PDF, scanned PDF, Excel and Word are read natively; obligations, signature blocks and consent requirements are extracted. | The word the current site already uses. |
| **Reconcile** | 31 rules check every figure against the signed agreement — purchase price across SPA / deal record / funds flow, escrow amounts, sources = uses, party names, cap-table totals. 19 of them block closing. Every version of a document is diffed against the last. | More specific than "Verify"; it's the word finance people use, and it is literally what the discrepancy engine does. This is the strongest, most defensible thing we have. |
| **Coordinate** | Signature packets, third-party consents, KYC and document requests to counterparties — drafted, sent from a reviewed queue, chased on a cadence, verified on return. | Covers all three features from the co-founder's earlier brief. The current site omits this stage entirely. |
| **Close** | One readiness view answering "can this transaction close?", dual-counsel approvals that are invalidated when anything upstream changes, and a bank-ready wire pack generated only when everything is green. | The outcome, and honest. "Execute" over-claims (§1c). Newton's central question is "what's blocking close?" — ending on *Close* ties the whole page to it. |

Ingest · Reconcile · Coordinate · Close.

---

## 3. Page structure, top to bottom

Ten sections, matching Parachute's count. One job each.

### 3.1 Nav
`Product` · `Use Cases` · `Security` · **`Request a Demo`** (button)

Note: "Use Cases" needs pages that don't exist yet. Candidates by buyer: PE
operations / portfolio ops; law-firm closing teams; escrow and paying agents.
Until those exist, the nav item should anchor to the feature-module section
rather than 404.

### 3.2 Hero
Three-line structure: display headline, one sentence, one button, video.

Headline options (pick one):
1. **Close with certainty.** ← my pick. Short, emotional, and it's the product's actual promise.
2. Nothing moves until it's right.
3. Know it closes before it closes.

Sentence: *PIVT reads every closing document, reconciles every payment against
the signed agreement, and tells you exactly what's still in the way.*

Button: **Request a Demo**. Nothing else in the hero.

Video: 12–15s, muted, looping, no UI chrome. One flow: a funds flow is uploaded,
a discrepancy appears, Newton is asked "what's blocking close?", the readiness
view goes green. See §5 for production.

### 3.3 Four stage tiles
Ingest · Reconcile · Coordinate · Close — icon, name, one line each. Anchor-link
to §3.4–3.7.

- Ingest — *Every closing document, read and structured.*
- Reconcile — *Every figure checked against the signed agreement.*
- Coordinate — *Signatures, consents and KYC, chased for you.*
- Close — *One answer to "can this transaction close?"*

### 3.4–3.7 Four stacked stage sections
Label chip + H2 + three feature cards with a screenshot each.

**Ingest** — H2: *Every document, read the way a closer reads it.*
- Native extraction — PDF, scanned PDF, Excel and Word. No retyping.
- Obligations — Conditions, covenants and deliverables lifted from the agreement.
- Versions — Every re-upload diffed against the last; nothing silently replaced.

**Reconcile** — H2: *Thirty-one checks. Nineteen of them can stop a wire.*
- Purchase price and escrow — Must agree across the SPA, the deal, and the funds flow.
- Sources and uses — Must balance, to the cent.
- Wire changes — Any change to banking details re-opens verification and invalidates stale approvals.

**Coordinate** — H2: *Stop chasing. Start closing.*
- Signature packets — Who signs what, generated from the agreement.
- Third-party consents — Every consent the deal needs, drafted and tracked.
- Document collection — A portal for counterparties, reminders on a cadence, verification on return.

**Close** — H2: *Can this transaction close? One screen. One answer.*
- Closing readiness — Every blocker, clickable, with what changed and what to do.
- Dual-counsel approval — Invalidated automatically when anything upstream changes.
- Wire pack — Bank-ready instructions, generated only when everything is green.

### 3.8 Newton
Own section. A **real captured conversation**, not written copy — see §5.
Structure: the prompt on the left, Newton's structured answer on the right, and
one line underneath: *Newton reads the same deal you do. Every answer cites the
document it came from.*

Prompt: **"What's blocking close?"**
Answer: three items, each with the document it was found in and the next action.

### 3.9 Stats strip
Three numbers, full width. Rules: every number either comes from a citable
third-party source or is a verifiable fact about the product. **We have no
customers, so "average days saved per closing" would be invented — do not use it.**

| Number | Line | Source |
|---|---|---|
| **$2.77B** | lost to business email compromise in 2024 | FBI IC3 2024 Internet Crime Report — **verify the figure against the report before publishing** |
| **31** | reconciliation checks on every deal; 19 can block closing | product fact, `discrepancy_rules` |
| **0** | wires generated before dual-counsel approval | product design fact |

The co-founder said they'd look for market-research numbers; the middle column
can take whichever is strongest once sourced.

### 3.10 Security
Shield icon, one short paragraph, no claims we can't back:

*PIVT is built on Supabase infrastructure. Data is encrypted in transit and at
rest, every table is protected by row-level security so a deal is visible only
to the parties on it, and every approval, upload and change is written to an
audit log.* [+ "SOC 2 Type I audit in progress" **only if that is true**.]

Link to the existing `/security` page.

### 3.11 Closing CTA
Mirror Parachute exactly: illustration or product frame left, headline + one
sentence + one button right.

Headline: **Close with certainty.** (repeat the hero — Parachute repeats its
promise too)
Sentence: *See how PIVT reads your documents, reconciles every payment, and
tells you what's in the way.*
Button: **Request a 30-minute demo**

### 3.12 Footer
Product · Security · Legal (Privacy, Terms, DPA) · Contact.

---

## 4. Feature modules

The brief asks for four modules *after* the workflow section: Closing
Readiness, Funds Flow & Disbursement, Stakeholder Verification, Newton AI.

With the stacked stage sections, three of these already have a home (Readiness
→ Close, Funds Flow → Reconcile, Verification → Coordinate) and Newton gets its
own section. **A separate four-module block would say the same things twice.**
Recommendation: drop it, and let `Use Cases` in the nav point at the stage
sections until real use-case pages exist. If the co-founder wants the module
block regardless, rename "Funds Flow & Disbursement" to **"Funds Flow & Wire
Packs"** — see §1c.

---

## 5. Assets to produce (I can make all of these from the demo deal)

| Asset | How |
|---|---|
| Hero video | Scripted run against the demo deal on pivt.tools: upload → discrepancy → Newton → readiness green. Recorded with Playwright at 1440×900, cropped to the product frame, 12–15s, exported webm + mp4, muted, loop. |
| 12 stage screenshots | Same demo deal, same viewport, same zoom, light theme. One per feature card. |
| Newton transcript | Ask the real Newton "What's blocking close?" on the demo deal and capture the actual response. Edit for length only. |
| Stage icons | Four line icons, single weight, matching the tile colours. |

Nothing in the visuals should be a mock-up of the product. Every screenshot is
the real thing.

---

## 6. Type system

Current site: Inter only, dark theme, purple accent, many competing sizes.

| Role | Face | Size | Weight |
|---|---|---|---|
| Display (H1, closing CTA) | one serif or geometric display face — pick one | 64px | 500 |
| Section heading (H2) | display face | 44px | 400 |
| Card heading (H3) | body face | 20px | 600 |
| Body | body face (keep Inter) | 17px | 400 |
| Label / chip | body face | 13px | 600, tracked |

Five sizes, three weights, two faces. Anything not in the table gets one of these.

Colour: decide light vs dark deliberately. Parachute is warm off-white with dark
sections for contrast. Our current dark-with-purple reads as "crypto"; a light
ground with one deep accent reads as finance. I'd go light.

---

## 7. Delivery — the real blocker

**The source for pivt.space is not on this machine and not in any GitHub repo
I can see.** It's a Vite SPA (Inter, hashed `index-*.js`), almost certainly a
separate Lovable project. The old `PIVT-Team/PIVT-MVP` repo has a
`LandingPage.tsx` but none of the live site's copy is in it.

Two ways to build this:

**A. Connect the pivt.space Lovable project to GitHub**, then I work in that repo
with the same Actions pipeline that deploys pivt.tools. Lovable → project
settings → GitHub → connect. You do that once; I do everything after.

**B. Rebuild as a small static site** (Astro — what Parachute uses) in a new repo,
deployed by the same pipeline. A marketing page has no need for a SPA or a
Supabase client; Astro ships near-zero JavaScript and gets the polish for free.

**Recommendation: B.** The redesign touches every section anyway, so a clean
build is less work than surgery inside a Lovable SPA, and it removes the
marketing site from the Lovable dependency entirely — which is the bottleneck
that cost four rounds on one migration today. Point the pivt.space domain at the
new deploy when it's ready; the old site stays up until then.

---

## 8. Sequence

1. **Decisions** (one conversation): stage names, headline, light/dark, SOC 2
   truth, delivery path A or B, the two market-research numbers.
2. **Assets** (me, ~1 day): video, 12 screenshots, real Newton transcript.
3. **Build** (me, ~2 days): sections in the order above, type system first so
   every section inherits it.
4. **Verify** (me): every section at 1440 / 1024 / 390 widths, dark-mode
   contrast, video weight under 2MB, Lighthouse ≥ 95, every claim on the page
   checked against the product.
5. **Cut over**: DNS for pivt.space → new deploy.

What I need from you is step 1. Everything else I can do.
