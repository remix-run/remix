---
title: MDX
description: Remix makes integrating MDX into your project a breeze with built in routes and "import" support.
---

While at Remix we believe that a strong separation of data and display is important, we understand that formats such as MDX have become a popular and powerful authoring format for developers.

Markdown / MDX support is provided by Remix through route modules and the `import` syntax.

## MDX Frontmatter

MDX support in Remix includes the ability to reference your frontmatter fields through the global "attributes" variable:

```mdx
---
componentData:
  label: Hello, World!
---

import SomeComponent from "~/components/some-component";

# Hello MDX!!!

<SomeComponent {...attributes.componentData} />
```

## Routes

The simplest way to get started with Markdown / MDX in Remix is to create a route module. Just like `.js` and `.ts` files in your `routes` directory, `.md` and `.mdx` will participate in automatic file system based routing.

### Route Frontmatter

Markdown / MDX routes allow you to define both meta and headers as if they were a code based route:

```md
---
meta:
  title: My First Post
  description: Isn't this awesome???
headers:
  Cache-Control: no-cache
---

# Hello Content!
```

### Example

By creating a `routes/posts/post-a.mdx` we can start writing a blog post:

```mdx
---
meta:
  title: My First Post
  description: Isn't this just awesome???
---

# Example Markdown Post

You can reference your frontmatter data through "attributes". The title of this post is {attributes.meta.title}!
```

## Modules

Besides just route level markdown / MDX, you can also import these files anywhere yourself as if it was a javascript module.

### Exports

- **default**: The react component for consumption.
- **attributes**: The frontmatter data as an object.
- **filename**: The basename of the source file (i.e "post-1.mdx")

### Example Blog Usage

`routes/index.jsx`

```tsx
import { useRouteData } from "remix";
import { Link } from "react-router-dom";

import * as postA from "./posts/a.mdx";
import * as postB from "./posts/b.md";
import * as postC from "./posts/c.md";

let postFromModule = mod => {
  return {
    slug: mod.filename.replace(/\.mdx?$/, ""),
    ...mod.attributes.meta
  };
};

export let loader = () => {
  // Only references the posts in the loader to avoid shipping
  // any of the components to the browser for this page.
  return [postFromModule(postA), postFromModule(postB), postFromModule(postC)];
};

export default function Index() {
  let posts = useRouteData();

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
