---
title: Web Fetch API
---

# Web Fetch API

When browsers added `window.fetch`, they also add three other objects: `Headers`, `Request`, and `Response`. Remix is built upon this API.

When you do this:

```js
const res = await fetch(url);
```

That `res` is an instance of `Response`. And you can make a response yourself:

```js
const res = new Response(
  JSON.stringify({ hello: "there" })
);
const json = await res.json();
console.log(json);
// { hello: "there" }
```

Rather than pick a server-side API, Remix adopts the Web Fetch API for all http handling. Note that our deployment wrappers like `@remix-run/express` are simply adapters between the deployment server's API and the Web API. `@remix-run/express` interperets a Web API Response that you return from a loader or your server entry into an express response.

While you can use these APIs directly in Remix, you'll typically use response helpers instead:

- [json](../api/remix#json)
- [redirect](../api/remix#redirect)

## Globally Available

Remix adds `Request`, `Response`, `Headers`, and `fetch` to your loader's global context, so you can use them anywhere just like in the browser. We figure if `"what".blink()` made it into the global context of node, we can add these browser globals to make Remix a little nicer to work with.

## MDN Docs

[https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
