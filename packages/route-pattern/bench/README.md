# Benchmarks

## Runtime benchmarks

Runtime benchmarks are in [src/](./src/) and use [Vitest benchmarking](https://vitest.dev/guide/features.html#benchmarking).

```sh
# All benchmarks
pnpm bench

# Specific benchmark
pnpm bench src/shopify.bench.json # full name
pnpm bench shopify                # pattern match
```

### Compare performance across branches

```bash
# Create baseline against another branch (e.g. `main`)
git checkout main
pnpm bench --outputJson=main.json

# Compare branch against baseline
git checkout feature-branch
pnpm bench --compare=main.json
```

## Type benchmarks

Type benchmarks are in [types/](./types/) and use [ArkType Attest](https://github.com/arktypeio/arktype/blob/main/ark/attest/README.md).

```sh
# Run type benchmarks directly with Node
node types/href.ts
```
