---
title: Route Module
---

A route in Remix is mostly a React component, with a couple extra exports.

## Component

The only required export of a route module is a React component. When the URL matches, the component will be rendered.

```jsx
export default function SomeRouteComponent() {
  return (
    <div>
      <h1>Look ma!</h1>
      <p>I'm still using React after like 7 years.</p>
    </div>
  );
}
```

## `headers`

Each route can define it's own HTTP headers. Perhaps the most important header is the "cache-control" header to indicate to browser and CDN caches how long this page is good for.

```jsx
export function headers({ loaderHeaders, parentHeaders }) {
  return {
    "x-stretchy-pants": "its for fun",
    "cache-control": "max-age=300, s-maxage=3600"
  };
}
```

Usually your data is a better indicator of your cache control than your route module (data tends to be more dynamic than markup), so the loader's headers are passed in to the route module:

```jsx
export function headers({ loaderHeaders, parentHeaders }) {
  return {
    "cache-control": loaderHeaders.get("cache-control")
  };
}
```

The headers arguments being passed in are instances of the [Web Fetch API](/dashboard/docs/fetch).

Because Remix has nested routes, there's a battle of the headers to be won when nested routes match. In this case, the deepest route wins. Consider these files in the routes directory:

```
├── users.js
└── users
    ├── $userId.js
    └── $userId
        └── profile.js
```

If we are looking at `/users/123/profile` then three routes are rendering:

```jsx
<Users>
  <UserId>
    <Profile />
  </UserId>
</Users>
```

If all three define headers, the deepest module wins, in this case `profile.js`.

We don't want surprise headers in your responses, so it's your job to merge them if you'd like. Remix passes in the `parentHeaders` to your headers function. So `users.js` headers get passed to `$userId.js`, and then `$userId.js` headers are passed to `profile.js` headers.

That is all to say that Remix has given you a very large gun with which to shoot your foot. You need to be careful not to send a cache control from a child route module that is more aggressive than a parent route. Here's some code that picks the least aggressive caching in these cases:

```jsx
import parseCacheControl from "parse-cache-control";

export function headers({ loaderHeaders, parentHeaders }) {
  let loaderCache = parseCacheControl(loaderHeaders.get("cache-control"));
  let parentCache = parseCacheControl(parentHeaders.get("cache-control"));

  // take the most conservative between the parent and loader, otherwise
  // we'll be too aggressive for one of them.
  let maxAge = Math.min(loaderCache["max-age"], parentCache["max-age"]);

  return {
    "cache-control": `max-age=${maxAge}`
  };
}
```

## `meta`

The meta export will set meta tags for your html document. We highly recommend setting the title and description on every route besides layout routes (their index route will set the meta).

```jsx
export function meta() {
  return {
    title: "Something cool",
    description: "This becomes the nice preview on search results."
  };
}
```

Title is a special case and will render a `<title>` tag, the rest render `<meta name={key} content={value}/>`.

In the case of nested routes, the meta tags are merged, so parent routes can add meta tags with the child routes needing to copy them.

## `links`

Coming soon, and you're going to love it.
