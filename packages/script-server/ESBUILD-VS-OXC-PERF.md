# `script-server` esbuild vs. Oxc performance

## TL;DR

- command shape: `pnpm bench -- <benchmark-id> 30 --warmup=5`

| Benchmark                                     | `esbuild` transform + minify + resolver | Oxc transform + minify + resolver | Relative speedup |
| --------------------------------------------- | --------------------------------------- | --------------------------------- | ---------------- |
| basic fixture / cold entry (minified)         | 15.92 ms ± 7.57                         | 3.03 ms ± 1.05                    | 5.25x faster     |
| deep-graph fixture / cold preloads (minified) | 130.34 ms ± 13.77                       | 28.10 ms ± 9.94                   | 4.64x faster     |

The two benchmarks used throughout this report are:

- `basic fixture / cold entry (minified)`: a small first-hit compile of one entry module with `2` app modules, `2` bench-package modules, `4` direct imports, and a mix of `relative`, `#imports`, `tsconfig`, and bare-package resolution.
- `deep-graph fixture / cold preloads (minified)`: a larger graph traversal with `59` app modules, `11` bench-package modules, `18` feature slices, and imports that also cross into the workspace `component` package.

The main takeaways are:

- The resolver is still the biggest single contributor by a large margin.
- Transform alone is a small win on the small fixture and slightly regressive on the deep graph.
- In the normalized early-minify pipeline, the minifier now compounds meaningfully once resolver overhead is gone, especially on the deep graph.
- Oxc remains a better fit for `script-server` because the server needs distinct transform, resolve, minify, and optional AST-analysis steps rather than just one opaque transform API.

## What This Measures

This document compares the `esbuild`-based `script-server` compiler pipeline against the Oxc-based pipeline after the pipeline refactor.

The benchmark runner now swaps only the phases that still make architectural sense:

- whole-pipeline selection: `--engine=esbuild|oxc`
- per-stage override: `--transform=esbuild|oxc-transform`
- per-stage override: `--resolver=esbuild|oxc-resolver`
- per-stage override: `--minify-engine=esbuild|oxc-minify`

For the Oxc branches, the Oxc transform, resolver, and minifier use the async APIs so the comparison reflects server behavior rather than build-tool-oriented synchronous calls.

## Why Oxc Fits `script-server`

`script-server` needs more than a source-to-source transform.

On the cold path it needs to:

- transform TS/JSX
- optionally minify early so dead branches are exposed before later analysis
- optionally do AST-driven pruning work
- extract static and dynamic imports
- resolve those imports to concrete files
- rewrite import specifiers to served URLs
- maintain sourcemaps across those rewrites

After this refactor, the default benchmarked path uses `es-module-lexer` for import metadata, while the optional AST-heavy path parses once with Oxc and reuses that parse result for pruning and import/export metadata.

Oxc is still a better architectural fit for this server because:

- `script-server` needs a dedicated resolver, and `esbuild` still requires a build-API workaround for that
- transform, resolver, and minifier are available as distinct APIs
- the optional AST-driven pruning path now maps directly onto the Oxc parser instead of forcing a second conceptual toolchain
- CommonJS detection now also uses Oxc, whereas the earlier implementation used SWC for that parsing step

## Benchmark Setup

- End-to-end rerun command: `pnpm bench -- <benchmark-id> 30 --warmup=5`
- Package: `packages/script-server`
- Platform: `Darwin 25.3.0`
- Node: `v24.14.0`

Example command shapes used for this refresh:

- all-`esbuild` baseline: `pnpm bench -- deep-graph-cold-preloads-minified 30 --warmup=5 --engine=esbuild`
- Oxc transform/minify/resolver: `pnpm bench -- deep-graph-cold-preloads-minified 30 --warmup=5 --engine=oxc`
- swap only resolver to Oxc: `pnpm bench -- deep-graph-cold-preloads-minified 30 --warmup=5 --engine=esbuild --resolver=oxc-resolver`
- swap only transform to Oxc: `pnpm bench -- deep-graph-cold-preloads-minified 30 --warmup=5 --engine=esbuild --transform=oxc-transform`
- swap only minifier to Oxc: `pnpm bench -- deep-graph-cold-preloads-minified 30 --warmup=5 --engine=esbuild --minify-engine=oxc-minify`

## End-To-End Result

This is the production-relevant comparison for the current default pipeline:

- `esbuild` pipeline: `esbuild` transform + `esbuild` resolver + `esbuild` minify + `es-module-lexer`
- Oxc pipeline: async Oxc transform + async Oxc resolver + async Oxc minify + `es-module-lexer`

| Benchmark                                     | `esbuild` transform + minify + resolver | Oxc transform + minify + resolver | Relative speedup |
| --------------------------------------------- | --------------------------------------- | --------------------------------- | ---------------- |
| basic fixture / cold entry (minified)         | 15.92 ms ± 7.57                         | 3.03 ms ± 1.05                    | 5.25x faster     |
| deep-graph fixture / cold preloads (minified) | 130.34 ms ± 13.77                       | 28.10 ms ± 9.94                   | 4.64x faster     |

If the question is "what is the current production-relevant cold-path win from the `esbuild` pipeline to the Oxc pipeline?", these are the numbers to use.

## Baseline: `esbuild`

This is the all-`esbuild` baseline:

- transform: `esbuild`
- resolver: `esbuild`
- minify: `esbuild`
- import metadata: `es-module-lexer`

| Benchmark                                     | Result            |
| --------------------------------------------- | ----------------- |
| basic fixture / cold entry (minified)         | 15.92 ms ± 7.57   |
| deep-graph fixture / cold preloads (minified) | 130.34 ms ± 13.77 |

## Swap Only Transform To Oxc

This keeps the `esbuild` resolver and minifier, and only swaps transform to the async Oxc transform API.

| Benchmark                                     | Result            | Vs. `esbuild` baseline |
| --------------------------------------------- | ----------------- | ---------------------- |
| basic fixture / cold entry (minified)         | 12.66 ms ± 1.09   | 1.26x faster           |
| deep-graph fixture / cold preloads (minified) | 133.03 ms ± 21.09 | 1.02x slower           |

## Swap Only Resolver To Oxc

This keeps the `esbuild` transform and minifier, and only swaps resolution to the async Oxc resolver API.

| Benchmark                                     | Result          | Vs. `esbuild` baseline |
| --------------------------------------------- | --------------- | ---------------------- |
| basic fixture / cold entry (minified)         | 4.22 ms ± 0.36  | 3.77x faster           |
| deep-graph fixture / cold preloads (minified) | 47.71 ms ± 1.57 | 2.73x faster           |

## Swap Only Minifier To Oxc

This keeps the `esbuild` transform and resolver, and only swaps minification to the async Oxc minifier API.

| Benchmark                                     | Result            | Vs. `esbuild` baseline |
| --------------------------------------------- | ----------------- | ---------------------- |
| basic fixture / cold entry (minified)         | 12.22 ms ± 0.66   | 1.30x faster           |
| deep-graph fixture / cold preloads (minified) | 131.21 ms ± 15.24 | 1.01x slower           |

## How The Wins Compound

The single-stage swaps explain directionally where the gains come from, but the more useful question is how those wins behave together in the normalized pipeline.

### Add Oxc Stages On Top Of The Resolver Win

| Configuration                       | Basic Cold (Minified) | Vs. `esbuild` baseline | Deep Cold Preloads (Minified) | Vs. `esbuild` baseline |
| ----------------------------------- | --------------------- | ---------------------- | ----------------------------- | ---------------------- |
| resolver only                       | 4.22 ms ± 0.36        | 3.77x faster           | 47.71 ms ± 1.57               | 2.73x faster           |
| resolver + transform                | 4.13 ms ± 0.35        | 3.85x faster           | 46.10 ms ± 1.76               | 2.83x faster           |
| Oxc transform + resolver + minifier | 3.03 ms ± 1.05        | 5.25x faster           | 28.10 ms ± 9.94               | 4.64x faster           |

What this suggests:

- Resolver still unlocks most of the gain on its own.
- Transform helps a little once resolver cost is gone, but not by much.
- The normalized early-minify path now makes the Oxc minifier a meaningful part of the final win, especially on the deep graph.

### Remove One Oxc Stage From The Oxc Engine Defaults

This starts from the Oxc transform/minify/resolver configuration and swaps one phase back to `esbuild`.

| Configuration                       | Basic Cold (Minified) | Vs. `esbuild` baseline | Deep Cold Preloads (Minified) | Vs. `esbuild` baseline |
| ----------------------------------- | --------------------- | ---------------------- | ----------------------------- | ---------------------- |
| Oxc transform + resolver + minifier | 3.03 ms ± 1.05        | 5.25x faster           | 28.10 ms ± 9.94               | 4.64x faster           |
| all Oxc except resolver             | 12.09 ms ± 1.28       | 1.32x faster           | 121.55 ms ± 15.25             | 1.07x faster           |
| all Oxc except transform            | 4.22 ms ± 0.34        | 3.77x faster           | 50.90 ms ± 12.48              | 2.56x faster           |
| all Oxc except minifier             | 4.22 ms ± 0.33        | 3.77x faster           | 50.18 ms ± 10.33              | 2.60x faster           |

What this suggests:

- Swapping only the resolver back to `esbuild` removes most of the win.
- Transform and minifier both matter in the final Oxc configuration, and on the deep graph they contribute at a similar scale once resolver cost is already low.
- The current Oxc result is not just a resolver story. It is still mostly a resolver story, but the other stages now compound more clearly than they did in the earlier report.

## Takeaways

If the question is "should `script-server` prefer the Oxc-based pipeline over the `esbuild`-based pipeline?", the refreshed minified cold benchmarks still point clearly in that direction.

The most important conclusions from this updated matrix are:

- Oxc still wins clearly end-to-end on the cold path.
- The resolver is still the largest single reason.
- Transform is not a headline standalone win on its own.
- In the normalized early-minify pipeline, minifier choice matters more than it did in the earlier measurements.
- `removeUnusedImports` is now intentionally an opt-in path with its own cost profile, so it should not be mixed into the default-pipeline benchmark numbers.
