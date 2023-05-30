---
"@remix-run/server-runtime": minor
"@remix-run/react": minor
---

Force Typescript to simplify type produced by `Serialize`.

As a result, the following types and functions have simplified return types:

- SerializeFrom
- useLoaderData
- useActionData
- useFetcher

```ts
type Data = { hello: string; when: Date };

// BEFORE
type Unsimplified = SerializeFrom<Data>;
//   ^? SerializeObject<UndefinedToOptional<{ hello: string; when: Date }>>

// AFTER
type Simplified = SerializeFrom<Data>;
//   ^? { hello: string; when: string }
```
