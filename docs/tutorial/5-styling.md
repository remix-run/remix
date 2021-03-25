---
title: Styling
order: 5
---

Two of the hardest parts of CSS have always been:

- Writing styles that don't apply to unintended elements and
- Knowing which styles you need for a page.

Using the route module `links` API, we can solve these problems easily.

## Adding styles to our gists routes

Go ahead and add the stylesheets `styles/team.css` and `styles/team.$member.css` and add whatever styles you want. The file names aren't important.

Now open up `routes/team.tsx` and add this:

```tsx [1,2]
import type { LinksFunction } from "@remix-run/react";
import styles from "url:../styles/team.css";

let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};
```

With the `url:` syntax, Remix will emit that asset to your browser build directory and fingerprint the file name for easy caching in production. The `styles` value is now a url string pointing to the asset.

The `links` export tells Remix which `<link>` tags to add to the document when this page is active (and which to remove when its not). Combining these two features we can add any stylesheets we want when this route is active, and automatically remove them when it's not.

Now go do the same in `routes/team/$member.tsx`:

```tsx [3,5-7]
import type { LinksFunction } from "@remix-run/react";

import styles from "url:../../styles/team.$member.css";

let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};
```

When you're done, open the dev tools and watch the `<head>` component as you navigate around. You'll see the styles loading and unloading per route!

Since we're always using `<link>` to add styles, we don't have a different code path for your styles in development vs. production like a lot of solutions. Also, your styles also always apply in the same order (order of your nested routes), so your dynamic style loading isn't at risk of applying in the wrong order like some dynamic css loading techniques cause.

Remix supports [several different styling options](../../styling), so go ahead and pick your favorite and we'll make sure to load and unload your CSS when the time is right!
