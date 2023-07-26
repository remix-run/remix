---
"remix": major
"@remix-run/cloudflare": major
"@remix-run/deno": major
"@remix-run/dev": major
"@remix-run/node": major
"@remix-run/react": major
"@remix-run/server-runtime": major
"@remix-run/testing": major
---

We have made a few important changes to the route `meta` API as reflected in the v1 implementation when using the `future.v2_meta` config option.

- The `meta` function should no longer return an object, but an array of objects that map to the HTML tag's respective attributes. This provides more flexibility and control over how certain tags are rendered, and the order in which they appear.
- In most cases, `meta` descriptor objects render a `<meta>` tag. There are a few notable exceptions:
  - `{ title: "My app" }` will render `<title>My app</title>`.
  - `{ 'script:ld+json': { /* ... */ } }` will render `<script type="application/ld+json">/* ... */</script>`, where the value is serialized to JSON and rendered inside the `<script>` tag.
  - `{ tagName: 'link', ...attributes }` will render `<link {...attributes} />`
    - This is useful for things like setting canonical URLs. For loading assets, we encourage you to use the `links` export instead.
    - It's important to note that `tagName` may only accept `meta` or `link`, so other arbitrary elements will be ignored.
- `<Meta />` will no longer render the `meta` output from the entire route hierarchy. Only the output from the leaf (current) route will be rendered unless that route does not export a `meta` function, in which case the output from the nearest ancestor route with `meta` will be rendered.
  - This change comes from user feedback that auto-merging meta made effective SEO difficult to implement. Our goal is to give you as much control as you need over meta tags for each individual route.
  - Our suggested approach is to **only export a `meta` function from leaf route modules**. However, if you do want to render a tag from another matched route, `meta` now accepts a `matches` argument for you to merge or override parent route meta as you'd like.
  ```tsx
  export function meta({ matches }) {
    return [
      // render all ancestor route meta except for title tags
      ...matches
        .flatMap((match) => match.meta)
        .filter((match) => !("title" in match)),
      { title: "Override the title!" },
    ];
  }
  ```
- The `parentsData` argument has been removed. If you need to access data from a parent route, you can use `matches` instead.
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
