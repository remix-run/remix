Added a `ttlSeconds` option to `createRedisSessionStorage()`, matching the option name used by `createMemcacheSessionStorage()`. The `ttl` option still works and is now deprecated.

```diff
 let sessionStorage = createRedisSessionStorage(redis, {
-  ttl: 60 * 60 * 24,
+  ttlSeconds: 60 * 60 * 24,
 })
```
