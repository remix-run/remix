# Benchmarks

## Type benchmarks

Type benchmarks for `typed-glob` live in [types/](./types/) and use [ArkType Attest](https://github.com/arktypeio/arktype/blob/main/ark/attest/README.md).

```sh
# from packages/assets/bench
pnpm bench:types
```

Or from the repo root:

```sh
pnpm --dir packages/assets/bench bench:types
```

### How to read results

Each benchmark has a baseline budget via:

```ts
bench('name', () => {
  // ...
}).types([N, 'instantiations'])
```

Attest prints:

- current instantiations (`Result`)
- budget (`Baseline`)
- delta vs baseline (`Delta`)

### Usage guidance

- Type perf benchmarks are currently a **manual** check (not CI-enforced).
- Run these when changing `typed-glob` matcher logic or type-level parsing.
- If you intentionally change a baseline, update the `.types([...])` value in the corresponding benchmark with a short note in your PR description.
