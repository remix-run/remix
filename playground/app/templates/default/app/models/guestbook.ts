import * as s from "remix/data-schema";

import { db } from "../db/driver.ts";
import * as schema from "../db/schema.ts";

const GuestbookEntrySchema = s.object({
  id: s.number(),
  name: s.string(),
  createdAt: s.number(),
});

const GuestbookSchema = s.array(GuestbookEntrySchema);

export type GuestbookEntry = s.InferOutput<typeof GuestbookEntrySchema>;

export type Guestbook = s.InferOutput<typeof GuestbookSchema>;

export async function getGuestbookEntries(
  { limit }: { limit?: number },
): Promise<GuestbookEntry[]> {
  const entries = await db.findMany(schema.guestBook, {
    orderBy: ["createdAt", "desc"],
    limit,
  });

  return s.parse(GuestbookSchema, entries);
}

const CreateGuestbookSchema = s.object({
  name: s.string(),
});

export type CreateGuestbookInput = s.InferOutput<typeof CreateGuestbookSchema>;

export async function createGuestbookEntry(
  input: CreateGuestbookInput,
): Promise<GuestbookEntry> {
  const result = await db.create(schema.guestBook, {
    name: input.name,
  });

  if (typeof result.insertId !== "number") {
    throw new Error("Failed to create guestbook entry");
  }

  const entry = await db.findOne(schema.guestBook, {
    where: {
      id: result.insertId,
    },
  });

  return s.parse(GuestbookEntrySchema, entry);
}
