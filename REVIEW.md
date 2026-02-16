# Branch Review (`main...markdalgleish/assets`)

## Overall Assessment

This branch is in strong shape architecturally. The main work left before merge is cleanup/polish:

- align new package docs with monorepo conventions
- tighten a few public-facing details
- deepen test coverage around edge/error paths
- add a clear strategy for `typed-glob` type-performance hardening

I do **not** see major architectural blockers.

## Priority 0 (must fix before merge)

### 1) README consistency with repo standards

The new package READMEs are close, but inconsistent with established monorepo style:

- `packages/assets/README.md`
  - Title uses scoped package name; most package READMEs use plain package name
  - Installation uses package-specific install instead of `npm i remix`
  - License says `MIT` instead of repo-standard license link
  - API section is terse bullets; repo style favors usage-led docs + sectioned API content
- `packages/assets-middleware/README.md`
  - Same install/license/title inconsistencies
  - Structure is a bit reference-heavy vs usage-oriented
- `packages/dev-assets-middleware/README.md`
  - Install command should be `npm i remix` for consistency
- `demos/assets/README.md`
  - Title style differs from `demos/bookstore/README.md` pattern

Suggested baseline alignment:

- title: `# assets`, `# assets-middleware`, `# dev-assets-middleware`
- installation: `npm i remix`
- license: `See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)`
- keep usage examples as primary documentation surface; keep API sections structured and concise

### 2) TODO in public entrypoint

- `packages/assets/src/index.ts` contains:
  - `// TODO: Bike shed this and/or refactor.`

Recommendation: Leave for now since it requires a design pass.

## Priority 1 (high-value cleanup)

### 3) Test coverage gaps: `dev-assets-middleware` package itself

`@remix-run/assets` has substantial test coverage; `@remix-run/dev-assets-middleware` tests are comparatively thin.

- `packages/dev-assets-middleware/src/lib/assets.test.ts` currently validates basic wiring only

Add focused middleware-level tests for:

- `context.assets` is always set before `next()` is invoked
- `context.assets.get()` behavior with/without `files`
- propagation of `createDevAssetsHandler` responses vs `next()` fallthrough
- behavior when `createDevAssetsHandler` returns `null` on non-served paths
- option pass-through sanity (`allow`, `deny`, workspace options, `external`, `sourcemap`)

This package is small, so a few extra tests will close most risk.

### 4) Static middleware `basePath` follow-up tests

`basePath` support in `static-middleware` is good and already tested, but there are still a couple of worthwhile edge tests:

- `basePath` with repeated slashes (e.g. `//assets///`)
- `basePath` behavior when request is exactly the base path and index files exist
- optional: ensure intended behavior with URL-encoded path segments under `basePath`

## Priority 2 (typed-glob deep cleanup plan)

## Current state

`typed-glob` is type-level only (runtime matching uses `picomatch`), and it already has strong semantic parity coverage:

- `typed-glob/types.test.ts`
- `typed-glob/parity-cases.ts`
- `typed-glob/types-parity.test.ts`
- `typed-glob/minimatch-parity.test.ts`

Coverage is strong on correctness for common+advanced syntax, but not stress/perf.

## Key risks

The complexity concentration is in `packages/assets/src/lib/typed-glob/types.ts`:

- heavy recursive conditional types for extglobs and alternatives
- large expansion surfaces (brace/extglob combinations)
- very large helper maps and deep utility layering

This increases risk of type-instantiation blowups on complex patterns and can hurt editor responsiveness.

## Recommended incremental plan (tests first)

### Phase A: Add stress coverage (before refactor)

Add new type tests that intentionally combine features:

- deep extglob nesting
- large alternative sets
- brace + extglob + globstar combinations
- long path patterns with multiple globstars
- mixed options (`dot`, `nocase`, `matchBase`, `noext`, `nobrace`)

Goal: lock behavior before simplification.

### Phase B: Add type-performance benchmarks (route-pattern style)

Mirror the approach used in `packages/route-pattern/bench/types`:

- create `packages/assets/bench/types/*`
- use `@ark/attest` `bench(...).types([N, 'instantiations'])`
- track:
  - simple baseline
  - extglob-heavy cases
  - brace-heavy cases
  - mixed stress cases

Goal: make type-performance regressions visible and measurable during iteration.

### Phase C: Simplify internals with behavior locked

Refactor `types.ts` for readability/maintainability:

- consolidate duplicated match/consume logic where feasible
- reduce recursive branching in extglob alternative handling
- simplify helper layering and naming (narrative flow)
- preserve current parity expectations

Goal: smaller conceptual surface area and easier future maintenance.

### Phase D: Optimize only where benchmarks show pain

Use the new type bench harness to target the worst offenders and verify gains.

## Public API surface review

No obvious API bloat was found in new packages:

- `@remix-run/assets`: exports look intentional and coherent
- `@remix-run/assets-middleware`: minimal exports (`assets`, middleware types)
- `@remix-run/dev-assets-middleware`: single export (`devAssets`)
- `remix` re-exports are auto-generated umbrella exports (expected for package design)

Minor note:

- `packages/assets/src/lib/files.ts` exports some helper types not re-exported in package entrypoint; this is acceptable as-is, but can be tightened later if desired.

## Additional observations

- Good: `assets-middleware` has broad behavior coverage (chunks, transitive imports, circular handling, baseUrl normalization, variants).
- Good: `assets` dev handler tests already cover many security and behavior scenarios.
- Good: typed tests for assets/file-variant typing are thoughtful and meaningful.
- Nice-to-have: consider replacing loop-generated runtime tests in `typed-glob/minimatch-parity.test.ts` with explicit tests if IDE test discoverability becomes an issue.

## Suggested execution order

1. README normalization pass
2. Remove public TODO comment
3. Add `dev-assets-middleware` middleware-behavior tests
4. Add `static-middleware` `basePath` edge tests
5. Start typed-glob Phase A/B (stress tests + type perf bench harness)
6. Then decide whether Phase C/D refactor is needed in this PR or a follow-up PR

## Merge readiness call

If we do the Priority 0 + Priority 1 items, I’d be comfortable merging this branch.

The typed-glob simplification/perf work is important, but can reasonably be split:

- minimum in this PR: stress tests + performance harness
- deeper type-level refactor: either late in this PR or immediate follow-up, with benchmarks as guardrails

## Esbuild + Module Resolution Review

### Question asked

Can we simplify architecture by moving from esbuild `build()` to `transform()`, while still getting robust module resolution (tsconfig paths, package `imports`/`exports`, etc.)?

## Current architecture (what exists today)

### Resolution path

- `packages/assets/src/lib/resolve.ts` resolves imports by running a synthetic esbuild build:
  - creates `stdin` with virtual imports
  - uses `bundle: true` + `metafile: true`
  - uses an `empty-loader` plugin so contents are never actually loaded
  - reads `metafile.inputs['<stdin>'].imports[*].path` as resolved absolute paths

This is the “virtual module” pattern you called out.

### Transform path

- `packages/assets/src/lib/transform.ts` and `packages/assets/src/lib/dev-handler.ts` both use `esbuild.build()` with:
  - `entryPoints: [filePath]`
  - `bundle: true`
  - `external: ['*']`
  - `write: false`
- Imports are then rewritten separately in `packages/assets/src/lib/rewrite.ts`.

So there are effectively two esbuild-build-based flows:

- one for transpilation
- one for resolution

## What I validated with experiments

I ran temporary experiments in isolated temp dirs to verify behavior.

### 1) `transform()` does not do module resolution

- `esbuild.transform()` keeps import specifiers as-is (e.g. `@app/foo` stays `@app/foo`)
- no `metafile`, no resolved-path output

### 2) `transform()` does not accept `tsconfig` path

- Passing `tsconfig` to `transform()` errors as invalid option
- It only supports `tsconfigRaw` (manual config object), not file lookup/discovery

### 3) Current `resolve.ts` pattern _does_ resolve the hard stuff

The `stdin + bundle + metafile + empty-loader` pattern successfully resolved:

- tsconfig `compilerOptions.paths`
- package.json `exports`
- package.json `imports` (`#alias`)

This confirms you are currently getting the important resolution semantics “for free” from esbuild build API.

### 4) Useful middle ground exists: `build.resolve`

esbuild plugin API provides `build.resolve(...)`, and in experiments it also resolved:

- tsconfig paths
- package imports/exports
- node_modules targets

So we can simplify resolver architecture without writing our own resolver stack.

## Key implication: “transform-only” is not enough

If the goal is:

- robust import resolution
- tsconfig path handling
- package imports/exports handling

then `transform()` alone cannot provide that.

To go transform-only, we would need to own a large resolver surface ourselves (or add another resolver stack), including:

- tsconfig discovery/extends/paths/baseUrl behavior
- package `imports`/`exports` condition matching
- Node/ESM resolution nuances and extension probing

That is a lot of complexity/risk relative to what esbuild currently gives us.

## Recommendation

### Recommended direction (pragmatic simplification)

Do **not** move to pure `transform()` right now.

Instead, simplify in two controlled steps:

1. Replace virtual-stdin/metafile resolver flow with a dedicated resolver built on `build.resolve(...)`
   - removes synthetic module generation and metafile parsing
   - keeps esbuild’s resolution semantics
2. Keep transpilation on `build()` for now
   - avoids losing implicit tsconfig file behavior
   - avoids introducing custom tsconfig loading/parsing complexity

This would materially reduce “overcooked” architecture while preserving correctness.

### Optional future step (if desired later)

Consider moving transpilation to `transform()` **only after** deciding how to own tsconfig lookup behavior:

- either explicit `tsconfigRaw` plumbing and documented constraints
- or separate local tsconfig loader that reproduces desired semantics

Without that, moving transpilation to `transform()` risks subtle behavior regressions.

## Concrete options

### Option A (best near-term): hybrid, esbuild-backed resolver

- Resolver: `build.resolve`
- Transpile: keep `build()`
- Pros: simpler internals, minimal behavior risk
- Cons: still uses build API for transpile

### Option B: transform + custom resolver stack

- Resolver: custom (or third-party) implementation
- Transpile: `transform()`
- Pros: least esbuild build usage
- Cons: highest complexity/risk; recreates a lot of esbuild behavior

### Option C: status quo

- Lowest immediate risk, but keeps existing architectural complexity.

## Suggested next move

If we proceed, I’d recommend an incremental RFC/PR that first swaps only the resolver internals (`resolve.ts`) to `build.resolve`, with parity tests proving no behavior regression on:

- tsconfig paths
- package imports/exports
- workspace path conversion (`/__@workspace/`)
- external specifier handling

Then evaluate whether transpile-path simplification is still worth it.
