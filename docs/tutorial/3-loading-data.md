---
title: Loading Data
---

Page data in Remix comes from "loaders" inside of "data modules". These loaders are only ever run server side so you can use whatever node modules you need to load data, including a direct connection to your database.

If you name a data module the same as an app route, Remix will automatically call the loader in the data module before rendering, passing that data to your route.

## Accessing data for a route

Even though we haven't created a loader yet, we can still ask for the data at a route as if we had one and we'll get `null`.

Open up `app/routes/gists.ts`, then console log the data prop to see it using the `useRouteData` hook.

```jsx
import React from "react";
import { useRouteData } from "@remix-run/react";

export default function Gists() {
  let data = useRouteData();
  console.log(data);
  return (
    <div>
      <h2>Public Gists</h2>
    </div>
  );
}
```

If you visit "/gists" you should see `null` in the console (in both the browser and the terminal since we're server rendering in development).

## Your First Loader

Now let's make the loader. Create the file `loaders/routes/gists.ts` and put this in it.

```js
import type { Loader } from "@remix-run/data";

let loader: Loader = () => {
  return fetch("https://api.github.com/gists");
};

export { loader };
```

Refresh the browser at "/gists" and you should see a bunch of gists in the console!

## Built on the Web Fetch API

You might be scratching your head at that last bit. Why didn't we have to unwrap the fetch response with the usual `await res.json()`?

If you've been around the Node.js world for a while you'll recognize that there are many different versions of "request" and "response". The express API `req, res` is probably the most ubiquitous, but wherever you go it's always a little different.

When browsers shipped the Fetch API, they didn't just create a spec for `window.fetch`, but they also created a spec for what a fetch sends and returns, `Request`, `Headers`, and `Response`. [You can read about these APIs on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

Instead of coming up with our own API, we built Remix on top of the Web Fetch API. Loaders can return [Responses](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response), like this:

```js
return new Response(JSON.stringify({ teapot: true }), {
  status: 418,
  headers: {
    "content-type": "application/json",
    "cache-control": "max-age=3600"
  }
});
```

So back to our question, why didn't we have to await the fetch and then await the `res.json`? Because Remix awaits your loader, and `fetch` resolves to response, and Remix is expecting exactly that type of object.

## Other return values

You don't have to built up a full response, loaders can return plain objects, you just lose control over your headers this way:

```js
const db = require("../db");
module.exports = async () => {
  let arrayOfStuff = await db.query(someQuery);
  return arrayOfStuff();
};
```

Remix also has a json helper so you can set headers without having to worry about the content type and stringifying the body, etc. This is likely your bread and butter.

```js
const { json } = require("@remix-run/loader");

module.exports = async () => {
  let arrayOfStuff = await db.query(someQuery);

  return json(arrayOfStuff, {
    "cache-control": "max-age=60"
  });
};
```

## Why cache-control headers matter in loaders:

We saw that our routes can define their cache control, so why does it matter for loaders? It matters for two reasons:

First, your data usually knows better what the cache control should be than your route because the data changes more often than the markup. Because of this, the loader's headers are passed to the route's header function.

Open up `app/routes/gists.ts` and update your headers function like so:

```jsx
export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return {
    "cache-control": loaderHeaders.get("cache-control")
  };
}
```

The `loaderHeaders` object is an instance of the [Web Fetch API Headers constructor](https://developer.mozilla.org/en-US/docs/Web/API/Headers)

Now when the browser or a CDN wants to cache our page, it gets the headers from our data source, which is usually what you want. Note in our case we're actually just using headers GitHub sent in the response from our fetch!

The second reason this matters is that Remix calls your loaders via `fetch` in the browser on client side transitions. By returning good cache headers here, when the user clicks back/forward or visits the same page multiple times, the browser won't actually make another request for the data but will use a cached version instead. This greatly speeds up a website's performance, even for pages that you can't cache on a CDN. A lot of React apps rely on a JavaScript cache, but browser caches already work great!

## Rendering the gists

Whew, okay, back to our app. Go ahead and map over that array however you'd like, here's a suggestion:

```jsx
// ...
export default function Gists() {
  let data = useRouteData();
  return (
    <div>
      <h2>Public Gists</h2>
      <ul>
        {data.map((gist: any) => (
          <li key={gist.id}>
            <a href={gist.html_url}>{Object.keys(gist.files)[0]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Bit lazy on the type there, but hopefully you'll forgive us! Alright, refresh and you should see a beautiful list of gists (glist?).

## Data for meta tags

Like headers, meta tags pretty much always depend on data too, so Remix passes the data to your meta tag function. Open up `app/routes/gists.tsx` again and update your meta function:

```jsx
export function meta({ data }) {
  return {
    title: "Public Gists",
    description: `View the latest ${data.length} gists from the public`
  };
}
```

Now if somebody posts a link to this site on social media, the preview will include the description with that data-driven meta description 🙌.

---

[Next up: Nested Routes and Params](/dashboard/docs/nested-routes-params)
