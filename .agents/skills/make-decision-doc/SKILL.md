---
name: make-decision-doc
description: Add a numbered decision document under `decisions/` to capture a non-obvious architectural choice. Use when the user asks for a decision doc, ADR, design rationale, or wants to record why we picked one approach over alternatives.
---

# Make Decision Doc

## Overview

Decision docs live at the repo root in `decisions/NNN-kebab-name.md`. They explain _why_ a choice was made — the tradeoff, the alternatives that were actually considered, and (when useful) the conditions under which we'd revisit. They are not feature specs, not how-to guides, and not changelog entries.

## When to write one

- A non-obvious architectural choice was made and a future contributor would reasonably ask "why didn't we do X instead?".
- A choice has tradeoffs that are easy to second-guess without context (perf vs. simplicity, lock-in vs. flexibility, ergonomics vs. correctness).
- We diverged from a common default or industry-standard alternative and the reasoning matters.

Skip a decision doc when the choice is obvious, the alternatives weren't seriously considered, or the rationale already lives in code comments / change file / PR description.

## Workflow

1. Read the existing files under `decisions/` (e.g. `decisions/001-*.md`) to match tone and structure.
2. Pick the next number by counting existing files (`ls decisions/ | wc -l`) and add 1. Filename is `NNN-kebab-slug.md` with a 3-digit zero-padded prefix.
3. Pick a slug that names the _thing being decided_, not the verb (`single-matcher`, not `pick-single-matcher`).
4. Draft the doc following the structure below. Keep it grounded — no hypothetical alternatives, no aspirational language.
5. If the decision relates to other decisions, link them as footnotes (`[NNN]: ./NNN-other.md`).

## Structure

No rigid template — match the style of existing docs. The shape that tends to work:

- **H1 title**: a short statement or question that a reader scanning the folder can grok at a glance.
- **Opening framing** (1–3 short paragraphs): what the choice was, why it came up, and what the realistic alternatives were. Lead with concrete context, not abstractions.
- **Tradeoff sections**: typically "What gets simpler / harder", "Why we chose X", or named sections per dimension (perf, complexity, ergonomics). Use H2s.
- **When to revisit** (optional but encouraged): a numbered list of conditions that would flip the decision. Keeps the doc honest and gives future contributors a clear off-ramp.
- **Footnote links** to related decisions or external sources cited in the body.

## Content rules

- Ground every claim. Cite benchmarks, blog posts, code references, or measured behavior. If the decision is "feels nicer", say so explicitly rather than dressing it up.
- Only list alternatives that were actually deliberated. Inventing options to knock down weakens the doc.
- Past tense for the decision ("we chose X"), present tense for ongoing implications ("X means we don't need Y").
- Keep prose tight. These docs reward density — readers come looking for a specific answer.
- Code references use the repo's standard `path/to/file.ts` style; line ranges with backtick fences when illustrating a specific snippet.
- No marketing tone, no hedging filler ("it's worth noting that…", "in many cases…"). State the call.

## Checklist

- Did you read at least one existing decision doc to match style?
- Is the filename `NNN-kebab-slug.md` with the next available number?
- Does the H1 communicate the decision in one line?
- Are the alternatives ones that were actually considered?
- Did you cite concrete evidence (benchmarks, sources, code) instead of assertions?
- Is there a "when to revisit" section if the decision could plausibly flip?
