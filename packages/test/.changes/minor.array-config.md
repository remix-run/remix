Accept arrays for `glob.{test,browser,e2e,exclude}`, `project`, `type`, and `coverage.{include,exclude}` config fields

- The matching CLI flags (`--glob.test`, `--project`, `--type`, etc.) can be repeated
- Positional arguments after `remix-test` now collect into `glob.test`, so `remix-test "src/**/*.test.ts" "tests/**/*.test.tsx"` works.
- `type`'s default is now `["server", "browser", "e2e"]` instead of `"server,browser,e2e"`.
