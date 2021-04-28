---
title: Loading Data
order: 3
---

Page data in Remix comes from a "loader" defined inside of your Route Module. While they live in the same file as the React Component, these loaders are only ever run server side. This means you can write sever side code right next to your component, like a direct connection to your database. Remix will remove the server-side code from the browser bundle, so you don't have to worry about it causing problems in the browser.

## Your First Loader

Inside of your `app/routes/gists.tsx` file, export a `loader` function that fetches the latest gists from the public:

```tsx [2, 4-6]
import React from "react";
import type { LoaderFunction } from "remix";

export let loader: LoaderFunction = () => {
  return fetch("https://api.github.com/gists");
};

export default function Gists() {
  /* ... */
}
```

## Accessing Data for a Route

Now that we have a loader in place, you can access that data with the `useRouteData` hook.

```tsx [3, 10-11]
import React from "react";
import type { LoaderFunction } from "remix";
import { useRouteData } from "remix";

export let loader: Loader = () => {
  return fetch("https://api.github.com/gists");
};

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

If you visit "/gists" you should see a list of gists in both the browser console and the terminal since we're server rendering in development.

## Built on the Web Fetch API

You might be scratching your head at that last bit. Why didn't we have to unwrap the fetch response with the usual `await res.json()`?

If you've been around the Node.js world for a while you'll recognize that there are many different versions of "request" and "response". The express API `req, res` is probably the most ubiquitous, but wherever you go it's always a little different.

When browsers shipped the Fetch API, they didn't just create a spec for `window.fetch`, but they also created a spec for what a fetch sends and returns, `Request`, `Headers`, and `Response`. [You can read about these APIs on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

Instead of coming up with our own API, we built Remix on top of the Web Fetch API. Loaders can return [Responses](https://developer.mozilla.org/en-US/docs/Web/API/Response/Response), like this:

```js
return new Response(JSON.stringify({ teapot: true }), {
  status: 418,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=3600"
  }
});
```

So back to our question, why didn't we have to await the fetch and then await the `res.json`? Because Remix awaits your loader, and `fetch` resolves to response, and Remix is expecting exactly that type of object.

## Response Helpers

Most of the time you'll want to use one of Remix's built-in response helpers in your loaders.

The `json` helper will deal with the content type automatically while still giving you control over the headers, status code, etc.

```js [1,5]
import { json } from "remix";

export let loader: Loader = () => {
  let arrayOfStuff = await db.query(someQuery);
  return json(arrayOfStuff);
};
```

Here's how you can indicate data-based a 404:

```tsx [6]
import { json } from "remix";

export let loader: Loader = ({ params }) => {
  let record = await findSomeRecord(params.id);
  if (record == null) {
    return json({ notFound: true }, { status: 404 });
  }
  return json(record);
};
```

## Other Return Values

You don't have to build up a full response or use a helper, loaders can return plain objects, you just lose control over your headers this way:

```ts
export let loader: LoaderFunction = () => {
  return { anything: "you want" };
};
```

## Rendering the Gists

Whew, okay, back to our app. Go ahead and map over that array however you'd like, here's a suggestion:

```tsx [6-12]
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

Bit lazy on the type there, but hopefully you'll forgive us! Alright, refresh and you should see a beautiful list of gists (a glist?).

## Data for Meta Tags

Like headers, meta tags pretty much always depend on data too, so Remix passes the data to your meta tag function. Open up `app/routes/gists.tsx` again and update your meta function:

```tsx
export function meta({ data }) {
  return {
    title: "Public Gists",
    description: `View the latest ${data.length} gists from the public`
  };
}
```

Now if somebody posts a link to this site on social media, the preview will include the description with that data-driven meta description 🙌.

## Finished Product

Here's the full code using all of the Route APIs we've introduced so far, as well as a quick type for a Gist.

```tsx
import React from "react";
import { useRouteData } from "remix";
import type { LoaderFunction } from "remix";

// Define the Gist type
interface Gist {
  id: string;
  html_url: string;
  files: {
    [fileName: string]: {
      filename: string;
      type: string;
      language: string;
      raw_url: string;
      size: number;
    };
  };
}

// Load data for this route and define some caching headers so that when the
// user navigates here multiple times it won't make the request more than once
// per 300 seconds
export let loader: LoaderFunction = () => {
  let res = await fetch("https://api.github.com/gists");
  let gists = await res.json();
  return json(gists, {
    headers: {
      "Cache-Control": "max-age=300"
    }
  });
};

// The title and meta tags for the document's <head>
export function meta({ data }: { data: Gist[] }) {
  return {
    title: "Public Gists",
    description: `View the latest ${data.length} gists from the public`
  };
}

// The HTTP headers for the server rendered request, just use the cache control
// from the loader.
export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")
  };
}

export default function Gists() {
  // useRouteData supports TypeScript generics so you can say what this hook
  // returns
  let data = useRouteData<Gist[]>();
  return (
    <div>
      <h2>Public Gists</h2>
      <ul>
        {data.map(gist => (
          <li key={gist.id}>
            <a href={gist.html_url}>{Object.keys(gist.files)[0]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```
