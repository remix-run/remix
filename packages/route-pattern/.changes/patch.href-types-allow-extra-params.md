Previously, including extra params in `RoutePattern.href` resulted in a type error:

```ts
let pattern = new RoutePattern('/posts/:id')
pattern.href({ id: 1, extra: 'stuff' })
//                     ^^^^^
// 'extra' does not exist in type 'HrefParams<"/posts/:id">'
```

Now, extra params are allowed and autocomplete for inferred params still works:

```ts
let pattern = new RoutePattern('/posts/:id')
pattern.href({ id: 1, extra: 'stuff' }) // no type error

pattern.href({})
//             ^ autocomplete suggests `id`
```
