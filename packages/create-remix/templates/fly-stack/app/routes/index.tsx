import { Form, json, redirect, useLoaderData, useLocation } from "remix";
import invariant from "tiny-invariant";
import type { Note } from "@prisma/client";
import type { ActionFunction, LoaderFunction } from "remix";

import { prisma } from "~/db.server";
import { createNote, deleteNote } from "~/models/note.server";
import { requireUserId } from "~/session.server";

interface LoaderData {
  notes: Array<Note>;
}

const loader: LoaderFunction = async ({ request }) => {
  const userId = await requireUserId(request);
  const notes = await prisma.note.findMany({ where: { userId: userId } });
  return json<LoaderData>({ notes });
};

const action: ActionFunction = async ({ request }) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const actionType = formData.get("_action");

  switch (actionType) {
    case "delete-note": {
      let noteId = formData.get("noteId");
      if (typeof noteId !== "string") {
        throw new Response("noteId must be a string", { status: 400 });
      }

      await deleteNote(noteId);

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

      await createNote(title, body, userId);

      return redirect("/");
    }

    default: {
      throw new Response("Invalid action", { status: 400 });
    }
  }
};

function Index() {
  const location = useLocation();
  const data = useLoaderData<LoaderData>();

  return (
    <div>
      <h1>Notes</h1>
      <Form action="/logout" method="post">
        <button type="submit">Log out</button>
      </Form>
      <Form method="post" key={location.key}>
        <label>
          <span>Title</span>
          <input name="title" />
        </label>
        <label>
          <span>Body</span>
          <textarea name="body" rows={8} />
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
          {data.notes.map((note) => (
            <li key={note.id}>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
              <Form method="post">
                <input type="hidden" name="noteId" value={note.id} />
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
