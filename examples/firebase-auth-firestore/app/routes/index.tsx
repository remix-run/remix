import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
} from "@remix-run/react";
import { useEffect, useRef } from "react";

import { requireAuth } from "~/server/auth.server";
import type { Todo } from "~/server/db.server";
import { addTodo, getUserTodos, removeTodo } from "~/server/db.server";

type LoaderData = {
  message: string;
  todos: Todo[];
};

export const loader: LoaderFunction = async ({ request }) => {
  const user = await requireAuth(request);
  const todos = await getUserTodos(user.uid);
  return json<LoaderData>({
    message: `Hello ${user.displayName || "unknown"}!`,
    todos,
  });
};

export type ActionData = {
  error: string;
};

export const action: ActionFunction = async ({ request }) => {
  const { uid } = await requireAuth(request);
  const form = await request.formData();
  const action = form.get("action");
  if (action === "create") {
    const title = form.get("title");
    if (typeof title !== "string" || title.length === 0) {
      return json<ActionData>({ error: "title is required" }, { status: 400 });
    }

    await addTodo(uid, title);
    return redirect("/");
  }
  if (action === "delete") {
    const id = form.get("id");
    if (typeof id !== "string") {
      return json<ActionData>({ error: "id is required" }, { status: 400 });
    }
    await removeTodo(uid, id);
    return redirect("/");
  }
  return json<ActionData>({ error: "unknown method" }, { status: 400 });
};

const TodoComponent: React.FC<{ id: string; title: string }> = (props) => {
  const fetcher = useFetcher();
  return (
    <li>
      <fetcher.Form method="post">
        <input type="hidden" name="id" value={props.id} />
        <span>{props.title}</span>
        <button type="submit" name="action" value="delete">
          Delete
        </button>
      </fetcher.Form>
    </li>
  );
};

export default function Index() {
  const action = useActionData<ActionData>();
  const data = useLoaderData<LoaderData>();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);
  return (
    <div>
      <h1>{data.message}</h1>
      <p>
        Want to <Link to="/logout">log out</Link>?
      </p>
      {action?.error && <p style={{ color: "red" }}>{action.error}</p>}
      <Form method="post">
        <h2>Create new Todo:</h2>
        <input ref={ref} name="title" type="text" placeholder="Get Milk" />
        <button type="submit" name="action" value="create">
          Create
        </button>
      </Form>
      <ul>
        {data.todos.map((todo) => (
          <TodoComponent key={todo.id} {...todo} />
        ))}
      </ul>
    </div>
  );
}
