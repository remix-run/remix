`paramsMeta` shows a nameless wildcard match for omitted hostname

An omitted hostname is already coerced to `*` (nameless wildcard) to represent "match any hostname" during matching.
Previously, `paramsMeta` did not distinguish between a fully static hostname and an omitted hostname as both had `hostname` set to `[]`.
Now, `paramsMeta` returns a nameless wildcard match for the entire hostname when the hostname is omitted.

Example:

```ts
const pattern = new RoutePattern('/users/:id')
const match = pattern.match('http://example.com/users/123')
// match.paramsMeta.hostname is now [{ type: '*', name: '*', begin: 0, end: 11, value: 'example.com' }]
```

As a result, `Specificity.descending` (the default ordering for matchers) now correctly orders patterns with static hostname before patterns with omitted hostnames.
