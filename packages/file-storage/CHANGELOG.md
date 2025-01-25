# `file-storage` CHANGELOG

This is the changelog for [`file-storage`](https://github.com/mjackson/remix-the-web/tree/main/packages/file-storage). It follows [semantic versioning](https://semver.org/).

## v0.5.0 (2025-01-25)

- Add `fileStorage.put(key, file)` method as a convenience around `fileStorage.set(key, file)` + `fileStorage.get(key)`, which is a very common pattern when you need immediate access to the file you just put in storage

```ts
// before
await fileStorage.set(key, file);
let newFile = await fileStorage.get(key)!;

// after
let newFile = await fileStorage.put(key, file);
```

## v0.4.1 (2025-01-10)

- Fix missing types for `file-storage/local` in npm package

## v0.4.0 (2025-01-08)

- Fixes race conditions with concurrent calls to `set`
- Shards storage directories for more scalable file systems

## v0.3.0 (2024-11-14)

- Added CommonJS build
- Upgrade to lazy-file@3.1.0

## v0.2.1 (2024-09-04)

- Automatically clean up old files in `LocalFileStorage` when new files are stored with the same key

## v0.2.0 (2024-08-26)

- Moved `LocalFileStorage` to `file-storage/local` export
- Moved `MemoryFileStorage` to `file-storage/memory` export

## v0.1.0 (2024-08-24)

- Initial release
