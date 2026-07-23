BREAKING CHANGE: Removed the standalone `remix-test` executable. Use `remix test` for command-line test runs. `runRemixTest()` from `@remix-run/test/cli` now accepts typed runner options such as `type`, `glob`, and `concurrency` instead of an `argv` array, and it no longer reads `process.argv` or handles CLI help (see #11623).

```diff
- remix-test --type server --concurrency 1
+ remix test --type server --concurrency 1
```

```diff
 import { runRemixTest } from '@remix-run/test/cli'

 let exitCode = await runRemixTest({
-  argv: ['--type', 'server', '--concurrency', '1'],
   cwd: process.cwd(),
+  type: ['server'],
+  concurrency: 1,
 })
```
