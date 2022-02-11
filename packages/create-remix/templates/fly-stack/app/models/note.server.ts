import { prisma } from "~/db.server";

function createNote(title: string, body: string, userId: string) {
  return prisma.note.create({
    data: {
      title,
      body,
      userId
    }
  });
}

function deleteNote(id: string) {
  return prisma.note.delete({
    where: { id }
  });
}

export { createNote, deleteNote };
