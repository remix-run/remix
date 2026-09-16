BREAKING CHANGE: Navigations that specify a named frame that is not currently mounted now perform a document navigation instead of reloading the top frame. Fresh links, forms, and `navigate()` calls are left to the browser, preserving native form methods and bodies, while back and forward traversal reloads the destination document. Omit the target when the navigation should always reload the top frame:

```diff
-<a href="/account" data-rmx-target="optional-account">
+<a href="/account">
```
