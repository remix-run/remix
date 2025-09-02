# `fetch-proxy` CHANGELOG

This is the changelog for [`fetch-proxy`](https://github.com/remix-run/remix/tree/main/packages/fetch-proxy). It follows [semantic versioning](https://semver.org/).

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
