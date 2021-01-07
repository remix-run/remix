---
title: Sessions
---

Sessions are an important part of websites so that the server can identify requests coming from the same person, especially when it comes to server side form validation or when JavaScript is not on the page.

Remix sessions are optional and cookie based, and depend on your platform wrapper like express, or aws, etc.

## Enabling sessions

Remix deployment wrappers like `@remix-run/express` will detect if you have sessions enabled, and if so, will send a special Remix session object to your loaders and actions.

For example, to enable sessions in express, add this to your server:

```js
const session = require("express-session");
// ...
app.use(
  session({
    secret: "whatever",
    resave: false,
    saveUninitialized: false
  })
);
```

Then `@remix-run/express` will see that sessions are available, and send the session object to your loaders and actions:

```ts
let loader = ({ session }) => {};
let action = ({ session }) => {};

export { loader, action };
```

## `session.set()`

Sets a session value for use in subsequent requests:

```ts
session.set("name", "ryan");
```

## `session.get()`

Accesses a session value from a previous request:

```ts
session.get("name", "ryan");
```

## `session.flash()`

Sets a session value that will be unset the first time it is read. After that, it's gone. Most useful for "flash messages" and server side form validation messages:

```ts
let action = async ({ params, session }) => {
  let deletedProject = await archiveProject(params.projectId);
  session.flash(
    "globalMessage",
    `Project ${deletedProject.name} successfully archived`
  );
  return redirect("/dashboard");
};
```

```ts
// data/global.ts
let loader = ({ session }) => {
  let message = session.get("globalMessage") || null;
  return { message };
};
```

```tsx
// app/App.tsx
export default function App() {
  let { message } = useGlobalData();
  return (
    <html>
      <head>
        <Meta />
        <Styles />
      </head>
      <body>
        {message && <div>{message}</div>}
        <Routes />
        <Scripts />
      </body>
    </html>
  );
}
```
