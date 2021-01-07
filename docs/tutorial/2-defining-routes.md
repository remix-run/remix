---
title: Defining Routes
---

Routes in remix can be defined two ways: conventionally inside of the "app/routes" and "data/routes" folders or manually with `remix.config.routes`. For this getting started guide we'll just cover the conventional files, but check out the <Link to="/dashboard/docs/routing">Routing Guide</Link> to learn more about manual routes.

## Creating your first route

Create a file like "app/routes/gists.tsx". Then edit the file to look like this:

```jsx
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

Let's add a link to this route from the main application layout. Open up `app/App.js` and add the link:

```jsx
import { Link } from "react-router-dom";

// somewhere on the page:
<Link to="/gists">Gists</Link>;
```

That's it. Make a file, get a route. If you add a "." in the name, like `gists.public.js`, then the URL will be "gists/public". If you put it into a folder like `gists/public.js` then you're defining a nested route--which we'll talk about later in this tutorial.

## Meta tags

Meta tags are fundamental to the web so Remix makes it easy.

From your route component, export a `meta` function. From there, return an object with the "title" key and then any other meta tags you'd like to include, like the description. These will be server rendered and kept up-to-date as the user navigates around your app.

```jsx
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

## Headers

Each route can also define its http headers. This is mostly important for http caching. Remix doesn't rely on building your website into static files to be uploaded to a CDN for performance, instead we rely on cache headers. The end result of either approach is the same: a static document on a CDN. [Check out this video for more information on that](https://youtu.be/bfLFHp7Sbkg).

Usually, the difficulty with cache headers is configuring them. In Remix we've made it easy. Just export a `headers` function from your route.

```jsx
export function headers() {
  return {
    "cache-control": "public, max-age=300, s-max-age=3600"
  };
}

export function meta() {
  /* ... */
}

export default function Gists() {
  /* ... */
}
```

The max-age tells the user's browser to cache this for 300 seconds, or 5 minutes. That means if they click back or on a link to the same page again within 5 minutes, the browser won't even make a request for the page, it will use the cache.

The s-max-age tells the CDN to cache it for an hour. Here's what it looks like when the first person visits our website:

1. Request comes in to the website, which is really the CDN
2. CDN doesn't have the document cached, so it makes a request to our server (the "origin server").
3. Our server builds the page and sends it to the CDN
4. The CDN caches it and sends it to the visitor.

Now, when the next person visits our page, it looks like this:

1. Request comes to the CDN
2. CDN has the document cached already and sends it right away without ever touching our origin server!

We have a lot more to say about caching in the <Link to="/dashboard/cdn-caching">CDN Caching</Link> guide, make sure to read it sometime.

<hr/>

[Next up: Loading Data](/dashboard/docs/tutorial/loading-data)
