# Benchmarks

The route-pattern benchmarks live in [src/](./src/) and use Vitest's `.bench.ts` runner. Match benchmarks cover two modes:

- `server`: build each matcher once, then repeatedly match URLs. This measures hot matching.
- `lambda`: build each matcher inside the benchmark body, then match one URL. This measures cold construction plus one match.

Match benchmarks verify correctness before timing. Every adapter must agree on match/no-match. Adapters that expose route-pattern's full match surface also verify the selected pattern, params, attached data, and `matchAll()` ranking. `matchAll()` verification dedupes repeated optional variants that come from the same inserted pattern.

## Runtime Benchmarks

```sh
# All runtime benchmarks
pnpm bench

# Specific benchmark
pnpm bench src/match/shopify.bench.ts # full name
pnpm bench shopify                    # pattern match
pnpm bench growth                     # optional, wildcard, and matchAll growth

# Retained matcher heap across increasing optional counts
pnpm bench:memory
```

### Compare Performance Across Branches

```sh
# Create baseline against another branch, such as main
git checkout main
pnpm bench --outputJson=main.json

# Compare branch against baseline
git checkout feature-branch
pnpm bench --compare=main.json
```

## Latest Results

Match results comparing `route-pattern` with `find-my-way`, `path-to-regexp`, and built-in `URLPattern` are published in the [package README](https://github.com/remix-run/remix/tree/main/packages/route-pattern#benchmarks). Regenerate them with `pnpm update-readme`. Once `URLPatternList` lands in common JavaScript runtimes, we plan to include it alongside `URLPattern`.

The results below were recorded on November 25, 2026 at commit `8a8adc7b70` on an Apple M5 Pro running macOS 26.7.3 and Node.js v24.18.0, with Vitest 4.1.6.

### Bounded matcher acceptance gates

The thresholds allow normal benchmark variance while rejecting exponential construction or backtracking growth.

| Gate                                               | Acceptance threshold |  Observed |
| -------------------------------------------------- | -------------------: | --------: |
| 5,000 common patterns, hot match                   |         <= 0.0200 ms | 0.0002 ms |
| 5,000 common patterns, construction + match        |           <= 25.0 ms |   2.34 ms |
| Optional construction, 8 to 64 groups              |        <= 12x growth |      6.7x |
| Optional match, 8 to 64 groups                     |        <= 80x growth |      5.2x |
| Wildcard near miss, 2 to 32 wildcards              |       <= 300x growth |      2.8x |
| `matchAll()`, 10 to 1,000 equal patterns           |       <= 125x growth |     79.6x |
| Retained heap, 250 patterns with 8 to 64 optionals |        <= 12x growth |      5.4x |

Optional construction and retained heap grow with compiled pattern size. Optional and wildcard matching may grow with both input length and reachable states, but do not show the exponential curves produced by variant expansion or regex backtracking.

Commands:

```sh
pnpm bench src/match/common.bench.ts
pnpm bench growth
pnpm bench:memory
```

### Href Benchmarks

All href benchmarks use parsed `RoutePattern` instances, so they measure href generation without parsing.

| Case                     |      Mean |      RME |   Samples |
| ------------------------ | --------: | -------: | --------: |
| Static                   | 0.0001 ms | +/-0.99% | 7,170,140 |
| One variable             | 0.0001 ms | +/-0.16% | 3,795,291 |
| One wildcard             | 0.0002 ms | +/-0.14% | 2,649,589 |
| Multiple variables       | 0.0002 ms | +/-0.06% | 2,265,483 |
| Optional, all params     | 0.0001 ms | +/-0.14% | 3,423,297 |
| Optional, omitted params | 0.0001 ms | +/-0.20% | 4,703,779 |
| Complex, all params      | 0.0007 ms | +/-0.47% |   683,975 |
| Complex, no optionals    | 0.0004 ms | +/-2.67% | 1,145,498 |
| With search params       | 0.0004 ms | +/-0.28% | 1,270,165 |

## Type Benchmarks

Type benchmarks are in [src/types/](./src/types/) and use [ArkType Attest](https://github.com/arktypeio/arktype/blob/main/ark/attest/README.md).

```sh
# Run all enabled type benchmarks
pnpm bench:types

# Run one type benchmark directly with Node
node src/types/href.ts
```
