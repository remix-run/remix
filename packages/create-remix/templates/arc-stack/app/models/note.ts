import cuid from "cuid";
import { arc } from "~/db.server";

async function createNote({
  title,
  body,
  email
}: {
  title: string;
  body: string;
  email: string;
}) {
  const db = await arc.tables();
  return db.notes.put({
    sk: `email#${email}`,
    title: title,
    body: body,
    pk: `note#${cuid()}`
  });
}

async function deleteNote(noteID: string, email: string) {
  const db = await arc.tables();
  return db.notes.delete({
    pk: noteID,
    sk: email
  });
}

export { createNote, deleteNote };
