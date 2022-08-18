---
"remix": minor
"@remix-run/cloudflare": minor
"@remix-run/deno": minor
"@remix-run/node": minor
"@remix-run/react": minor
"@remix-run/serve": minor
"@remix-run/server-runtime": minor
---

Each runtime package (@remix-run/cloudflare,@remix-run/deno,@remix-run/node) now exports `SerializeFrom`, which is used to
infer the JSON-serialized return type of loaders and actions.

Example:
```ts
type MyLoaderData = SerializeFrom<typeof loader>
type MyActionData = SerializeFrom<typeof action>
```

This is what `useLoaderData<typeof loader>` and `useActionData<typeof action>` use under-the-hood.
