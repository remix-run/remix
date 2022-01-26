import type {
  ActionFunction,
  LoaderFunction} from "remix";
import {
  Form,
  json,
  redirect,
  useActionData,
  useLoaderData,
  useLocation
} from "remix";
import cuid from "cuid";

import { arc } from "~/db.server";
import { getSession } from "~/session.server";

import Alert from "@reach/alert";

const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request);
  const user = session.get("user");
  if (!user) return redirect("/login");

  const data = await arc.tables();
  const result = await data.notes.query({
    KeyConditionExpression: "sk = :sk",
    ExpressionAttributeValues: { ":sk": `email#${user.email}` }
  });

  return json({ notes: result.Items });
};

const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request);
  const user = session.get("user");
  if (!user) return redirect("/login");

  const formData = await request.formData();

  const actionType = formData.get("_action");

  switch (actionType) {
    case "delete-note": {
      const id = formData.get("id");

      if (typeof id !== "string") {
        throw new Response("Id must be a string", { status: 400 });
      }

      const db = await arc.tables();

      await db.notes.delete({
        pk: `note#${id}`,
        sk: `email#${user.email}`
      });

      return redirect("/");
    }

    case "create-note": {
      const title = formData.get("title");
      const body = formData.get("body");

      const errors: Record<string, string> = {};
      if (typeof title !== "string") {
        errors.title = "Title is required";
      }

      if (typeof body !== "string") {
        errors.body = "Body is required";
      }

      if (errors.title || errors.body) {
        return json({ errors }, { status: 400 });
      }

      const data = await arc.tables();
      await data.notes.put({
        sk: `email#${user.email}`,
        title: title,
        body: body,
        pk: `note#${cuid()}`
      });
      return redirect("/");
    }

    default: {
      throw new Response("Invalid action", { status: 400 });
    }
  }
};

function Index() {
  const location = useLocation();
  const data = useLoaderData();
  const validation = useActionData();

  return (
    <div>
      <header>
        <h1>Notes</h1>
        <Form action="/logout" method="post">
          <button type="submit">Logout</button>
        </Form>
      </header>
      <Form method="post" key={location.key}>
        <label>
          <span>Title</span>
          <input name="title" />
          {validation?.errors.title && (
            <Alert style={{ color: "red" }}>{validation.errors.title}</Alert>
          )}
        </label>
        <label>
          <span>Body</span>
          <textarea name="body" rows={8} />
          {validation?.errors.body && (
            <Alert style={{ color: "red" }}>{validation.errors.body}</Alert>
          )}
        </label>
        <button name="_action" value="create-note" type="submit">
          Save
        </button>
      </Form>

      <h2>Notes</h2>
      {data.notes.length === 0 ? (
        <p>No notes yet</p>
      ) : (
        <ul>
          {data.notes.map((note: any) => (
            <li key={note.id}>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
              <Form method="post">
                <input type="hidden" name="id" value={note.id} />
                <button type="submit" name="_action" value="delete-note">
                  Delete
                </button>
              </Form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Index;
export { action, loader };
