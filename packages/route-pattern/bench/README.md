# Benchmarks

## Run benchmarks

```bash
# All benchmarks
pnpm bench

# Specific benchmark
pnpm bench comparison
```

## Compare performance across branches

```bash
# On main branch - save baseline with git context in filename
pnpm bench -- --outputFile=baseline-main-$(git rev-parse --short HEAD).json

# Switch to your branch
git checkout my-feature

# Compare
pnpm bench -- --compare=baseline-main-*.json
```

Or compare specific benchmarks:

```bash
pnpm bench run comparison -- --compare=baseline-main-*.json
```
