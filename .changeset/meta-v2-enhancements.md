---
"@remix-run/cloudflare": minor
"@remix-run/deno": minor
"@remix-run/node": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
---

We have made a few changes to the API for route module `meta` functions when using the `future.v2_meta` flag. **These changes are _only_ breaking for users who have opted in.**

- `V2_HtmlMetaDescriptor` has been renamed to `V2_MetaDescriptor`
- The `meta` function's arguments have been simplified
  - `parentsData` has been removed, as each route's loader data is available on the `data` property of its respective `match` object
    ```tsx
    // before
    export function meta({ parentsData }) {
      return [{ title: parentsData["routes/some-route"].title }];
    }
    // after
    export function meta({ matches }) {
      return [
        {
          title: matches.find((match) => match.id === "routes/some-route").data
            .title,
        },
      ];
    }
    ```
  - The `route` property on route matches has been removed, as relevant match data is attached directly to the match object
    ```tsx
    // before
    export function meta({ matches }) {
      let rootModule = matches.find((match) => match.route.id === "root");
    }
    // after
    export function meta({ matches }) {
      let rootModule = matches.find((match) => match.id === "root");
    }
    ```
- Added support for generating `<script type='application/ld+json' />` and meta-related `<link />` tags to document head via the route `meta` function when using the `v2_meta` future flag
