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

## Latest Evidence

These results were recorded on June 18, 2026 from the `mjackson/route-pattern-docs-validation` working tree based on commit `03a2f1579`.

- Machine: Apple M5 Pro
- OS: macOS 26.3.2 (25D2150)
- Node: v24.15.0
- pnpm: 10.34.2
- Vitest: 4.1.6

Commands:

```sh
pnpm --dir packages/route-pattern/bench bench src/match/common.bench.ts
pnpm --dir packages/route-pattern/bench bench src/match/shopify.bench.ts
pnpm --dir packages/route-pattern/bench bench src/match/pathological.bench.ts
pnpm --dir packages/route-pattern/bench bench src/href.bench.ts
```

### Match Benchmarks

| Benchmark    | Patterns | URLs | Mode   | Matcher       |       Mean |       RME | Samples |
| ------------ | -------: | ---: | ------ | ------------- | ---------: | --------: | ------: |
| Common       |       10 |  160 | server | route-pattern |  0.0005 ms |  +/-0.29% | 976,864 |
| Common       |       10 |  160 | lambda | route-pattern |  0.0416 ms | +/-12.19% |  12,013 |
| Common       |      100 |  160 | server | route-pattern |  0.0005 ms |  +/-0.31% | 914,153 |
| Common       |      100 |  160 | lambda | route-pattern |  0.3893 ms | +/-22.66% |   1,285 |
| Common       |    1,000 |  160 | server | route-pattern |  0.0006 ms |  +/-0.38% | 906,516 |
| Common       |    1,000 |  160 | lambda | route-pattern |  4.0664 ms | +/-20.86% |     123 |
| Common       |    5,000 |  160 | server | route-pattern |  0.0006 ms |  +/-3.63% | 874,243 |
| Common       |    5,000 |  160 | lambda | route-pattern | 19.7840 ms | +/-18.53% |      28 |
| Shopify      |    2,506 |   29 | server | route-pattern |  0.0010 ms |  +/-0.25% | 509,489 |
| Shopify      |    2,506 |   29 | lambda | route-pattern |  9.8376 ms | +/-10.38% |      51 |
| Pathological |    1,509 |   46 | server | route-pattern |  0.0306 ms |  +/-0.68% |  16,320 |
| Pathological |    1,509 |   46 | lambda | route-pattern |  6.6835 ms |  +/-9.52% |      76 |

The `common` benchmark is limited to patterns all adapters can represent. In that benchmark, `find-my-way` is fastest for hot matching and `path-to-regexp` is fastest for cold construction plus one match. `route-pattern` stays nearly flat in hot matching from 10 through 5,000 patterns because matching uses the trie, while cold construction scales with pattern count.

The `shopify` benchmark uses 2,506 production-like pathname patterns. In hot matching, `route-pattern` averaged 0.0010 ms per operation, about 59x faster than `path-to-regexp` and about 1,122x faster than the route-pattern array matcher. In cold construction plus one match, `path-to-regexp` was about 2.06x faster than `route-pattern`.

The `pathological` benchmark uses route-pattern-only features such as hostnames, protocols, ports, search constraints, optionals, and wildcards, so it compares the trie matcher against the array matcher. The trie matcher was about 18.93x faster for hot matching and about 1.31x faster for cold construction plus one match.

### Href Benchmarks

All href benchmarks use parsed `RoutePattern` instances, so they measure href generation without parsing.

| Case                     |      Mean |      RME |   Samples |
| ------------------------ | --------: | -------: | --------: |
| Static                   | 0.0001 ms | +/-0.55% | 8,275,198 |
| One variable             | 0.0001 ms | +/-0.16% | 5,546,912 |
| One wildcard             | 0.0002 ms | +/-0.03% | 2,908,522 |
| Multiple variables       | 0.0001 ms | +/-0.08% | 3,528,344 |
| Optional, all params     | 0.0001 ms | +/-1.39% | 4,394,848 |
| Optional, omitted params | 0.0001 ms | +/-0.21% | 6,730,403 |
| Complex, all params      | 0.0005 ms | +/-0.30% | 1,023,015 |
| Complex, no optionals    | 0.0003 ms | +/-0.20% | 1,469,827 |
| With search params       | 0.0004 ms | +/-0.22% | 1,286,260 |

## Type Benchmarks

Type benchmarks are in [src/types/](./src/types/) and use [ArkType Attest](https://github.com/arktypeio/arktype/blob/main/ark/attest/README.md).

```sh
# Run all enabled type benchmarks
pnpm bench:types

# Run one type benchmark directly with Node
node src/types/href.ts
```
