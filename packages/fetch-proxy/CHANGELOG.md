# `fetch-proxy` CHANGELOG

This is the changelog for [`fetch-proxy`](https://github.com/remix-run/remix/tree/main/packages/fetch-proxy). It follows [semantic versioning](https://semver.org/).

## v0.7.1

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.7.0 (2025-11-05)

- Move `@remix-run/headers` to `peerDependencies`
- Build using `tsc` instead of `esbuild`. This means modules in the `dist` directory now mirror the layout of modules in the `src` directory.

## v0.6.0 (2025-10-22)

- BREAKING CHANGE: Removed CommonJS build. This package is now ESM-only. If you need to use this package in a CommonJS project, you will need to use dynamic `import()`.

## v0.5.0 (2025-07-24)

- Renamed package from `@mjackson/fetch-proxy` to `@remix-run/fetch-proxy`
- FIX: A regression that stopped forwarding the method from an exising request object
- Forward additional properties from existing request objects passed to the proxy, including:
  - cache
  - credentials
  - integrity
  - keepalive
  - mode
  - redirect
  - referrer
  - referrerPolicy
  - signal

## v0.4.0 (2025-07-11)

- Forward all additional options to the proxied request object

## v0.3.0 (2025-06-10)

- Add `/src` to npm package, so "go to definition" goes to the actual source
- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v0.2.0 (2024-11-14)

- Added CommonJS build

## v0.1.0 (2024-09-12)

- Initial release
