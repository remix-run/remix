# Why `remix-test` owns its TypeScript transform for coverage

`@remix-run/test` does TypeScript→JavaScript transforms in two places that look,
on the surface, like they could each pick whatever transformer is convenient:

1. **Load time** — Node's loader hook (server tests via `coverage-loader.ts`)
   and the harness server (browser tests via `app/server.tsx`) compile `.ts` to
   `.js` before V8 executes it.
2. **Collection time** — `lib/coverage.ts`'s `addV8EntryToCoverageMap` runs the
   same transform again to re-derive the JS that V8 instrumented.

Both call sites must use the **same deterministic transform with the same
options**. That's what `lib/ts-transform.ts`'s `transformTypeScript` is for.
This document exists so a future change doesn't accidentally swap one of those
call sites for a different transformer (e.g. oxc, swc, tsx's built-in) and
silently break coverage accuracy.

## V8 records byte offsets, not source lines

V8's coverage protocol (`Profiler.takePreciseCoverage`) emits ranges like:

```
{ startOffset: 1024, endOffset: 1456, count: 0 }
```

Those numbers are byte indices into the JavaScript string V8 actually executed.
V8 doesn't know about TypeScript, source maps, or original files — it sees JS
bytes and records offsets within them.

Istanbul, the coverage report format, tracks coverage by **line/column ranges
in the original source**:

```
src/foo.ts: lines 15-17 uncovered
```

`v8-to-istanbul` is the bridge. For each V8 range it has to:

1. Walk the byte offsets in the executed JS to find the corresponding
   line/column in that JS.
2. Use a source map to translate those JS positions back to original-source
   positions.

To do step 1, it needs **the exact JS bytes V8 saw**. Off-by-one or
formatting-different bytes means walking to the wrong line.

## The server-side problem: the executed JS is gone

Server-test flow:

1. The worker boots and registers `coverage-loader.ts` as Node's ESM loader
   hook.
2. The test file is imported. The hook calls `transformTypeScript(source,
   filePath)` and returns the resulting JS to Node.
3. V8 executes that JS. It records coverage as byte offsets in **that exact
   string**.
4. The worker exits. V8 dumps the coverage data to the directory in
   `NODE_V8_COVERAGE`.
5. The transformed JS string was never written to disk and is no longer in
   memory anywhere.

When `addV8EntryToCoverageMap` later tries to convert one of those V8 entries,
it has the byte offsets but not the bytes. So it re-runs `transformTypeScript`
on the original `.ts` file. If that transform is deterministic, the
re-derivation is byte-identical to what V8 instrumented, and the offsets line
up.

If load time and collection time used different transformers, or the same
transformer with different options, or even just different versions, the
offsets would point at wrong characters in the re-derived JS, the source map
lookup would be wrong, and the resulting Istanbul coverage would be garbage.

## The browser-side problem: same shape, different mechanics

Browser-test flow:

1. The harness server compiles each `.ts`/`.tsx` request through
   `transformTypeScript` and serves the JS.
2. The browser executes it. V8 records byte offsets.
3. Playwright's `page.coverage.stopJSCoverage()` returns the V8 entries plus
   `entry.source` — the JS V8 saw.
4. `addV8EntryToCoverageMap` re-runs `transformTypeScript` on the original
   `.ts` and feeds it to `v8-to-istanbul`.

The browser path doesn't have the "JS is gone" problem — Playwright preserved
it — but we still go through the same shared collector, and the only way that
works is if the harness's served bytes match what `transformTypeScript`
produces. Which they do, because the harness *is* `transformTypeScript`.

## Why this matters concretely

The first attempt at browser coverage went through `@remix-run/assets`, which
uses `oxc-transform` instead of esbuild. That broke for two independent
reasons:

1. **Different bytes.** oxc and esbuild produce structurally different JS
   (different formatting, different statement layouts, different newline
   handling). The V8 offsets V8 recorded against oxc-transformed bytes did not
   line up with the esbuild re-derivation in the collector. v8-to-istanbul
   walked to the wrong characters and emitted nonsense.
2. **Source-map gaps.** oxc-transform's source maps omit mappings for lines
   that contain only a closing `}`. v8-to-istanbul's `originalEndPositionFor`
   returns null on those lines and silently drops the V8 range. The fixture's
   `uncalledFunction` (0% covered) reported as 100% covered.

Switching the harness to `transformTypeScript` solved both issues at once: the
bytes match across both call sites, and esbuild's source maps cover every
line.

## The rule, stated bluntly

- **One transform function**: `lib/ts-transform.ts`'s `transformTypeScript`.
  Both load-time and collection-time call sites import from there.
- **Deterministic**: same input + same options → same output bytes, every
  time. esbuild meets this; the version is pinned in the package's deps.
- **Inline source maps with `sourcesContent`**: so v8-to-istanbul can
  translate without external file I/O.
- **No call site picks its own transformer.** Want to change the transformer?
  Change `transformTypeScript` and validate against the coverage fixture's
  three-way parity test (`src/test/coverage-parity.test.ts`). If the
  percentages or uncovered-line lists move, something is wrong and the change
  is unsafe.
