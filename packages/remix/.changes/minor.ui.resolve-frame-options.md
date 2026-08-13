BREAKING CHANGE: Browser frame resolvers now receive one options object instead of positional `signal` and `target` arguments:

```diff
- async function resolveFrame(src, signal, target) {
+ async function resolveFrame(src, options) {
+   const { signal, target } = options ?? {}
    // ...
  }
```
