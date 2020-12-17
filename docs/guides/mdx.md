---
title: MDX | Remix
---

Remix supports MDX out of the box.

## MDX Routes

MDX files can be route components, just put an MDX file in the routes folder and you're done.

MDX Routes can "export" headers and meta information just like regular route modules using YAML "front matter".

```md
---
meta:
  title: Title of the page
  description: A solid description of this document.

headers:
  cache-control: max-age=60, s-maxage=604800
---

# Page title

Some more stuff
```

## MDX Components

Any file in your app can be a `.md` or `.mdx` file, then imported and rendered like any other component, just make sure to put the extension on there.

```jsx
import SalesSchpill from "../content/sales-schpill.mdx";

export default function Page() {
  return (
    <>
      <Hero />
      <Pricing />
      <SalesSchpill />
    </>
  );
}
```

## MDX Config

You can control the mdx options in your `remix.config.js` file.

```js
exports.mdx = {
  rehypePlugins: [require("@mapbox/rehype-prism"), require("rehype-slug")]
};
```

If you're familiar with mdx, this object simply gets passed to the call to mdx:

```js
mdx(markdownString, remixMdxConfigObject);
```
