BREAKING CHANGE: Return upstream redirects to proxy clients by default so redirect responses retain their status, `Location`, and headers such as `Set-Cookie`. The new `redirect` option supports following redirects internally, and a defined per-call `init.redirect` takes precedence over that option.

To preserve the previous behavior and keep following redirects inside the proxy:

```diff
-let proxy = createFetchProxy('https://remix.run')
+let proxy = createFetchProxy('https://remix.run', { redirect: 'follow' })
```
