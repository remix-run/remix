BREAKING CHANGE: `context.get(key)` now returns `undefined` when the requested value is not available in request context and the key does not provide a default value. Constructor keys such as `FormData` and `Session` still infer their instance value type when they are set, but an empty `RequestContext` no longer types `context.get(FormData)` as available by default.

If your code reads a constructor key from a broad `RequestContext`, handle the missing case before using the value:

```ts
// before
function readName(context: RequestContext): string {
  return String(context.get(FormData).get('name') ?? '')
}

// after
function readName(context: RequestContext): string {
  return String(context.get(FormData)?.get('name') ?? '')
}
```

Handlers whose context contract proves that middleware provides the key can keep reading a defined value. Keep middleware arrays tuple-typed when you want that context contribution to flow into handlers:

```ts
let router = createRouter({
  middleware: [formData()] as const,
})

router.post('/profile', (context) => {
  let formData = context.get(FormData)
  return Response.json({ name: formData.get('name') })
})
```
