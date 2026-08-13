BREAKING CHANGE: Href helpers from `remix/route-pattern/href` and `remix/routes` now take search parameters in a `searchParams` options property:

```diff
- const href = userRoute.href({ id: '123' }, { tab: 'settings' })
+ const href = userRoute.href(
+   { id: '123' },
+   { searchParams: { tab: 'settings' } },
+ )
```

The options object also accepts a `baseURL` for generating path-relative same-origin hrefs. Route matching accepts the same option for relative URL strings, and `searchParams` accepts both typed objects and `URLSearchParams`.
