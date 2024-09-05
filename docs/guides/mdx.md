---
title: MDX
description: Remix makes integrating MDX into your project a breeze with built in routes and "import" support.
---

# MDX

<docs-warning>This documentation is only relevant when using the [Classic Remix Compiler][classic-remix-compiler]. Vite consumers wanting to use MDX should use the [MDX Rollup (and Vite) plugin][mdx-plugin].</docs-warning>

While we believe that a strong separation of data and display is important, we understand that formats that mix the two such as [MDX][mdx] (Markdown with embedded JSX components) have become a popular and powerful authoring format for developers.

<docs-info>Rather than compiling your content at build-time like this document demonstrates, it's typically better UX and DX if you do this at runtime via something like <a href="https://github.com/kentcdodds/mdx-bundler">mdx-bundler</a>. It's also much more customizable and powerful. However, if you prefer to do this compilation at build-time, continue reading.</docs-info>

Remix has built-in support for using MDX at build-time in two ways:

- You can use a `.mdx` file as one of your route modules
- You can `import` a `.mdx` file into one of your route modules (in `app/routes`)

## Routes

The simplest way to get started with MDX in Remix is to create a route module. Just like `.tsx`, `.js` and `.jsx` files in your `app/routes` directory, `.mdx` (and `.md`) files will participate in automatic file system based routing.

MDX routes allow you to define both meta and headers as if they were a code based route:

```md
---
meta:
  - title: My First Post
  - name: description
    content: Isn't this awesome?
headers:
  Cache-Control: no-cache
---

# Hello Content!
```

The lines in the document above between the `---` are called "frontmatter". You can think of them like metadata for your document, formatted as [YAML][yaml].

You can reference your frontmatter fields through the global `attributes` variable in your MDX:

```mdx
---
componentData:
  label: Hello, World!
---

import SomeComponent from "~/components/some-component";

# Hello MDX!

<SomeComponent {...attributes.componentData} />
```

### Example

By creating a `app/routes/posts.first-post.mdx` we can start writing a blog post:

```mdx
---
meta:
  - title: My First Post
  - name: description
    content: Isn't this just awesome?
---

# Example Markdown Post

You can reference your frontmatter data through "attributes". The title of this post is {attributes.meta.title}!
```

### Advanced Example

You can even export all the other things in this module that you can in regular route modules in your mdx files like `loader`, `action`, and `handle`:

```mdx
---
meta:
  - title: My First Post
  - name: description
    content: Isn't this awesome?

headers:
  Cache-Control: no-cache

handle:
  someData: abc
---

import styles from "./first-post.css";

export const links = () => [
  { rel: "stylesheet", href: styles },
];

import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  return json({ mamboNumber: 5 });
};

export function ComponentUsingData() {
  const { mamboNumber } = useLoaderData<typeof loader>();
  return <div id="loader">Mambo Number: {mamboNumber}</div>;
}

# This is some markdown!

<ComponentUsingData />
```

## Modules

Besides just route level MDX, you can also import these files anywhere yourself as if it were a regular JavaScript module.

When you `import` a `.mdx` file, the exports of the module are:

- **default**: The React component for consumption
- **attributes**: The frontmatter data as an object
- **filename**: The basename of the source file (e.g. "first-post.mdx")

```tsx
import Component, {
  attributes,
  filename,
} from "./first-post.mdx";
```

## Example Blog Usage

The following example demonstrates how you might build a simple blog with MDX, including individual pages for the posts themselves and an index page that shows all posts.

```tsx filename=app/routes/_index.tsx
import { json } from "@remix-run/node"; // or cloudflare/deno
import { Link, useLoaderData } from "@remix-run/react";

// Import all your posts from the app/routes/posts directory. Since these are
// regular route modules, they will all be available for individual viewing
// at /posts/a, for example.
import * as postA from "./posts/a.mdx";
import * as postB from "./posts/b.md";
import * as postC from "./posts/c.md";

function postFromModule(mod) {
  return {
    slug: mod.filename.replace(/\.mdx?$/, ""),
    ...mod.attributes.meta,
  };
}

export async function loader() {
  // Return metadata about each of the posts for display on the index page.
  // Referencing the posts here instead of in the Index component down below
  // lets us avoid bundling the actual posts themselves in the bundle for the
  // index page.
  return json([
    postFromModule(postA),
    postFromModule(postB),
    postFromModule(postC),
  ]);
}

export default function Index() {
  const posts = useLoaderData<typeof loader>();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.slug}>
          <Link to={post.slug}>{post.title}</Link>
          {post.description ? (
            <p>{post.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
```

Clearly this is not a scalable solution for a blog with thousands of posts. Realistically speaking, writing is hard, so if your blog starts to suffer from too much content, that's an awesome problem to have. If you get to 100 posts (congratulations!), we suggest you rethink your strategy and turn your posts into data stored in a database so that you don't have to rebuild and redeploy your blog every time you fix a typo. You can even keep using MDX with [MDX Bundler][mdx-bundler].

## Advanced Configuration

If you wish to configure your own remark plugins you can do so through the `remix.config.js`'s `mdx` export:

```js filename=remix.config.js
const {
  remarkMdxFrontmatter,
} = require("remark-mdx-frontmatter");

// can be an sync / async function or an object
exports.mdx = async (filename) => {
  const [rehypeHighlight, remarkToc] = await Promise.all([
    import("rehype-highlight").then((mod) => mod.default),
    import("remark-toc").then((mod) => mod.default),
  ]);

  return {
    remarkPlugins: [remarkToc],
    rehypePlugins: [rehypeHighlight],
  };
};
```

The above configuration parses the markdown to insert [highlight.js][highlightjs] friendly DOM elements. To have the syntax highlighting appear, you will also need to include the highlight.js css file. See also [surfacing styles][surfacing-styles].

[mdx-plugin]: https://mdxjs.com/packages/rollup
[mdx]: https://mdxjs.com
[yaml]: https://yaml.org
[mdx-bundler]: https://github.com/kentcdodds/mdx-bundler
[classic-remix-compiler]: ./vite#classic-remix-compiler-vs-remix-vite
[surfacing-styles]: ../styling#surfacing-styles
