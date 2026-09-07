# Contributing

This package is maintained as a focused fork of [ES Module Shims](https://github.com/guybedford/es-module-shims). Before changing its loader or upstream-derived tests, compare the change with the corresponding upstream code and preserve upstream structure wherever possible.

## Upstream baseline

The current baseline is [ES Module Shims 2.8.4](https://github.com/guybedford/es-module-shims/tree/72ef4bc359a9fc2250529d245314238fc84b4886), commit `72ef4bc359a9fc2250529d245314238fc84b4886`.

Clone that commit into a temporary directory when comparing this package with upstream:

```sh
git clone https://github.com/guybedford/es-module-shims.git "${TMPDIR:-/tmp}/es-module-shims"
git -C "${TMPDIR:-/tmp}/es-module-shims" checkout 72ef4bc359a9fc2250529d245314238fc84b4886
```

Keep the version, commit, and `LICENSE` in this package synchronized when updating the baseline.

The upstream-derived implementation is in `src/lib/core.ts`, `env.ts`, `features.ts`, `resolve.ts`, `self.ts`, and `trusted-types.ts`. These files follow upstream's structure, function order, names, control flow, and comments, with types layered onto the implementation and Remix formatting applied. The adapted upstream tests are `test/base-href.ts`, `polyfill.ts`, `revoke-blob-urls.ts`, and `shim.ts`. They retain upstream's test order after tests for removed features are omitted, with types layered onto the test code. Their JavaScript fixture modules remain under `test/fixtures/` so the loader receives the same source syntax as upstream.

The corresponding `*.test.browser.ts` files replace upstream's HTML and Mocha setup with the Remix test runner, then import the adjacent upstream-derived test module to register its suites. `test/polyfill-errors.test.e2e.ts` and `test/shim-errors.test.e2e.ts` contain the three retained upstream tests that intentionally return HTTP errors. They require the e2e server because the browser test harness rejects failed requests. `test/polyfill.test.e2e.ts` contains Remix-specific coverage and does not mirror an upstream test file.

The browser runner starts a module graph before each TypeScript test entry can configure the document. The URL-mapping test in `polyfill.ts`, scoped-mapping test in `shim.ts`, and blob-revocation test therefore append their import maps inside the test instead of receiving them from the initial HTML document as they do upstream. Fixture imports that must remain dynamic use non-literal specifiers so the browser test server does not rewrite them before the polyfill sees them.

## Why this fork exists

ES Module Shims provides the module graph loader needed to evaluate dynamic imports against import maps added after the initial import map. This package exposes that behavior as an ES module so Remix integrations can install it explicitly, preload through the same fetch cache used by later imports, and avoid adding public globals or declarative script handling to the page.

The fork keeps ES Module Shims' graph fetching, parsing, resolution, rewriting, execution, cycle handling, caching, integrity, source map, and feature detection logic. Its public surface is focused on JavaScript dynamic imports that depend on multiple import maps.

## Intentional differences

- The upstream JavaScript implementation and executable tests are maintained as strict TypeScript without restructuring their runtime logic. Fixture modules remain JavaScript.
- The runtime is an ES module with explicit `importShim` and `preloadShim` exports. `preloadShim` accepts one or more module specifiers, exposes upstream's `processPreload` fetch-cache path without requiring declarative preload links, and ignores preload failures at the public wrapper boundary.
- Rewritten dynamic imports use a private symbol-keyed bridge instead of a public `globalThis.importShim` API.
- Import maps are read from standard `<script type="importmap">` elements, including maps appended at runtime.
- Declarative module scripts and module preload elements are not intercepted.
- Shim mode, legacy module support, initialization options, customization hooks, and hot reloading are removed.
- Module transforms for CSS, JSON, Wasm, and TypeScript are removed. Native JSON and CSS import attributes and static Wasm source-phase imports retain upstream's URL-rewriting structure but delegate module loading to the browser.
- Dynamic source imports and import defer are removed.
- `es-module-lexer` is a package dependency rather than vendored into the loader.
- Import-map integrity metadata is enforced when present, but upstream's `enforceIntegrity` policy requiring integrity for every module is removed.
- Runtime warnings use the `remix/multiple-import-maps-polyfill` package name, and upstream's global `ESMS_DEBUG` diagnostics are not exposed.
- Native module registration prevents the package's lazy ESM wrapper from loading itself through the polyfill.
- `resolveAndComposeImportMap` clones each scope's imports before composing a later import map. Upstream only clones the outer `scopes` object, so adding mappings to an existing scope mutates the saved first import map. The loader can then incorrectly treat late mappings as natively installed and skip the polyfill. Cloning each scope keeps the first and composed import maps independent.

`src/index.ts` and `src/lib/polyfill.ts` are Remix-owned integration code rather than forked upstream source.

Keep the intentional differences above up to date whenever fork behavior is added, removed, or changed.

## Updating from upstream

Do not sync with upstream unless explicitly requested. Before making changes, identify the upstream changes relevant to the features retained by this package and get approval for the proposed scope. Do not incorporate unapproved changes or changes that only affect unsupported ES Module Shims features.

1. Clone the target ES Module Shims commit into a temporary directory. Update the version and commit in the upstream baseline above, along with version references in upstream-derived source comments.
2. Diff its `src/` files against the upstream-derived files listed above before editing. Review upstream changes in their original order and context.
3. Apply approved changes relevant to the retained feature set. Translate upstream JavaScript to strict TypeScript by adding types without restructuring the runtime logic. Keep file structure, function order, names, control flow, and comments aligned with upstream unless an intentional difference above requires otherwise.
4. Do not reimplement or broadly refactor upstream logic while updating it. Keep removed feature blocks easy to identify in the diff until deleting them clearly improves maintenance.
5. Diff upstream `test/shim.js`, `test/polyfill.js`, `test/base-href.js`, `test/revoke-blob-urls.js`, and their fixtures against the corresponding files under `test/`. Port tests for retained behavior with their original suite names, test names, order, bodies, and fixtures, adding types without restructuring the test logic.
6. Put test-runner adaptation in the `*.test.browser.ts` entries or `test/test-adapter.ts`. Use e2e tests only where the browser runner cannot reproduce upstream document ordering or intentional HTTP failures.
7. Omit tests for removed features instead of keeping a downstream skip list. Keep Remix-specific public API, preload, CSP, Trusted Types, and integrity coverage in `test/polyfill.test.e2e.ts`.
8. Format and lint all updated code with the repository's standard tooling. The resulting code should follow Remix conventions even where upstream uses a different style.
9. Review the intentional differences above and update them to reflect the resulting fork.
10. Compare the upstream license with `LICENSE` and update its copyright, terms, and attribution when needed. Review the attribution in `README.md` at the same time.
11. Add or update the appropriate change files to describe the user-visible fixes and compatibility updates included in the sync.

## Validation

Run the package suite and type checker:

```sh
pnpm --filter @remix-run/multiple-import-maps-polyfill run test --quiet
pnpm --filter @remix-run/multiple-import-maps-polyfill run typecheck
```

The browser suite runs in Chromium and Firefox. Both browsers are required because Firefox exercises the polyfilled multiple-import-map path while Chromium verifies native passthrough and shared module identity.
