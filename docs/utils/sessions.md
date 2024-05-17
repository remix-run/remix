---
title: Sessions
---

# Sessions

Sessions are an important part of websites that allow the server to identify requests coming from the same person, especially when it comes to server-side form validation or when JavaScript is not on the page. Sessions are a fundamental building block of many sites that let users "log in", including social, e-commerce, business, and educational websites.

In Remix, sessions are managed on a per-route basis (rather than something like express middleware) in your `loader` and `action` methods using a "session storage" object (that implements the `SessionStorage` interface). Session storage understands how to parse and generate cookies, and how to store session data in a database or filesystem.

Remix comes with several pre-built session storage options for common scenarios, and one to create your own:

- `createCookieSessionStorage`
- `createMemorySessionStorage`
- `createFileSessionStorage` (node)
- `createWorkersKVSessionStorage` (Cloudflare Workers)
- `createArcTableSessionStorage` (architect, Amazon DynamoDB)
- custom storage with `createSessionStorage`

## Using Sessions

This is an example of a cookie session storage:

```ts filename=app/sessions.ts
// app/sessions.ts
import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno

type SessionData = {
  userId: string;
};

type SessionFlashData = {
  error: string;
};

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData, SessionFlashData>(
    {
      // a Cookie from `createCookie` or the CookieOptions to create one
      cookie: {
        name: "__session",

        // all of these are optional
        domain: "remix.run",
        // Expires can also be set (although maxAge overrides it when used in combination).
        // Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
        //
        // expires: new Date(Date.now() + 60_000),
        httpOnly: true,
        maxAge: 60,
        path: "/",
        sameSite: "lax",
        secrets: ["s3cret1"],
        secure: true,
      },
    }
  );

export { getSession, commitSession, destroySession };
```

We recommend setting up your session storage object in `app/sessions.ts` so all routes that need to access session data can import from the same spot (also, see our [Route Module Constraints][constraints]).

The input/output to a session storage object are HTTP cookies. `getSession()` retrieves the current session from the incoming request's `Cookie` header, and `commitSession()`/`destroySession()` provide the `Set-Cookie` header for the outgoing response.

You'll use methods to get access to sessions in your `loader` and `action` functions.

A login form might look something like this:

```tsx filename=app/routes/login.tsx lines=[8,13-15,17,22,26,34-36,47,52,57,62]
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

import { getSession, commitSession } from "../sessions";

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );

  if (session.has("userId")) {
    // Redirect to the home page if they are already signed in.
    return redirect("/");
  }

  const data = { error: session.get("error") };

  return json(data, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function action({
  request,
}: ActionFunctionArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  const userId = await validateCredentials(
    username,
    password
  );

  if (userId == null) {
    session.flash("error", "Invalid username/password");

    // Redirect back to the login page with errors.
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }

  session.set("userId", userId);

  // Login succeeded, send them to the home page.
  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function Login() {
  const { error } = useLoaderData<typeof loader>();

  return (
    <div>
      {error ? <div className="error">{error}</div> : null}
      <form method="POST">
        <div>
          <p>Please sign in</p>
        </div>
        <label>
          Username: <input type="text" name="username" />
        </label>
        <label>
          Password:{" "}
          <input type="password" name="password" />
        </label>
      </form>
    </div>
  );
}
```

And then a logout form might look something like this:

```tsx
import { getSession, destroySession } from "../sessions";

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};

export default function LogoutRoute() {
  return (
    <>
      <p>Are you sure you want to log out?</p>
      <Form method="post">
        <button>Logout</button>
      </Form>
      <Link to="/">Never mind</Link>
    </>
  );
}
```

<docs-warning>It's important that you logout (or perform any mutation for that matter) in an `action` and not a `loader`. Otherwise you open your users to [Cross-Site Request Forgery][csrf] attacks. Also, Remix only re-calls `loaders` when `actions` are called.</docs-warning>

## Session Gotchas

Because of nested routes, multiple loaders can be called to construct a single page. When using `session.flash()` or `session.unset()`, you need to be sure no other loaders in the request are going to want to read that, otherwise you'll get race conditions. Typically if you're using flash, you'll want to have a single loader read it, if another loader wants a flash message, use a different key for that loader.

## `createSession`

TODO:

## `isSession`

Returns `true` if an object is a Remix session.

```ts
import { isSession } from "@remix-run/node"; // or cloudflare/deno

const sessionData = { foo: "bar" };
const session = createSession(sessionData, "remix-session");
console.log(isSession(session));
// true
```

## `createSessionStorage`

Remix makes it easy to store sessions in your own database if needed. The `createSessionStorage()` API requires a `cookie` (for options for creating a cookie, see [cookies][cookies]) and a set of create, read, update, and delete (CRUD) methods for managing the session data. The cookie is used to persist the session ID.

- `createData` will be called from `commitSession` on the initial session creation when no session ID exists in the cookie
- `readData` will be called from `getSession` when a session ID exists in the cookie
- `updateData` will be called from `commitSession` when a session ID already exists in the cookie
- `deleteData` is called from `destroySession`

The following example shows how you could do this using a generic database client:

```ts
import { createSessionStorage } from "@remix-run/node"; // or cloudflare/deno

function createDatabaseSessionStorage({
  cookie,
  host,
  port,
}) {
  // Configure your database client...
  const db = createDatabaseClient(host, port);

  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      // `expires` is a Date after which the data should be considered
      // invalid. You could use it to invalidate the data somehow or
      // automatically purge this record from your database.
      const id = await db.insert(data);
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
    },
  });
}
```

And then you can use it like this:

```ts
const { getSession, commitSession, destroySession } =
  createDatabaseSessionStorage({
    host: "localhost",
    port: 1234,
    cookie: {
      name: "__session",
      sameSite: "lax",
    },
  });
```

The `expires` argument to `createData` and `updateData` is the same `Date` at which the cookie itself expires and is no longer valid. You can use this information to automatically purge the session record from your database to save on space, or to ensure that you do not otherwise return any data for old, expired cookies.

## `createCookieSessionStorage`

For purely cookie-based sessions (where the session data itself is stored in the session cookie with the browser, see [cookies][cookies]) you can use `createCookieSessionStorage()`.

The main advantage of cookie session storage is that you don't need any additional backend services or databases to use it. It can also be beneficial in some load-balanced scenarios. However, cookie-based sessions may not exceed the browser's max-allowed cookie length (typically 4kb).

The downside is that you have to `commitSession` and send a "Set-Cookie" header from every loader and action that changes the session. That means, for example, that if you `session.flash` in an action, and then `session.get` in another, you must commit it for that flashed message to go away.

This can cause complications if loaders or actions are writing to the same session at the same time.

With other session storage strategies you only have to send a "Set-Cookie" header when the session is created (the browser cookie doesn't need to change because it doesn't store the session data, just the key to find it elsewhere). 

Note that you still need to call `commitSession()` when you change the session for anything based on `createSessionStorage`, you just don't need to send an updated header.

```ts
import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage({
    // a Cookie from `createCookie` or the same CookieOptions to create one
    cookie: {
      name: "__session",
      secrets: ["r3m1xr0ck5"],
      sameSite: "lax",
    },
  });
```

Note that other session implementations store a unique session ID in a cookie and use that ID to look up the session in the source of truth (in-memory, filesystem, DB, etc.). In a cookie session, the cookie _is_ the source of truth so there is no unique ID out of the box. If you need to track a unique ID in your cookie session you will need to add an ID value yourself via `session.set()`.

## `createMemorySessionStorage`

This storage keeps all the cookie information in your server's memory.

<docs-error>This should only be used in development. Use one of the other methods in production.</docs-error>

```ts filename=app/sessions.ts
import {
  createCookie,
  createMemorySessionStorage,
} from "@remix-run/node"; // or cloudflare/deno

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true,
});

const { getSession, commitSession, destroySession } =
  createMemorySessionStorage({
    cookie: sessionCookie,
  });

export { getSession, commitSession, destroySession };
```

## `createFileSessionStorage` (node)

For file-backed sessions, use `createFileSessionStorage()`. File session storage requires a file system, but this should be readily available on most cloud providers that run express, maybe with some extra configuration.

The advantage of file-backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a regular file on disk, ideal for sessions with more than 4kb of data.

<docs-info>If you are deploying to a serverless function, ensure you have access to a persistent file system. They usually don't have one without extra configuration.</docs-info>

```ts filename=app/sessions.ts
import {
  createCookie,
  createFileSessionStorage,
} from "@remix-run/node"; // or cloudflare/deno

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true,
});

const { getSession, commitSession, destroySession } =
  createFileSessionStorage({
    // The root directory where you want to store the files.
    // Make sure it's writable!
    dir: "/app/sessions",
    cookie: sessionCookie,
  });

export { getSession, commitSession, destroySession };
```

## `createWorkersKVSessionStorage` (Cloudflare Workers)

For [Cloudflare Workers KV][cloudflare-kv] backed sessions, use `createWorkersKVSessionStorage()`.

The advantage of KV backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a globally-replicated, low-latency data store with exceptionally high-read volumes with low-latency.

```ts filename=app/sessions.server.ts
import {
  createCookie,
  createWorkersKVSessionStorage,
} from "@remix-run/cloudflare";

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true,
});

const { getSession, commitSession, destroySession } =
  createWorkersKVSessionStorage({
    // The KV Namespace where you want to store sessions
    kv: YOUR_NAMESPACE,
    cookie: sessionCookie,
  });

export { getSession, commitSession, destroySession };
```

## `createArcTableSessionStorage` (architect, Amazon DynamoDB)

For [Amazon DynamoDB][amazon-dynamo-db] backed sessions, use `createArcTableSessionStorage()`.

The advantage of DynamoDB backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a globally replicated, low-latency data store with exceptionally high read volumes with low-latency.

```
# app.arc
sessions
  _idx *String
  _ttl TTL
```

```ts filename=app/sessions.server.ts
import {
  createCookie,
  createArcTableSessionStorage,
} from "@remix-run/architect";

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  maxAge: 3600,
  sameSite: true,
});

const { getSession, commitSession, destroySession } =
  createArcTableSessionStorage({
    // The name of the table (should match app.arc)
    table: "sessions",
    // The name of the key used to store the session ID (should match app.arc)
    idx: "_idx",
    // The name of the key used to store the expiration time (should match app.arc)
    ttl: "_ttl",
    cookie: sessionCookie,
  });

export { getSession, commitSession, destroySession };
```

## Session API

After retrieving a session with `getSession`, the returned session object has a handful of methods and properties:

```tsx
export async function action({
  request,
}: ActionFunctionArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  session.get("foo");
  session.has("bar");
  // etc.
}
```

### `session.has(key)`

Returns `true` if the session has a variable with the given `name`.

```ts
session.has("userId");
```

### `session.set(key, value)`

Sets a session value for use in subsequent requests:

```ts
session.set("userId", "1234");
```

### `session.flash(key, value)`

Sets a session value that will be unset the first time it is read. After that, it's gone. Most useful for "flash messages" and server-side form validation messages:

```tsx
import { commitSession, getSession } from "../sessions";

export async function action({
  params,
  request,
}: ActionFunctionArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const deletedProject = await archiveProject(
    params.projectId
  );

  session.flash(
    "globalMessage",
    `Project ${deletedProject.name} successfully archived`
  );

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
```

Now we can read the message in a loader.

<docs-info>You must commit the session whenever you read a `flash`. This is different than what you might be used to, where some type of middleware automatically sets the cookie header for you.</docs-info>

```tsx
import { json } from "@remix-run/node"; // or cloudflare/deno
import {
  Meta,
  Links,
  Scripts,
  Outlet,
} from "@remix-run/react";

import { getSession, commitSession } from "./sessions";

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const message = session.get("globalMessage") || null;

  return json(
    { message },
    {
      headers: {
        // only necessary with cookieSessionStorage
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function App() {
  const { message } = useLoaderData<typeof loader>();

  return (
    <html>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        {message ? (
          <div className="flash">{message}</div>
        ) : null}
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```

### `session.get()`

Accesses a session value from a previous request:

```ts
session.get("name");
```

### `session.unset()`

Removes a value from the session.

```ts
session.unset("name");
```

<docs-info>When using cookieSessionStorage, you must commit the session whenever you `unset`</docs-info>

```tsx
export async function loader({
  request,
}: LoaderFunctionArgs) {
  // ...

  return json(data, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
```

[cookies]: ./cookies
[constraints]: ../guides/constraints
[csrf]: https://developer.mozilla.org/en-US/docs/Glossary/CSRF
[cloudflare-kv]: https://developers.cloudflare.com/workers/learning/how-kv-works
[amazon-dynamo-db]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide
