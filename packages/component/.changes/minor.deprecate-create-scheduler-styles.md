The third `styles` argument to `createScheduler()` is deprecated. It has been ignored since each root started using the style manager from its frame context, and it will be removed in the next major version. Drop the argument:

```diff
- let scheduler = createScheduler(document, errorTarget, styleManager)
+ let scheduler = createScheduler(document, errorTarget)
```
