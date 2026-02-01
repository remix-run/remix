# Benchmarks

## Run benchmarks

```bash
# All benchmarks
pnpm bench

# Specific benchmark
pnpm bench comparison.bench.json # full name
pnpm bench comparison            # pattern match
```

## Compare performance across branches

```bash
git checkout main
pnpm bench comparison.bench.ts --outputJson=main.json

git checkout feature-branch
pnpm bench comparison.bench.ts --compare=main.json
```
