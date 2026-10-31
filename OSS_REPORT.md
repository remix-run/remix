# OSS_REPORT: remix-run/remix#12135

**Status:** DONE (fix + tests), with step 1 unverified (see Caveats)

**FLAG: SMALL FIX.** The change is confined to one executor function in `@remix-run/test`. It fixes real user-visible behaviour, but it has little reach beyond that package.

## Caveats
- Step 1 (issue still open, unassigned, no linked PR) was NOT verified. My GitHub tool access was scoped to the fork only, so I could not read upstream issue state. Check #12135 and open PRs before using this.
- The cost figure below is an estimate; I have no billing meter.

## Root cause
1. `registerDescribe` in `framework.ts` copies the parent's hook arrays, including `beforeAll`/`afterAll`, into every nested describe. The copies hold the same hook objects.
2. `runTests` in `executor.ts` walks a flat list of suites and runs each suite's `beforeAll` and `afterAll` arrays in full.
3. So a hook registered on a parent or at the top level runs once per descendant suite, not once per scope.

## Fix (diff summary)
- `packages/test/src/lib/executor.ts`:
  - Each `beforeAll` hook now runs only the first time a suite containing it starts. It is identified by object identity, so inherited copies are the same hook.
  - Each `afterAll` hook runs once, after the last suite that contains it (reverse registration order, so inner hooks run before outer ones).
  - A failing `beforeAll` is recorded and not re-run. It is still reported as a failed result for each suite that inherits it, and those suites are skipped, as before.
  - Hooks of skipped, pending, or `.only`-excluded suites are not run, as before.
- `packages/test/src/test/executor.test.ts`: 2 new tests.
  - Shared hooks run once per scope, in the right order.
  - A failing inherited `beforeAll` runs once and is reported for each suite.
- `packages/test/.changes/patch.nested-describe-hooks.md`: change file.
- `framework.ts` is untouched.

## Tests
Run from `packages/test` with Node 22 (the repo asks for >=24.3, so there is an engine warning). `remix test` was not linked, so I called the CLI entry directly:
```
node ../remix/src/cli-entry.ts test src/test/executor.test.ts
```
- Without the fix: 19 pass, 2 fail (the two new tests).
- With the fix: `ℹ pass 21 / ℹ fail 0`.

Full package run (`node ../remix/src/cli-entry.ts test`):
- Baseline (upstream main): 110 pass, 5 fail, 119 total.
- With the fix: 112 pass, 5 fail, 121 total.
- The same 5 failures occur on both. They are in the coverage and browser/Playwright tests, and the Playwright browser install failed in this sandbox. I did not investigate them further.

Other checks:
- `npx oxlint packages/test --max-warnings=0`: 0 warnings, 0 errors.
- `npx oxfmt --check packages/test`: clean.
- `npx tsc --noEmit` in `packages/test`: no errors printed.

## Risks
- Behaviour change: nested describes no longer re-run parent `beforeAll` hooks. This is the intended fix, but anyone relying on the old repeated setup will see a difference.
- `afterAll` timing: a parent's `afterAll` now runs after its last child suite, rather than after its own tests.
- The browser and e2e runners use the same executor. I could not run them here.
- A hook registered in a parent after a child describe has already been defined is still not inherited by that child. That is existing behaviour and out of scope.

## Draft PR description
**Title:** Run inherited `beforeAll`/`afterAll` hooks once per scope

Fixes #12135.

Nested `describe` blocks copy their parent's lifecycle hooks, and the executor ran each suite's `beforeAll`/`afterAll` arrays in full. A parent or top-level `beforeAll`/`afterAll` therefore ran once per descendant `describe`.

The executor now runs each `beforeAll` hook the first time a suite containing it starts, and each `afterAll` hook after the last suite containing it, in reverse order. A failing `beforeAll` is not retried, and it is still reported for each suite that inherits it.

Tests cover once-per-scope ordering and the failing-hook case. A change file is included.

## Estimated cost
Roughly $1–2 of usage (estimate).
