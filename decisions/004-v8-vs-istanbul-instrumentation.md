# V8-native coverage vs. Istanbul instrumentation

`@remix-run/test` collects coverage by recording V8's native runtime data
(`Profiler.takePreciseCoverage` server-side, Playwright's `page.coverage`
browser-side) and translating it to Istanbul format via `v8-to-istanbul`. The
alternative — instrumenting the served JavaScript at transform time with
Istanbul-style counters — is a real option with different tradeoffs. This
document records why we chose the V8-native path and when we'd revisit.

## What "Istanbul-instrumented" would look like

Use `istanbul-lib-instrument` (the library that backs nyc, Jest, Vitest) to
rewrite each compiled `.js` so every statement, branch, and function increments
a counter in a global `__coverage__` object. After the run, read that object
and emit it directly as Istanbul coverage — no V8 protocol, no byte offsets,
no source-map translation for coverage purposes (source maps still matter for
stack traces, but they're not load-bearing).

The pipeline becomes:

```
.ts → transformTypeScript (esbuild) → istanbul-lib-instrument → served JS
                                                              → executed
                                                              → reads __coverage__
                                                              → emit Istanbul
```

## What gets simpler

- **Source-map quality stops being load-bearing for coverage.** The
  oxc-drops-closing-brace-mappings failure mode (see [decision 003][003])
  becomes irrelevant. If we ever wanted to use `@remix-run/assets` again, the
  source-map blocker is gone.
- **No deterministic-transform discipline.** The bytes V8 sees no longer have
  to match what the collector re-derives, because the collector reads counters
  from a global instead of walking byte offsets. `addV8EntryToCoverageMap`,
  the coverage loader hook, the `NODE_V8_COVERAGE` plumbing — all gone.
- **Identical coverage across runtimes.** Same instrumented JS produces the
  same Istanbul output in Node, Bun, Chromium, Firefox, WebKit. The
  Chromium-only restriction on browser tests goes away.

## What gets harder

- **Runtime overhead.** Every statement is now a counter increment. Real-world
  test suites typically run 20-50% slower under instrumentation. Tight loops
  pay more. This compounds — every PR through CI pays it forever.
- **Bigger served code.** Instrumented JS is roughly 1.5-2× the size.
- **New dep + heavier transform pipeline.** `istanbul-lib-instrument` pulls in
  `@babel/parser`, etc. The transform goes from a single esbuild call to
  esbuild followed by a babel-style AST walk and re-emit per request.
- **Iframe lifecycle is still tricky, just differently.** `__coverage__` lives
  on the iframe's `window`. The current "keep iframes alive" workaround would
  shift to "drain `iframe.contentWindow.__coverage__` to the parent before
  destroying the iframe."
- **Different coverage numbers.** V8 native counts branches based on actual
  short-circuit evaluation; structural instrumentation counts based on AST
  shape. Both are valid but the numbers won't match byte-for-byte. Anyone
  comparing historical reports across the switch would see drift.

## The asset-server question

A natural follow-on: if Istanbul instrumentation removes the source-map
constraint, can `@remix-run/test` go back to using `@remix-run/assets` for the
harness server?

Yes, mechanically. The asset-server still doesn't instrument on its own, so
we'd need to wrap its output: in our route handler, pipe the asset-server's
emitted JS through `istanbul-lib-instrument` before responding. ~20 lines of
glue. Or push a "transform plugin" concept upstream into `@remix-run/assets`
itself.

Either way, "use the asset-server" trades one piece of glue (current esbuild
transform + import rewriting) for another (asset-server + post-instrument).
Not really a simplification of the harness; it just relocates where the work
lives.

## Why we're staying on V8-native

- **It works and is validated.** The three-way parity test
  ([`coverage-parity.test.ts`](../packages/test/src/test/coverage-parity.test.ts))
  asserts the server, browser, and e2e runners produce byte-identical Istanbul
  records for the same fixture. Drift fails CI loudly.
- **No runtime cost.** Tests run at full speed. For a test runner this matters
  more than for a one-shot coverage tool.
- **The discipline is small and one-time.** [Decision 003][003] documents
  exactly what to do (and not do). The transform owner is `transformTypeScript`,
  the parity test is the contract.
- **Migrating later is straightforward if we need to.** Nothing about the
  V8-native path leaks into public API. Switching is mostly a `lib/coverage.ts`
  rewrite plus the harness post-instrument step.

## When to revisit

Revisit Istanbul instrumentation if any of these things become true:

1. **We need Firefox or WebKit coverage support.** V8 native is Chromium-only
   in browsers (and Node's V8); the other engines don't expose the same
   protocol.
2. **We want to support arbitrary user-supplied transformers.** If users start
   plugging in oxc, swc, or their own pipelines, maintaining the
   "deterministic transform that produces the same bytes coverage saw" rule
   across all of them is more brittle than just instrumenting whatever JS they
   end up emitting.
3. **The runtime cost of V8 coverage stops being "essentially free."** This
   would be surprising — V8's coverage is built into the engine — but if the
   protocol overhead grows or our test files grow in a way that makes
   collection expensive, the gap to instrumentation narrows.

Until then, V8-native is the right default.

[003]: ./003-coverage-transform-determinism.md
