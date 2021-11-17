---
title: Defining Routes
order: 2
---

# Defining Routes

Routes in remix can be defined two ways: by a filename convention inside of the "app/routes" directory or manually with the `routes` function in `remix.config.js`. For this getting started guide we'll just cover the conventional files, but check out the [Routing Guide](../guides/routing) to learn more about manual routes.

## Creating your first route

Create a file like "app/routes/gists.tsx". Then edit the file to look like this:

```tsx
import React from "react";

export default function Gists() {
  return (
    <div>
      <h2>Public Gists</h2>
    </div>
  );
}
```

Now visit [http://localhost:3000/gists](http://localhost:3000/gists). Not bad!

Let's add a link to this route from the "root" layout. Open up `app/root.tsx` and add the link:

```tsx
import { Link } from "react-router-dom";

// somewhere on the page:
<Link to="/gists">Gists</Link>;
```

That's it. Make a file, get a route.

## Meta tags

Meta tags are fundamental to the web so Remix makes it easy.

From your route component, export a `meta` function. From there, return an object with the "title" key and then any other meta tags you'd like to include, like the description. These will be server rendered and kept up-to-date as the user navigates around your app.

```tsx
export function meta() {
  return {
    title: "Public Gists",
    description: "View the latest gists from the public"
  };
}

export default function Gists() {
  // ...
}
```
