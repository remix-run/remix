import {
  ActionFunction,
  Form,
  json,
  LoaderFunction,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
} from "remix";
import cuid from "cuid";

import { arc } from "~/db.server";
import { getSession } from "~/session.server";

import Alert from "@reach/alert";

let loader: LoaderFunction = async ({ request }) => {
  let session = await getSession(request);
  let user = session.get("user");
  if (!user) return redirect("/login");

  let data = await arc.tables();
  let result = await data.notes.query({
    KeyConditionExpression: "userEmail = :userEmail",
    ExpressionAttributeValues: {
      ":userEmail": user.email,
    },
  });

  return json({ notes: result.Items });
};

let action: ActionFunction = async ({ request }) => {
  let session = await getSession(request);
  let user = session.get("user");
  if (!user) return redirect("/login");

  let formData = await request.formData();

  let actionType = formData.get("_action");

  switch (actionType) {
    case "delete-note": {
      let id = formData.get("id");

      if (typeof id !== "string") {
        throw new Response("Id must be a string", { status: 400 });
      }

      let client = await arc.tables();
      let notes = client.notes;

      await notes.delete({ id, userEmail: user.email });

      return redirect("/");
    }

    case "create-note": {
      let title = formData.get("title");
      let body = formData.get("body");

      let errors: Record<string, string> = {};
      if (typeof title !== "string") {
        errors.title = "Title is required";
      }

      if (typeof body !== "string") {
        errors.body = "Body is required";
      }

      if (errors.title || errors.body) {
        return json({ errors }, { status: 400 });
      }

      let data = await arc.tables();
      await data.notes.put({
        userEmail: user.email,
        title: title,
        body: body,
        id: cuid(),
      });

      return redirect("/");
    }
  }

  throw new Response("Invalid action", { status: 400 });
};

function Index() {
  let location = useLocation();
  let data = useLoaderData();
  let validation = useActionData();

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
