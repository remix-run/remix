Internal refactor to test discovery to better support test execution in `bun`.

- Unlike Node, Bun's `fs.promises.glob` _follows_ symbolic links and does not prune traversal via the `exclude` option, which can cause the test runner to enter `node_modules` symlink cycles in pnpm workspaces
- Refactored the internal test discovery logic to detect and use Bun's native `Glob` class when running under the Bun runtime. Bun's `Glob#scan` does not follow symlinks by default, avoiding the cycle.
- The Node runtime continues to use `fs.promises.glob`
