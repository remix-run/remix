---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
---

Added a new `future.v2_normalizeFormMethod` flag to normalize the exposed `useNavigation().formMethod` as an uppercase HTTP method to align with the previous `useTransition` behavior as well as the `fetch()` behavior of normalizing to uppercase HTTP methods.

- When `future.v2_normalizeFormMethod === false`,
  - `useNavigation().formMethod` is lowercase
  - `useFetcher().formMethod` is uppercase
- When `future.v2_normalizeFormMethod === true`:
  - `useNavigation().formMethod` is uppercase
  - `useFetcher().formMethod` is uppercase
