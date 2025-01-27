# `file-storage` CHANGELOG

This is the changelog for [`file-storage`](https://github.com/mjackson/remix-the-web/tree/main/packages/file-storage). It follows [semantic versioning](https://semver.org/).

## HEAD

- Add `storage.list(options)` for listing files in storage.

The following `options` are available:

- `cursor`: An opaque string that allows you to paginate over the keys in storage
- `includeMetadata`: If `true`, include file metadata in the result
- `limit`: The maximum number of files to return
- `prefix`: Only return keys that start with this string

Pagination is done via an opaque `cursor` property in the list result object. If it is not `undefined`, there are more files to list. You can list them by passing the `cursor` back in the `options` object on the next call.

```ts
let result = await storage.list();

console.log(result.files);

if (result.cursor !== undefined) {
  let result2 = await storage.list({ cursor: result.cursor });
}
```

Objects in the `files` array have only a `key` property by default. If you pass `includeMetadata: true` in the options, they will also have `lastModified`, `name`, `size`, and `type` properties.

## v0.5.0 (2025-01-25)

- Add `storage.put(key, file)` method as a convenience around `storage.set(key, file)` + `storage.get(key)`, which is a very common pattern when you need immediate access to the file you just put in storage

```ts
// before
await storage.set(key, file);
let newFile = await storage.get(key)!;

// after
let newFile = await storage.put(key, file);
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
