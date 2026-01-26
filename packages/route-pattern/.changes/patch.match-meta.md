Add `meta` to match returned by `RoutePattern.match()`

The `meta` property provides rich information about matched params (variables and wildcards) in the hostname and pathname, analogous to RegExp groups/indices. This enables advanced use cases that need more than just the param values including match ranking.

```ts
import * as assert from 'node:assert/strict'

let pattern = new RoutePattern('https://:tenant.example.com/:lang/docs/*')
let match = pattern.match('https://acme.example.com/en/docs/api/routes')

assert.deepStrictEqual(match.params, { tenant: 'acme', lang: 'en' })
assert.deepStrictEqual(match.meta.hostname, [
  { type: ':', name: 'tenant', value: 'acme', begin: 0, end: 4 },
])
assert.deepStrictEqual(match.meta.pathname, [
  { type: ':', name: 'lang', value: 'en', begin: 0, end: 2 },
  { type: '*', name: '*', value: 'api/routes', begin: 8, end: 18 },
])
```
