BREAKING CHANGE: `csrf()` now reads submitted tokens from headers and parsed form fields only by default. Requests that supply a token only in the query string are rejected. Applications that need query parameter tokens can retain that behavior with an explicit `value` resolver, which replaces the default lookup:

```diff
-csrf()
+csrf({
+  value(context) {
+    return context.url.searchParams.get('_csrf')
+  },
+})
```
