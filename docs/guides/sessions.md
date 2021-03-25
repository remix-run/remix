---
title: Sessions
---

Sessions are an important part of websites that allow the server to identify requests coming from the same person, especially when it comes to server-side form validation or when JavaScript is not on the page. Sessions are a fundamental building block of many sites that let users "log in", including social, e-commerce, business, and educational websites.

## Session storage

In Remix, sessions are managed on a per-route basis in your `loader` and `action` methods using a "session storage" object (that implements the `SessionStorage` interface). Session storage understands how to parse and generate cookies, and how to store session data in a database or filesystem.

Remix comes with several pre-built session storage options for common scenarios, but it's easy to create one as well to work with your database of choice.

For purely cookie-based sessions (where the session data itself is stored in the session cookie, see [cookies](../cookies)) you can use `createCookieSessionStorage()`. The main advantage of cookie session storage is that you don't need any additional backend services or databases to use it. It can also be beneficial in some load balanced scenarios. However, cookie-based sessions may not exceed the browser's max allowed cookie length (typically 4kb).

We recommend setting up your session storage object in `app/sessions.js` so all routes that need to access session data can import it from the same spot.

```js
// app/sessions.js
import { createCookieSessionStorage } from "@remix-run/data";

let { getSession, commitSession, destroySession } = createCookieSessionStorage({
  // This is either a Cookie (or a set of CookieOptions) that
  // describe the session cookie to use.
  cookie: {
    name: "__session",
    secrets: ["r3m1xr0ck5"],
    sameSite: "lax"
  }
});

export { getSession, commitSession, destroySession };
```

For file-backed sessions, use `createFileSessionStorage()`. File session storage requires a file system, but this should be readily available on most cloud providers. The advantage of file-backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a regular file on disk, so they are ideal for sessions with more than 4kb of data.

```js
// app/sessions.js
import { createCookie, createFileSessionStorage } from "@remix-run/data";

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

## Using sessions

Use the session storage object to get access sessions in your `loader` and `action` functions (see [mutations](../mutations)).

The input/output to a session storage object are HTTP cookies. `getSession()` retrieves the current session from the incoming request's `Cookie` header, and `commitSession()`/`destroySession()` provide the `Set-Cookie` header for the outgoing response.

A simple login form might look something like this:

```js
// app/routes/login.js
import { json, redirect } from "@remix-run/data";

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

## Creating a custom session storage

Remix makes it easy to store sessions in your own database if needed. The `createSessionStorage()` API requires a `cookie` (or options for creating a cookie, see [cookies](../cookies)) and a set of create, read, update, and delete (CRUD) methods for managing the session data. The cookie is used to persist the session ID.

The following example shows how you could do this using a generic database client:

```js
import { createSessionStorage } from "@remix-run/data";

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

// Use it:

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

## Session API

### `session.has()`

Returns `true` if the session has a variable with the given `name`.

```js
session.has("userId");
```

### `session.set()`

Sets a session value for use in subsequent requests:

```js
session.set("userId", "1234");
```

### `session.flash()`

Sets a session value that will be unset the first time it is read. After that, it's gone. Most useful for "flash messages" and server-side form validation messages:

```js
// app/routes/form.js
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

```js
// app/root.js
import React from "react";
import { Outlet } from "react-router-dom";
import { Meta, Links, Scripts } from "@remix-run/react";
import { json } from "@remix-run/data";

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
