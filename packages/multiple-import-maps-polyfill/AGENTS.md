# Multiple Import Maps Polyfill Agent Guide

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before changing this package.

- Treat `src/lib/core.ts`, `env.ts`, `features.ts`, `resolve.ts`, `self.ts`, `trusted-types.ts`, `test/base-href.ts`, `test/polyfill.ts`, `test/revoke-blob-urls.ts`, `test/shim.ts`, and `test/fixtures/` as a maintained fork of ES Module Shims.
- Preserve upstream file structure, function order, function and test names, control flow, comments, and fixtures while expressing implementation code as strict TypeScript using Remix formatting.
- Keep harness and repository-tooling adaptations outside upstream-derived files when practical.
- Avoid opportunistic refactors in forked files; changes should remain easy to diff against the pinned upstream revision after accounting for types and Remix formatting.
- Update `CONTRIBUTING.md` when the upstream baseline, intentional differences, test mapping, or update workflow changes.
