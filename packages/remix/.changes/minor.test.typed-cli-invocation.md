BREAKING CHANGE: Run tests with `remix test` instead of the removed `remix-test` executable, and move settings from `remix-test.config.ts` or `.js` into the `test` property of `remix.json`:

```diff
- remix-test --type server --concurrency 1
+ remix test --type server --concurrency 1
```

```jsonc
{
  "$schema": "https://remix.run/schemas/remix.json",
  "test": {
    "type": ["server"],
    "concurrency": 1,
    "quiet": true,
  },
}
```

The programmatic `runRemixTest()` API from `remix/test/cli` now accepts typed runner options instead of raw command-line arguments. The test runner also adds `--only` for matching suite or test names, `--quiet` for omitting skipped tests, and defaults `NODE_ENV` to `test` when it is not already set (see #11623, #11628).
