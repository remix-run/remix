BREAKING CHANGE: `createHref()` now normalizes generated pathnames to one leading slash, including absolute URLs and hrefs generated with `baseURL`. Leading slashes in root wildcard values no longer round-trip unchanged. Pathname wildcard values containing standalone `.` or `..` segments now throw `CreateHrefError` with `details.type === 'invalid-pathname-wildcard'`.

Pass path fragments without extra leading slashes, and resolve any intended dot segments before generating an href. Multi-segment paths, internal and trailing slashes, and dotted filenames remain supported.

```diff
 createHref('/*path', {
-  path: '/docs/../readme.md',
+  path: 'readme.md',
 }, { baseURL: 'https://example.com/' })
```
