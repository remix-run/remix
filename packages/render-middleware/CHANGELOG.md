# `render-middleware` CHANGELOG

This is the changelog for [`render-middleware`](https://github.com/remix-run/remix/tree/main/packages/render-middleware). It follows [semantic versioning](https://semver.org/).

## v0.3.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`assets@0.7.1`](https://github.com/remix-run/remix/releases/tag/assets@0.7.1)
  - [`response@0.3.9`](https://github.com/remix-run/remix/releases/tag/response@0.3.9)
  - [`ui@0.10.0`](https://github.com/remix-run/remix/releases/tag/ui@0.10.0)

## v0.3.0

### Minor Changes

- BREAKING CHANGE: `render({ assets })` now uses `assets.getScriptEntry()` to resolve client entries from source files so their import maps are included in rendered documents and frame responses. Custom asset server implementations must provide `getScriptEntry()` instead of `getHref()` and `getPreloads()`. It must return a `Promise` resolving to the following `ScriptEntry` shape:

  ```ts
  interface ScriptEntry {
    href: string
    preloads: string[]
    importMap: {
      imports: Record<string, string>
      scopes?: Record<string, Record<string, string>>
    }
  }
  ```

  Apps using `createAssetServer()` receive this integration automatically. Custom rendering setups can follow the [asset server migration steps](https://github.com/remix-run/remix/blob/main/packages/assets/CHANGELOG.md#v070) (see #11706).

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`assets@0.7.0`](https://github.com/remix-run/remix/releases/tag/assets@0.7.0)
  - [`fetch-router@0.22.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.22.0)
  - [`ui@0.9.0`](https://github.com/remix-run/remix/releases/tag/ui@0.9.0)

## v0.2.0

### Minor Changes

- Add `render({ assets?, onError? })`, the conventional request-scoped Remix UI renderer. It returns typed HTML responses through `context.render(node, init)`, resolves nested and targeted frames through the current router with safe request headers and cancellation, preserves frame error bodies, and optionally resolves source-based client entries through an asset server (see #11607).

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`assets@0.6.0`](https://github.com/remix-run/remix/releases/tag/assets@0.6.0)
  - [`ui@0.8.0`](https://github.com/remix-run/remix/releases/tag/ui@0.8.0)

## v0.1.5

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.21.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.21.0)

## v0.1.4

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.20.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.20.1)

## v0.1.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.20.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.20.0)

## v0.1.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.2`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.2)

## v0.1.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.1`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.1)

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/render-middleware`, which provides the `Renderer` context key, `Renderer` type, and `renderWith()` middleware for adding request-scoped renderers to `fetch-router` request context. Renderers are available as both `context.render` and `context.get(Renderer)`.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`fetch-router@0.19.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.19.0)

## Unreleased
