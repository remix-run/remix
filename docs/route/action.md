---
title: action
---

# `action`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Singles</a>: <a href="https://www.youtube.com/watch?v=Iv25HAHaFDs&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Data Mutations with Form + action</a> and <a href="https://www.youtube.com/watch?v=w2i-9cYxSdc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Multiple Forms and Single Button Mutations</a></docs-success>

Like `loader`, action is a server only function to handle data mutations and other actions. If a non-GET request is made to your route (POST, PUT, PATCH, DELETE) then the action is called before the loaders.

Actions have the same API as loaders, the only difference is when they are called.

This enables you to co-locate everything about a data set in a single route module: the data read, the component that renders the data, and the data writes:

```tsx
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { Form } from "@remix-run/react";

import { fakeGetTodos, fakeCreateTodo } from "~/utils/db";
import { TodoList } from "~/components/TodoList";

export async function loader() {
  return json(await fakeGetTodos());
}

export async function action({ request }) {
  const body = await request.formData();
  const todo = await fakeCreateTodo({
    title: body.get("title"),
  });
  return redirect(`/todos/${todo.id}`);
}

export default function Todos() {
  const data = useLoaderData();
  return (
    <div>
      <TodoList todos={data} />
      <Form method="post">
        <input type="text" name="title" />
        <button type="submit">Create Todo</button>
      </Form>
    </div>
  );
}
```

When a POST is made to a URL, multiple routes in your route hierarchy will match the URL. Unlike a GET to loaders, where all of them are called to build the UI, _only one action is called_.

<docs-info>The route called will be the deepest matching route, unless the deepest matching route is an "index route". In this case, it will post to the parent route of the index (because they share the same URL, the parent wins).</docs-info>

If you want to post to an index route use `?index` in the action: `<Form action="/accounts?index" method="post" />`

| action url        | route action               |
| ----------------- | -------------------------- |
| `/accounts?index` | `routes/accounts/index.js` |
| `/accounts`       | `routes/accounts.js`       |

Also note that forms without an action prop (`<Form method="post">`) will automatically post to the same route within which they are rendered, so using the `?index` param to disambiguate between parent and index routes is only useful if you're posting to an index route from somewhere besides the index route itself. If you're posting from the index route to itself, or from the parent route to itself, you don't need to define a `<Form action>` at all, just omit it: `<Form method="post">`.

See also:

- [`<Form>`][form]
- [`<Form action>`][form action]
- [`?index` query param][index query param]

[form]: ../components/form
[form action]: ../components/form#action
[index query param]: ../guides/routing#what-is-the-index-query-param
