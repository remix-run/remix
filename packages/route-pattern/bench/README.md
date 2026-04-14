# Benchmarks

## Runtime benchmarks

Runtime benchmarks are in [src/](./src/) and use `.bench.ts` suffix.

```sh
# All benchmarks
pnpm bench

# Specific benchmark
pnpm bench src/match/shopify.bench.ts # full name
pnpm bench shopify                    # pattern match
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

Type benchmarks are in [src/types/](./src/types/) and use [ArkType Attest](https://github.com/arktypeio/arktype/blob/main/ark/attest/README.md).

```sh
# Run type benchmarks directly with Node
node src/types/href.ts
```
