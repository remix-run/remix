import cuid from "cuid";
import arc from "@architect/functions";

export async function getNotes(email: string) {
  const db = await arc.tables();

  const result = await db.notes.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": email }
  });

  return result.Items;
}

export async function createNote({
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
    // our primary key is the email
    // and it already has the `email#` prefix
    pk: email,
    sk: `note#${cuid()}`,
    title: title,
    body: body
  });
}

export async function deleteNote({
  noteId,
  email
}: {
  noteId: string;
  email: string;
}) {
  const db = await arc.tables();
  return db.notes.delete({ pk: email, sk: noteId });
}
