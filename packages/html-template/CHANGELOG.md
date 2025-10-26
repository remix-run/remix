# `html-template` CHANGELOG

This is the changelog for [`html-template`](https://github.com/remix-run/remix/tree/main/packages/html-template). It follows [semantic versioning](https://semver.org/).

## Unreleased

- Initial release of `@remix-run/html-template` package
- `html` tagged template function for safe HTML string construction with automatic escaping
- `html.raw` for explicitly marking HTML as safe (no escaping)
- `isSafeHtml` type guard function
- `SafeHtml` branded type for type-safe HTML strings
- Support for composable HTML fragments without double-escaping
- Support for arrays, primitives, and falsy values in interpolations
