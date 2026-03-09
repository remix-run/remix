# `session-storage-memcache` CHANGELOG

This is the changelog for [`session-storage-memcache`](https://github.com/remix-run/remix/tree/main/packages/session-storage-memcache). It follows [semantic versioning](https://semver.org/).

## v0.1.0

### Minor Changes

- Add Memcache session storage with `createMemcacheSessionStorage(server, options)`.

  This adds a Node.js Memcache backend with support for `useUnknownIds`, `keyPrefix`, and `ttlSeconds`, along with integration tests that run against Memcached in CI.

## Unreleased

### Minor Changes

- Initial release.
