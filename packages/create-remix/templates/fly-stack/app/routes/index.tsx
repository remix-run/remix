import {
  Form,
  json,
  redirect,
  useLoaderData,
  useLocation,
  useActionData
} from "remix";
import type { Note } from "@prisma/client";
import type { ActionFunction, LoaderFunction, MetaFunction } from "remix";
import Alert from "@reach/alert";

import { prisma } from "~/db.server";
import { createNote, deleteNote } from "~/models/note.server";
import { requireUserId } from "~/session.server";

interface LoaderData {
  notes: Array<Note>;
}

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await requireUserId(request);
  const notes = await prisma.note.findMany({ where: { userId: userId } });
  return json<LoaderData>({ notes });
};

interface ActionData {
  errors?: {
    title?: string;
    body?: string;
  };
}

export const action: ActionFunction = async ({ request }) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const actionType = formData.get("_action");

  switch (actionType) {
    case "delete-note": {
      const noteId = formData.get("noteId");
      if (typeof noteId !== "string") {
        throw new Response("noteId must be a string", { status: 400 });
      }

      await deleteNote(noteId);

      return redirect("/");
    }

    case "create-note": {
      const title = formData.get("title");
      const body = formData.get("body");

      if (typeof title !== "string" || title.length === 0) {
        return json<ActionData>(
          { errors: { title: "Title is required" } },
          { status: 400 }
        );
      }

      if (typeof body !== "string" || body.length === 0) {
        return json<ActionData>(
          { errors: { body: "Body is required" } },
          { status: 400 }
        );
      }

      await createNote(title, body, userId);

      return redirect("/");
    }

    default: {
      throw new Response("Invalid action", { status: 400 });
    }
  }
};

export const meta: MetaFunction = () => {
  return { title: "New Remix App" };
};

export default function Index() {
  const location = useLocation();
  const data = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();

  return (
    <div>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1>Notes</h1>
        <Form action="/logout" method="post">
          <button type="submit">Logout</button>
        </Form>
      </header>

      <Form
        method="post"
        key={location.key}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        <div>
          <label>
            <span style={{ display: "block" }}>Title: </span>
            <input
              name="title"
              style={{ marginTop: 4 }}
              aria-invalid={actionData?.errors?.title ? true : undefined}
              aria-errormessage={
                actionData?.errors?.title ? "title-error" : undefined
              }
            />
          </label>
          {actionData?.errors?.title && (
            <Alert style={{ color: "red" }} id="title=error">
              {actionData.errors.title}
            </Alert>
          )}
        </div>
        <div>
          <label>
            <span style={{ display: "block" }}>Body: </span>
            <textarea
              name="body"
              rows={8}
              style={{ marginTop: 4 }}
              aria-invalid={actionData?.errors?.body ? true : undefined}
              aria-errormessage={
                actionData?.errors?.body ? "body-error" : undefined
              }
            />
          </label>
          {actionData?.errors?.body && (
            <Alert style={{ color: "red" }} id="body=error">
              {actionData.errors.body}
            </Alert>
          )}
        </div>
        <div>
          <button name="_action" value="create-note" type="submit">
            Save
          </button>
        </div>
      </Form>

      <h2>Notes</h2>
      {data.notes.length === 0 ? (
        <p>No notes yet</p>
      ) : (
        <ul style={{ paddingLeft: 0 }}>
          {data.notes.map(note => (
            <li
              key={note.id}
              style={{ display: "flex", gap: 16, alignItems: "center" }}
            >
              <Form method="post">
                <input type="hidden" name="noteId" value={note.id} />
                <button type="submit" name="_action" value="delete-note">
                  Delete
                </button>
              </Form>
              <div>
                <h3>{note.title}</h3>
                <p>{note.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
