# @remix-run/file-cache

`@remix-run/file-cache` provides content-addressed caching for expensive `File -> File` transforms.

## Example

```ts
import { createFileCache } from 'remix/file-cache'
import { createFsFileStorage } from 'remix/file-storage/fs'

let cache = createFileCache(createFsFileStorage('./tmp/image-cache'), {
  maxSize: 100 * 1024 * 1024,
  version: 'v1',
})

let result = await cache.getOrSet([sourceFile, 'thumbnail'], () => transform(sourceFile))
```

## API

- `cache.get(key)` - read a cached file
- `cache.set(key, file)` - write a cached file
- `cache.getOrSet(key, factory)` - compute on miss
- `cache.prune()` - remove entries for other versions
- `cache.clear()` - remove entries for the current version
