BREAKING CHANGE: Change how params are represented within `RoutePattern.ast`

Previously, `RoutePattern.ast.{hostname,pathname}.tokens` had param tokens like:

```ts
type ParamToken = { type: ':'; '*'; nameIndex: number }
```

where the `nameIndex` was used to access the param name from `paramNames`:

```ts
let { pathname } = pattern.ast

for (let token of pathname.tokens) {
  if (token.type === ':' || token.type === '*') {
    let paramName = pathname.paramNames[token.nameIndex]
    console.log('name: ', paramName)
  }
}
```

This has now been simplified so that param tokens contain their own name:

```ts
type ParamToken = { type: ':' | '*'; name: string }

let { pathname } = pattern.ast

for (let token of pathname.tokens) {
  if (token.type === ':' || token.type === '*') {
    console.log('name: ', token.name)
  }
}
```

If you want to iterate over _just_ the params, there's a new `.params` getter:

```ts
let { pathname } = pattern.ast

for (let param of pathname.params) {
  console.log('type: ', param.type)
  console.log('name: ', param.name)
}
```
