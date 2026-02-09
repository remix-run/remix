# Benchmarks

## Runtime benchmarks

Runtime benchmarks are in [src/](./src/) and use [Vitest benchmarking](https://vitest.dev/guide/features.html#benchmarking).

```sh
# All benchmarks
pnpm bench

# Specific benchmark
pnpm bench comparison.bench.json # full name
pnpm bench comparison            # pattern match
```

### Compare performance across branches

```bash
git checkout main
pnpm bench comparison.bench.ts --outputJson=main.json

git checkout feature-branch
pnpm bench comparison.bench.ts --compare=main.json
```

## Type benchmarks

Type benchmarks are in [types/](./types/) and use [ArkType Attest](https://github.com/arktypeio/arktype/blob/main/ark/attest/README.md).

```sh
# Run type benchmarks directly with Node
node types/href.ts
```
