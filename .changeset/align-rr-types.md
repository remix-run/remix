---
"@remix-run/cloudflare": major
"@remix-run/deno": major
"@remix-run/node": major
"@remix-run/react": major
"@remix-run/server-runtime": major
---

Remove/align Remix types with those used in React Router

* Change exposed `any` types to `unknown`
  * `AppData`
  * `useLocation.state`
  * `useMatches()[i].data`
  * `useFetcher().data`
  * `MetaMatch.handle`
* `useMatches()[i].handle` type changed from `{ [k: string]: any }` to `unknown`
* Rename the `useMatches()` return type from `RouteMatch` to `UIMatch`
* Rename `LoaderArgs`/`ActionArgs` to `LoaderFunctionArgs`/`ActionFunctionArgs`
