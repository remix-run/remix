---
title: "@remix-run/node"
---

This package provides the [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and helpers for Remix apps deployed to servers running Node.js. The underlying implementation of the Web Fetch API is [node-fetch](http://npm.im/node-fetch).

Remix can run in multiple environments like Node.js and Cloudflare Workers (soon). Each environment has its own implementation (and types) of the [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). Servers that share an environment all use the same Remix environment package. This means you can switch between hosts that run the same JavaScript environment (like Node.js) without changing any application code.

These APIs are primarily used in

- [loaders](../app/#loader)
- [actions](../app/#action)
- [entry.server.js](../app/#entryserverjs)

```ts
// Web Fetch API objects
import { Request, Response, Headers, fetch } from "@remix-run/node";

// Response Helpers
import { json, redirect } from "@remix-run/node";

// Cookies
import { createCookie } from "@remix-run/node";

// Sessions
import { createCookie } from "@remix-run/node";

// Types
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
```

# Response Helpers

## `json`

This is a shortcut for creating `application/json` responses. It assumes you are using `utf-8` encoding.

```ts [2,6]
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";

export let loader: LoaderFunction = () => {
  // So you can write this:
  return json({ any: "thing" });

  // Instead of this:
  return new Response(JSON.stringify({ any: "thing" }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
};
```

You can also pass a status code and headers:

```ts [4-9]
export let loader: LoaderFunction = () => {
  return json(
    { not: "coffee" },
    {
      status: 418,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
};
```

## `redirect`

This is shortcut for sending 30x responses.

```ts [2,8]
import { ActionFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export let action: ActionFunction = () => {
  let userSession = await getUserSessionOrWhatever();

  if (!userSession) {
    return redirect("/login");
  }

  return json({ ok: true });
};
```

By default it sends 302, but you can change it to whichever redirect status code you'd like:

```ts
redirect(path, 301);
redirect(path, 303);
```

You can also send a `ResponseInit` to set headers, like committing a session.

```ts
redirect(path, {
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});

redirect(path, {
  status: 302,
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});
```

Of course, you can do redirects without this helper if you'd rather build it up yourself:

```ts
// this is a shortcut...
return redirect("/else/where", 303);

// ...for this
return new Response("", {
  status: 303,
  headers: {
    Location: "/else/where"
  }
});
```

# Cookies

A [cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) is a small piece of information that your server sends someone in a HTTP response that their browser will send back on subsequent requests. This technique is a fundamental building block of many interactive websites that adds state so you can build authentication (see [sessions](#sessions)), shopping carts, user preferences, and many other features that require remembering who is "logged in".

Remix's `Cookie` interface provides a logical, reusable container for cookie metadata.

## Using cookies

While you may create these cookies manually, it is more common to use a [session storage](#sessions).

In Remix, you will typically work with cookies in your `loader` and/or `action` functions (see <Link to="../mutations">mutations</Link>) since those are the places where you need to read and write data.

Let's say you have a banner on your e-commerce site that prompts users to check out the items you currently have on sale. The banner spans the top of your homepage, and includes a button on the side that allows the user to dismiss the banner so they don't see it for at least another week.

First, create a cookie:

```js
// app/cookies.js
import { createCookie } from "@remix-run/node";

export let userPrefs = createCookie("user-prefs", {
  maxAge: 604_800 // one week
});
```

Then, you can `import` the cookie and use it in your `loader` and/or `action`. The `loader` in this case just checks the value of the user preference so you can use it in your component for deciding whether or not to render the banner. When the button is clicked, the `<form>` calls the `action` on the server and reloads the page without the banner.

**Note:** We recommend (for now) that you create all the cookies your app needs in `app/cookies.js` and `import` them into your route modules. This allows the Remix compiler to correctly prune these imports out of the browser build where they are not needed. We hope to eventually remove this caveat.

```js
// app/routes/index.js
import React from "react";
import { useRouteData } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";

import { userPrefs as cookie } from "../cookies";

export function loader({ request }) {
  let value = cookie.parse(request.headers.get("Cookie")) || {};
  let showBanner = "showBanner" in value ? value.showBanner : true;
  return { showBanner };
}

export async function action({ request }) {
  let value = cookie.parse(request.headers.get("Cookie")) || {};
  let bodyParams = new URLSearchParams(await request.text());

  if (bodyParams.get("bannerVisibility") === "hidden") {
    value.showBanner = false;
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": cookie.serialize(value)
    }
  });
}

export default function Home() {
  let { showBanner } = useRouteData();

  return (
    <div>
      {showBanner && (
        <div>
          <span>
            <Link to="../sale">Don't miss our sale!</Link>
          </span>
          <form method="POST">
            <button name="bannerVisibility" value="hidden">
              Hide
            </button>
          </form>
        </div>
      )}
      <h1>Welcome!</h1>
    </div>
  );
}
```

## Cookie attributes

Cookies have [several attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes) that control when they expire, how they are accessed, and where they are sent. Any of these attributes may be specified either in `createCookie(name, options)`, or during `serialize()` when the `Set-Cookie` header is generated.

```js
let cookie = createCookie("user-prefs", {
  // These are defaults for this cookie.
  domain: "remix.run",
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: true,
  expires: new Date(Date.now() + 60),
  maxAge: 60
});

// You can either use the defaults:
cookie.serialize(userPrefs);

// Or override individual ones as needed:
cookie.serialize(userPrefs, { sameSite: "strict" });
```

Please read [more info about these attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes) to get a better understanding of what they do.

## Signing cookies

It is possible to sign a cookie to automatically verify its contents when it is received. Since it's relatively easy to spoof HTTP headers, this is a good idea for any information that you do not want someone to be able to fake, like authentication information (see [sessions](../sessions)).

To sign a cookie, provide one or more `secrets` when you first create the cookie:

```js
let cookie = createCookie("user-prefs", {
  secrets: ["s3cret1"]
});
```

Cookies that have one or more `secrets` will be stored and verified in a way that ensures the cookie's integrity.

Secrets may be rotated by adding new secrets to the front of the `secrets` array. Cookies that have been signed with old secrets will still be decoded successfully in `cookie.parse()`, and the newest secret (the first one in the array) will always be used to sign outgoing cookies created in `cookie.serialize()`.

```js
// app/cookies.js
let cookie = createCookie("user-prefs", {
  secrets: ["n3wsecr3t", "olds3cret"]
});

// in your route module...
export function loader({ request }) {
  let oldCookie = request.headers.get("Cookie");
  // oldCookie may have been signed with "olds3cret", but still parses ok
  let value = cookie.parse(oldCookie);

  new Response("...", {
    headers: {
      // Set-Cookie is signed with "n3wsecr3t"
      "Set-Cookie": cookie.serialize(value)
    }
  });
}
```

## `createCookie`

Creates a logical container for managing a browser cookie from there server.

```ts
import { createCookie } from "@remix-run/node";

let cookie = createCookie("cookie-name", {
  // all of these are optional defaults that can be overridden at runtime
  domain: "remix.run",
  expires: new Date(Date.now() + 60),
  httpOnly: true,
  maxAge: 60,
  path: "/",
  sameSite: "lax",
  secrets: ["s3cret1"],
  secure: true
});
```

To learn more about each attribute, please see the [MDN Set-Cookie docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes).

## `isCookie`

Returns `true` if an object is a Remix cookie container.

```ts
import { isCookie } from "@remix-run/node";
let cookie = createCookie("user-prefs");
console.log(isCookie(cookie));
// true
```

## Cookie API

A cookie container is returned from `createCookie` and has handful of properties and methods.

```ts
let cookie = createCookie(name);
cookie.name;
cookie.parse();
// etc.
```

### `cookie.name`

The name of the cookie, used in `Cookie` and `Set-Cookie` HTTP headers.

### `cookie.parse()`

Extracts and returns the value of this cookie in a given `Cookie` header.

```js
let value = cookie.parse(request.headers.get("Cookie"));
```

### `cookie.serialize()`

Serializes a value and combines it with this cookie's options to create a `Set-Cookie` header, suitable for use in an outgoing `Response`.

```js
new Response("...", {
  headers: {
    "Set-Cookie": cookie.serialize({ showBanner: true })
  }
});
```

### `cookie.isSigned`

Will be `true` if the cookie uses any `secrets`, `false` otherwise.

```js
let cookie = createCookie("user-prefs");
console.log(cookie.isSigned); // false

cookie = createCookie("user-prefs", { secrets: ["soopersekrit"] });
console.log(cookie.isSigned); // true
```

### `cookie.expires`

The `Date` on which this cookie expires. Note that if a cookie has both `maxAge` and `expires`, this value will the date at the current time plus the `maxAge` value since `Max-Age` takes precedence over `Expires`.

```js
let cookie = createCookie("user-prefs", {
  expires: new Date("2021-01-01")
});

console.log(cookie.expires); // "2020-01-01T00:00:00.000Z"
```

# Sessions

Sessions are an important part of websites that allow the server to identify requests coming from the same person, especially when it comes to server-side form validation or when JavaScript is not on the page. Sessions are a fundamental building block of many sites that let users "log in", including social, e-commerce, business, and educational websites.

In Remix, sessions are managed on a per-route basis (rather than something like express middleware) in your `loader` and `action` methods using a "session storage" object (that implements the `SessionStorage` interface). Session storage understands how to parse and generate cookies, and how to store session data in a database or filesystem.

Remix comes with several pre-built session storage options for common scenarios and one to create your own:

- `createCookieSessionStorage`
- `createFileSessionStorage`
- `createMemorySessionStorage`
- custom storage with `createSessionStorage`

## Using Sessions

This is an example of a cookie session storage:

```js filename=app/sessions.js
// app/sessions.js
import { createCookieSessionStorage } from "@remix-run/node";

let { getSession, commitSession, destroySession } = createCookieSessionStorage({
  // a Cookie from `createCookie` or the CookieOptions to create one
  cookie: {
    name: "__session",

    // all of these are optional
    domain: "remix.run",
    expires: new Date(Date.now() + 60),
    httpOnly: true,
    maxAge: 60,
    path: "/",
    sameSite: "lax",
    secrets: ["s3cret1"],
    secure: true
  }
});

export { getSession, commitSession, destroySession };
```

We recommend setting up your session storage object in `app/sessions.js` so all routes that need to access session data can import from the same spot (also, see our [Route Module Constraints](../constraints/)).

The input/output to a session storage object are HTTP cookies. `getSession()` retrieves the current session from the incoming request's `Cookie` header, and `commitSession()`/`destroySession()` provide the `Set-Cookie` header for the outgoing response.

You'll use methods to get access to sessions in your `loader` and `action` functions.

A login form might look something like this:

```js filename=app/routes/login.js lines=2,5,7,12,16,22,31,36,41,46
import { json, redirect } from "@remix-run/node";
import { getSession, commitSession } from "../sessions";

export async function loader({ request }) {
  let session = await getSession(request.headers.get("Cookie"));

  if (session.has("userId")) {
    // Redirect to the home page if they are already signed in.
    return redirect("/");
  }

  let data = { error: session.get("error") };

  return json(data, {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
}

export async function action({ request }) {
  let session = await getSession(request.headers.get("Cookie"));
  let bodyParams = new URLSearchParams(await request.text());

  let userId = await validateCredentials(
    bodyParams.get("username"),
    bodyParams.get("password")
  );

  if (userId == null) {
    session.flash("error", "Invalid username/password");

    // Redirect back to the login page with errors.
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session)
      }
    });
  }

  session.set("userId", userId);

  // Login succeeded, send them to the home page.
  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
}

export default function Login() {
  let { currentUser, error } = useRouteData();

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <form method="POST">
        <div>
          <p>Please sign in</p>
        </div>
        <label>
          Username: <input type="text" name="username" />
        </label>
        <label>
          Password: <input type="password" name="password" />
        </label>
      </form>
    </div>
  );
}
```

## Session Gotchas

Because of nested routes, multiple loaders can be called to construct a single page. When using `session.flash()` or `session.unset()`, you

## `createSession`

TODO:

## `isSession`

TODO:

## `createSessionStorage`

Remix makes it easy to store sessions in your own database if needed. The `createSessionStorage()` API requires a `cookie` (or options for creating a cookie, see [cookies](#cookies)) and a set of create, read, update, and delete (CRUD) methods for managing the session data. The cookie is used to persist the session ID.

The following example shows how you could do this using a generic database client:

```js
import { createSessionStorage } from "@remix-run/node";

function createDatabaseSessionStorage({ cookie, host, port }) {
  // Configure your database client...
  let db = createDatabaseClient(host, port);

  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      // `expires` is a Date after which the data should be considered
      // invalid. You could use it to invalidate the data somehow or
      // automatically purge this record from your database.
      let id = await db.insert(data);
      return id;
    },
    async readData(id) {
      return (await db.select(id)) || null;
    },
    async updateData(id, data, expires) {
      await db.update(id, data);
    },
    async deleteData(id) {
      await db.delete(id);
    }
  });
}
```

And then you can use it like this:

```js
let {
  getSession,
  commitSession,
  destroySession
} = createDatabaseSessionStorage({
  host: "localhost",
  port: 1234,
  cookie: {
    name: "__session",
    sameSite: "lax"
  }
});
```

The `expires` argument to `readData` and `updateData` is the same `Date` at which the cookie itself expires and is no longer valid. You can use this information to automatically purge the session record from your database to save on space, or to ensure that you do not otherwise return any data for old, expired cookies.

## `createCookieSessionStorage`

For purely cookie-based sessions (where the session data itself is stored in the session cookie with the browser, see [cookies](../cookies)) you can use `createCookieSessionStorage()`.

The main advantage of cookie session storage is that you don't need any additional backend services or databases to use it. It can also be beneficial in some load balanced scenarios. However, cookie-based sessions may not exceed the browser's max allowed cookie length (typically 4kb).

```js
import { createCookieSessionStorage } from "@remix-run/node";

let { getSession, commitSession, destroySession } = createCookieSessionStorage({
  // a Cookie from `createCookie` or the same CookieOptions to create one
  cookie: {
    name: "__session",
    secrets: ["r3m1xr0ck5"],
    sameSite: "lax"
  }
});
```

## `createFileSessionStorage`

For file-backed sessions, use `createFileSessionStorage()`. File session storage requires a file system, but this should be readily available on most cloud providers that run express, maybe with some extra configuration.

The advantage of file-backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a regular file on disk, ideal for sessions with more than 4kb of data.

<docs-info>If you are deploying to a serverless function, ensure you have access to a persistent file system. They usually don't have one without extra configuration.</docs-info>

```js
// app/sessions.js
import { createCookie, createFileSessionStorage } from "@remix-run/node";

// In this example the Cookie is created separately.
let sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true
});

let { getSession, commitSession, destroySession } = createFileSessionStorage({
  // The root directory where you want to store the files.
  // Make sure it's writable!
  dir: "/app/sessions",
  cookie: sessionCookie
});

export { getSession, commitSession, destroySession };
```

## `createMemorySessionStorage`

This storage keeps all the cookie information in your server's memory.

<docs-error>This should only be used in development. Use one of the other methods in production.</docs-error>

```js
// app/sessions.js
import { createCookie, createFileSessionStorage } from "@remix-run/node";

// In this example the Cookie is created separately.
let sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true
});

let { getSession, commitSession, destroySession } = createFileSessionStorage({
  // The root directory where you want to store the files.
  // Make sure it's writable!
  dir: "/app/sessions",
  cookie: sessionCookie
});

export { getSession, commitSession, destroySession };
```

## Session API

After retrieving a session with `getSession`, the session object returned has a handful of methods and properties:

```js [2]
export async function action({ request }) {
  let session = await getSession(request.headers.get("Cookie"));
  session.get("foo");
  session.has("bar");
  // etc.
}
```

### `session.has(key)`

Returns `true` if the session has a variable with the given `name`.

```js
session.has("userId");
```

### `session.set(key, value)`

Sets a session value for use in subsequent requests:

```js
session.set("userId", "1234");
```

### `session.flash(key, value)`

Sets a session value that will be unset the first time it is read. After that, it's gone. Most useful for "flash messages" and server-side form validation messages:

```js [7-10,14]
import { getSession, commitSession } from "../sessions";

export async function action({ request, params }) {
  let session = await getSession(request.headers.get("Cookie"));
  let deletedProject = await archiveProject(params.projectId);

  session.flash(
    "globalMessage",
    `Project ${deletedProject.name} successfully archived`
  );

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
}
```

Now we can read the message in a loader.

<docs-info>You must commit the session whenever you read a `flash`. This is different than you might be used to where some type of middleware automatically sets the cookie header for you.</docs-info>

```js [9,10,19,26,35]
import React from "react";
import { Outlet } from "react-router-dom";
import { Meta, Links, Scripts } from "@remix-run/react";
import { json } from "@remix-run/node";

import { getSession, commitSession } from "./sessions";

export async function loader({ request }) {
  let session = await getSession(request.headers.get("Cookie"));
  let message = session.get("globalMessage") || null;

  return json(
    { message },
    {
      headers: {
        // When working with flash messages, it's important to remember
        // to commit the session after a session.get() because the session
        // contents have changed!
        "Set-Cookie": await commitSession(session)
      }
    }
  );
}

export default function App() {
  let { message } = useRouteData();

  return (
    <html>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        {message && <div className="flash">{message}</div>}
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```

### `session.get()`

Accesses a session value from a previous request:

```js
session.get("name");
```

### `session.unset()`

Removes a value from the session.

```js
session.unset("name");
```

<docs-info>You must commit the session whenever you `unset`</docs-info>

```js
return json(data, {
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});
```
