# Component Benchmarks

This package contains the browser benchmarks for `@remix-run/component`.

## What it measures

The benchmark runner serves the benchmark apps in `frameworks/`, drives them with Playwright, and measures click-task plus next-paint timings inside the page while also supporting Chrome profiler capture.

Current operations include:

- table creation, append, update, clear, replace
- keyed row selection, removal, swap, and sort
- dashboard mount, unmount, and resort flows

## Quick start

```sh
pnpm --dir packages/component/bench run build-frameworks
pnpm --dir packages/component/bench run bench:remix
```

## Baseline workflow

Use the baseline wrapper when you want a durable before/after comparison for renderer work.

Capture a baseline from the current renderer:

```sh
pnpm --dir packages/component/bench run baseline -- --label current-renderer
```

Compare a later rewrite against that saved run:

```sh
pnpm --dir packages/component/bench run baseline -- \
  --label renderer-rewrite \
  --baseline results/<baseline-file>.json
```

The wrapper:

- rebuilds all benchmark apps
- runs the Remix benchmark in headless Chromium
- uses standard settings: `--cpu 4 --warmups 5 --runs 20`
- writes a named JSON result file into `packages/component/bench/results/`

For tighter investigation, you can narrow the run:

```sh
pnpm --dir packages/component/bench run baseline -- \
  --label keyed-ops \
  --benchmark swapRows \
  --benchmark sortAsc \
  --benchmark sortDesc
```

## Reading the results

Each saved JSON file includes:

- label
- timestamp
- git branch and commit
- benchmark settings
- per-operation scripting and total timing stats

When `--baseline <file>` is provided, the runner also prints a per-operation delta table for total and scripting medians.

## Benchmark discipline

For meaningful renderer comparisons:

- run the baseline and the candidate on the same machine
- use the same browser version
- keep power mode and thermal conditions stable
- avoid other heavy work while the benchmark is running
- compare like-for-like benchmark filters and run counts
