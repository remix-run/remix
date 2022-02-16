import * as React from "react";
import type { ActionFunction, LoaderFunction, MetaFunction } from "remix";
import {
  Form,
  json,
  redirect,
  useActionData,
  useLoaderData,
  useLocation
} from "remix";

import { requireUser } from "~/session.server";

import Alert from "@reach/alert";
import { createNote, deleteNote, getNotes } from "~/models/note";

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await requireUser(request);

  console.log({ userId });

  if (!userId) return redirect("/login");

  const notes = await getNotes(userId);

  return json({ notes });
};

interface ActionData {
  errors: {
    title?: string;
    body?: string;
  };
}

export const action: ActionFunction = async ({ request }) => {
  const userId = await requireUser(request);

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

      await createNote({ title, body, email: userId });
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

export default function IndexPage() {
  const location = useLocation();
  const data = useLoaderData();
  const actionData = useActionData<ActionData>();
  const titleRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (actionData?.errors?.title) {
      titleRef.current?.focus();
    } else if (actionData?.errors?.body) {
      bodyRef.current?.focus();
    }
  }, [actionData]);

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
              ref={titleRef}
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
              ref={bodyRef}
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
          {data.notes.map((note: any) => (
            <li
              key={`${note.pk}-${note.sk}`}
              style={{ display: "flex", gap: 16, alignItems: "center" }}
            >
              <Form method="post">
                <input type="hidden" name="pk" value={note.pk} />
                <input type="hidden" name="sk" value={note.sk} />
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
