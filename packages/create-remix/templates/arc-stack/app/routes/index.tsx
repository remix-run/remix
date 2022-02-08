import type { ActionFunction, LoaderFunction } from "remix";
import {
  Form,
  json,
  redirect,
  useActionData,
  useLoaderData,
  useLocation
} from "remix";

import { getSession } from "~/session.server";

import Alert from "@reach/alert";
import { createNote, deleteNote, getNotes } from "~/models/note";

const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request);
  const user = session.get("user");
  if (!user) return redirect("/login");

  const notes = await getNotes(user.pk);

  return json({ notes });
};

const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request);
  const user = session.get("user");
  if (!user) return redirect("/login");

  const formData = await request.formData();

  const actionType = formData.get("_action");

  switch (actionType) {
    case "delete-note": {
      const pk = formData.get("pk");
      const sk = formData.get("sk");

      if (typeof pk !== "string") {
        throw new Response("pk must be a string", { status: 400 });
      }

      if (typeof sk !== "string") {
        throw new Response("sk must be a string", { status: 400 });
      }

      await deleteNote({ email: pk, noteId: sk });
      return redirect("/");
    }

    case "create-note": {
      const title = formData.get("title");
      const body = formData.get("body");

      if (typeof title !== "string") {
        throw new Response("title must be a string", { status: 400 });
      }

      if (typeof body !== "string") {
        throw new Response("body must be a string", { status: 400 });
      }

      await createNote({ title, body, email: user.pk });
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
            <li key={`${note.pk}-${note.sk}`}>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
              <Form method="post">
                <input type="hidden" name="pk" value={note.pk} />
                <input type="hidden" name="sk" value={note.sk} />
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
