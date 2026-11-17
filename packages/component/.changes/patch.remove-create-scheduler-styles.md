`createScheduler()` no longer accepts a third `styles` argument. The argument was never used: each root takes its style manager from its frame context, so passing one had no effect. Runtime behavior is unchanged, but TypeScript projects that pass three arguments now get a type error ("Expected 2 arguments, but got 3"). Remove the argument to fix it:

```diff
- let scheduler = createScheduler(document, errorTarget, styleManager)
+ let scheduler = createScheduler(document, errorTarget)
```
