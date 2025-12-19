# `component` CHANGELOG

This is the changelog for [`component`](https://github.com/remix-run/remix/tree/main/packages/component). It follows [semantic versioning](https://semver.org/).

## v0.2.1 (2025-12-19)

- Fix node replacement

  Anchors were being calculated incorrectly because it removed the old node before inserting the new one, Now it correctly uses the old node as the anchor for insertion and inserts the new node before removing the old one.

## v0.2.0 (2025-12-18)

- This is the initial release of the component package.

  See the [README](https://github.com/remix-run/remix/blob/main/packages/component/README.md) for more information.

## Unreleased

- Initial release
