---
title: MDX
description: Remix makes integrating MDX into your project a breeze with built in routes and "import" support.
---

# MDX

While we believe that a strong separation of data and display is important, we understand that formats that mix the two such as [MDX](https://mdxjs.com/) (Markdown with embedded JSX components) have become a popular and powerful authoring format for developers.

Remix supports using MDX in two ways:

- You can use a `.mdx` file as one of your route modules
- You can `import` a `.mdx` file into one of your route modules (in `app/routes`)

## Routes

The simplest way to get started with MDX in Remix is to create a route module. Just like `.js` and `.ts` files in your `app/routes` directory, `.mdx` (and `.md`) files will participate in automatic file system based routing.

MDX routes allow you to define both meta and headers as if they were a code based route:

```md
---
meta:
  title: My First Post
  description: Isn't this awesome?
headers:
  Cache-Control: no-cache
---

# Hello Content!
```

The lines in the document above between the `---` are called "frontmatter". You can think of them like metadata for your document, formatted as [YAML](https://yaml.org/).

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

By creating a `app/routes/posts/first-post.mdx` we can start writing a blog post:

```mdx
---
meta:
  title: My First Post
  description: Isn't this just awesome?
---

# Example Markdown Post

You can reference your frontmatter data through "attributes". The title of this post is {attributes.meta.title}!
```

## Modules

Besides just route level MDX, you can also import these files anywhere yourself as if it were a regular JavaScript module.

When you `import` a `.mdx` file, the exports of the module are:

- **default**: The react component for consumption
- **attributes**: The frontmatter data as an object
- **filename**: The basename of the source file (e.g. "first-post.mdx")

```tsx
import Component, {
  attributes,
  filename
} from "./first-post.mdx";
```

## Example Blog Usage

The following example demonstrates how you might build a simple blog with MDX, including individual pages for the posts themselves and an index page that shows all posts.

In `app/routes/index.jsx`:

```tsx
import { useLoaderData } from "remix";
import { Link } from "react-router-dom";

// Import all your posts from the app/routes/posts directory. Since these are
// regular route modules, they will all be available for individual viewing
// at /posts/a, for example.
import * as postA from "./posts/a.mdx";
import * as postB from "./posts/b.md";
import * as postC from "./posts/c.md";

function postFromModule(mod) {
  return {
    slug: mod.filename.replace(/\.mdx?$/, ""),
    ...mod.attributes.meta
  };
}

export function loader() {
  // Return metadata about each of the posts for display on the index page.
  // Referencing the posts here instead of in the Index component down below
  // lets us avoid bundling the actual posts themselves in the bundle for the
  // index page.
  return [
    postFromModule(postA),
    postFromModule(postB),
    postFromModule(postC)
  ];
}

export default function Index() {
  const posts = useLoaderData();

  return (
    <ul>
      {posts.map(post => (
        <li key={post.slug}>
          <Link to={post.slug}>{post.title}</Link>
          {post.description && <p>{post.description}</p>}
        </li>
      ))}
    </ul>
  );
}
```

Clearly this is not a scalable solution for a blog with thousands of posts. First, you need to admit to yourself that you're not even going to write ten posts, let alone thousands, and move on. Next, if you get to 100 posts (congratulations!), we suggest you rethink your strategy and turn your posts into data stored in a database so that you don't have to rebuild and redeploy your blog every time you fix a typo. You can even keep using MDX with [MDX Bundler](https://github.com/kentcdodds/mdx-bundler).

## Advanced Configuration

If you wish to configure your own remark plugins you can do so through the `remix.config.js`'s `mdx` export:

```js
const {
  remarkMdxFrontmatter
} = require("remark-mdx-frontmatter");

// can be an sync / async function or an object
exports.mdx = async filename => {
  const [rehypeHighlight, remarkToc] = await Promise.all([
    import("rehype-highlight").then(mod => mod.default),
    import("remark-toc").then(mod => mod.default)
  ]);

  return {
    remarkPlugins: [remarkToc],
    rehypePlugins: [rehypeHighlight]
  };
};
```
