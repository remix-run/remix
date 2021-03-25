---
title: Web Fetch API
---

While you may be familiar with the different http request/response APIs in server side JavaScript, you might not realize that when browsers added `window.fetch`, they also add three other objects: `Headers`, `Request`, and `Response`. When you do this:

```js
let res = await fetch(url);
```

That `res` is an instance of `Response`. And you can make a response yourself:

```js
let res = new Response(JSON.stringify({ hello: "there" }));
let json = await res.json();
console.log(json);
// { hello: "there" }
```

Rather than pick a server-side API, Remix adopt's the Web Fetch API for all http handling. Note that our deployment wrappers like `@remix-run/express` are simply adapters between the deployment server's API and the Web API. `@remix-run/express` interperets a Web API Response that you return from a loader or your server entry, into an express response to actually send from the server.

## Globally Available

Remix adds `Request`, `Response`, `Headers`, and `fetch` to your loader's global context, so you can use them anywhere just like in the browser. We figure if `"what".blink()` made it into the global context of node, we can add these browser globals to make Remix a little nicer to work with.

## MDN Docs

[https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

The MDN docs around `fetch` are pretty great, but they're a bit lacking on the other objects.
