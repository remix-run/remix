import { Form, json, redirect, useLoaderData, useLocation } from "remix";
import invariant from "tiny-invariant";
import type { Note } from "@prisma/client";
import type { ActionFunction, LoaderFunction } from "remix";

import { prisma } from "~/db.server";
import { createNote } from "~/models/note.server";
import { sessionStorage } from "~/session.server";

interface LoaderData {
  notes: Array<Note>;
}

const loader: LoaderFunction = async ({ request }) => {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const userId = session.get("userId");
  if (!userId) throw redirect("/login");
  const notes = await prisma.note.findMany({ where: { userId: userId } });
  return json<LoaderData>({ notes });
};

const action: ActionFunction = async ({ request }) => {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const userId = session.get("userId");
  if (!userId) redirect("/login");

  const formData = await request.formData();
  const title = formData.get("title");
  const body = formData.get("body");

  invariant(typeof title === "string", "title must be a string");
  invariant(typeof body === "string", "body must be a string");

  await createNote(title, body, userId);

  return redirect("/");
};

function Index() {
  const location = useLocation();
  const data = useLoaderData<LoaderData>();

  return (
    <div>
      <h1>Welcome to Remix</h1>
      <Form method="post" key={location.key}>
        <label>
          <span>Title</span>
          <input name="title" />
        </label>
        <label>
          <span>Body</span>
          <textarea name="body" rows={8} />
        </label>
        <button type="submit">Save</button>
      </Form>

      <h2>Notes</h2>
      {data.notes.length === 0 ? (
        <p>No notes yet</p>
      ) : (
        <ul>
          {data.notes.map(note => (
            <li key={note.id}>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Index;
export { action, loader };
