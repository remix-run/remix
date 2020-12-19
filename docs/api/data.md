---
title: "@remix-run/loader"
---

This package is to be included only by files located inside of your `data/` directory. You may want to reference the [Remix and Web Fetch API](./fetch.md) page as well.

The files in `data/routes` can define a loader, an action, or both. You'll use exports from "@remix-run/data" in these functions. For example, if you have a file like this, the `loader` will get called for "get" requests and the "action" will get called for everything else from a `<Form>` (like "post", "put", and "delete").

```ts
import type { Loader, Action } from "@remix-run/data";

// get requests
let loader: Loader = () => {};

// everything else
let action: Action = () => {};

export { loader, action };
```

## Loaders

Remix passes some arguments to your loaders, then you return an object or a response.

```js
let loader: Loader = ({ params, request, session, context }) => {
  return objectOrResponse;
};
```

## Loader arg: params

Route params are passed to your loader. If you have a loader at `data/invoices/$invoiceId.js` then Remix will parse out the `invoiceId` and pass it to your loader. This is useful for fetching data from an API or database.

```js
// if the user visits /invoices/123
let loader: Loader = ({ params }) => {
  params.invoiceId; // "123"
};
```

## Loader arg: request

This is a [Web API Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) instance with information about the request. You can read the MDN docs to see all of it's properties.

You can also use this to read URL [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) from the request like so:

```js
// say the user is at /some/route?foo=bar
let loader: Loader = ({ request }) => {
  let url = new URL(request.url);
  let foo = url.searchParams.get("foo");
};
```

## Loader arg: session

Coming soon.

## Loader arg: context

This is the context you passed in to your deployment wrapper's `getLoaderContext()` function. It's a way to bridge the gap between the platform's request/response API with your remix app.

Say your express server (or your serverless function handler) looks something like this:

```js
const { createRequestHandler } = require("@remix-run/express");

app.all(
  "*",
  createRequestHandler({
    getLoaderContext(req, res) {
      // this becomes the loader context
      return { req, res };
    }
  })
);
```

And then your loader can access it.

```ts
// data/some-loader.js
let loader: Loader = ({ context }) => {
  let { req } = context.req;
  // read a cookie
  req.cookies.session;
};
```

## Returning objects

You can return plain JavaScript objects from your loaders that will be made available to your [route modules](./route-module.md)

```ts
// some fake database, not part of remix
let db = require("../db");

let loader: Loader = async () => {
  let users = await db.query("users");
  return users;
};
```

## Returning Response Instances

You can return Web API Response objects from your loaders. Here's a pretty basic JSON response:

```js
// some fake database, not part of remix
import db from "../db";

let loader: Loader = async () => {
  let users = await db.query("users");

  let body = JSON.stringify(users);

  return new Response(body, {
    headers: {
      "content-type": "application/json"
    }
  });
};
```

See also:

- <Link to="../fetch">Remix Web Fetch API</Link>
- [MDN Response Docs](https://developer.mozilla.org/en-US/docs/Web/API/Response)

## Response Headers

As you saw earlier, you can return plain objects from loaders. Remix takes that object and turns it into a Response. However, you lose the ability to set headers and status codes.

For example, let's say you're fetching versioned information from your database. This data never changes, you can tell the client and CDNs to cache that forever.

Let's say this is the loader for the route `/contracts/$name/$version` and it's a publically available page:

```js
import db from "../db";

let loader: Loader = async ({ params }) => {
  // version 1 of the contract will never change
  let contract = await db.query(`
    select * from contracts
    where name = '${params.name}'
    and version = '${params.version}'
  `);

  let body = JSON.stringify(contract);

  return new Response(body, {
    headers: {
      // cache that sucker for a year for everybody
      "cache-control": "public, max-age=31540000000",
      "content-type": "application/json"
    }
  });
};
```

This response can then be cached by the user's browser and your CDN pretty much forever. After the first visitor requests it, the CDN caches the response. Now, when any other user requests it, the CDN sends the cached response without ever hitting your server.

## Response Status Codes

Loaders can return Responses with status codes. The initial HTML document will return the status code of the first non-200 data loader in the nested routes.

This is very useful for "not found" data making it's way all the way down to the browser's UI with a real 404 status code, 500s, etc.

```js
let loader: Loader = async ({ params }) => {
  let res = db.query("users").where("id", "=", "_why");
  if (res === null) {
    return new Response("not found", {
      status: 404
    });
  } else {
    return res;
  }
};
```

This is also very useful for 500 error handling. You don't need to render a different page, instead, handle the error, send the data, and send a 500 response to the app.

```js
let loader: Loader = async () => {
  try {
    let stuff = await something();
  } catch (error) {
    let body = JSON.stringify({ error: true, message: error.message });
    return new Response(body, {
      status: 500,
      headers: {
        "content-type": "application/json"
      }
    });
  }
};
```

Now your route component can deal with it:

```jsx
export default function Something() {
  let data = useRouteData();

  if (data.error) {
    return <ErrorMessage>{data.message}</ErrorMessage>;
  }
  // ...
}
```

The initial server render will get a 500 for this page, and client side transitions will get it also.

## `json`

This is a shortcut for creating `application/json` responses.

```ts
import { json } from "@remix-run/loader";

let loader: Loader = () => {
  // basic
  return json({ any: "thing " });
};
```

You can also pass a status code and headers:

```js
import { json } from "@remix-run/loader";

let loader: Loader = () => {
  return json(
    { not: "coffee" },
    {
      status: 418,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
};
```

## Actions

Data modules can export an `action` function that will be called when a `<Form>` is submit with a "post", "put", "patch", or "delete" method. They are how you handle data mutations.

See the <Link to="../mutations">Mutations Guide</Link> for more information.

They receive all the same arguments as loaders: `{ params, request, session, context }`, however they must return a redirect

```ts
import type { Action } from "@remix-run/data";
import { redirect, request } from "@remix-run/data";

let action: Action = async ({ params, request, session, context }) => {
  let body = parseFormBody(request);
  let newThing = await saveStuff(body);
  return redirect(`/stuff/${newThing.id}`);
};
```

## `parseFormBody`

Reads the form data from a form post, put, patch, or delete request. Returns a [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) for `application/x-www-urlencoded` requests and [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) for `multipart/form-data` requests.

Currently we only support `application/x-www-urlencoded` requests, but in the future we'll also support `multipart/form-data`.

```jsx
// some form
<Form method="post">
  <input name="title" value="hello" />
  <input name="description" value="some description" />
</Form>
```

```js
// some loader
const { parseFormBody } = require("@remix-run/loader");

exports.action = ({ request }) => {
  let body = parseFormBody(request);
  body.get("title"); // "hello"
  body.get("description"); // "some description"

  let obj = Object.fromEntries(body);
  obj.title; // "hello"
  obj.description; // "some description"
};
```

If you are using checkboxes with the same name or `<select multiple>` (that's pretty old school!), be careful with `Object.fromEntries` because it'll only take the last value:

```jsx
<Form>
  <input type="checkbox" name="ingredients" value="flour" checked />
  <input type="checkbox" name="ingredients" value="water" checked />
  <input type="checkbox" name="ingredients" value="egg" checked />
</Form>
```

```js
let action: Action = async ({ request }) => {
  let body = parseFormBody(request);

  // 🚫 oops!
  let obj = Object.fromEntries(body);
  obj.ingredients; // "flour"

  // ✅ iterate to get all of them
  let ingredients = [];
  for (let [key, value] of body) {
    if (key === "ingredients") {
      ingredients.push(value);
    }
  }
  ingredients; // ["flour", "water", "egg"]
};
```
