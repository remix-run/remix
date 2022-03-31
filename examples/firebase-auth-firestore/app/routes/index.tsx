import { useEffect, useRef } from "react";
import type { ActionFunction, LoaderFunction } from "remix";
import {
  Form,
  json,
  Link,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
} from "remix";
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
  if (request.method === "POST") {
    const title = form.get("title");
    if (typeof title !== "string")
      return json<ActionData>({ error: "title is required" }, { status: 400 });

    await addTodo(uid, title);
    return redirect("/");
  }
  if (request.method === "DELETE") {
    const id = form.get("id");
    if (typeof id !== "string")
      return json<ActionData>({ error: "id is required" }, { status: 400 });
    await removeTodo(uid, id);
    return redirect("/");
  }
  return json<ActionData>({ error: "unknown method" }, { status: 400 });
};

const TodoComponent: React.FC<{ id: string; title: string }> = (props) => {
  const fetcher = useFetcher();
  return (
    <li>
      <fetcher.Form method="delete">
        <input type="hidden" name="id" value={props.id} />
        <span>{props.title}</span>
        <button type="submit">Delete</button>
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
        <button type="submit">Create</button>
      </Form>
      <ul>
        {data.todos.map((todo) => (
          <TodoComponent key={todo.id} {...todo} />
        ))}
      </ul>
    </div>
  );
}
