import type { ActionFunction } from "remix";
import { getTodo, updateTodo } from "~/db.server";
import { requireUser } from "~/session.server";
import { json } from "remix";

export const action: ActionFunction = async ({ request }) => {
  await requireUser(request, {
    redirect: "/sign-in"
  });

  const formData = await request.formData();
  const todoId = formData.get("todo");

  if (!todoId || typeof todoId !== "string") {
    throw json({ message: "Bad request", todo: null }, 400);
  }
  const todo = await getTodo(todoId);
  if (!todo) {
    throw json({ message: "No todo found", todo: null }, 400);
  }

  await updateTodo(todoId, { completed: !todo.completed });
  return json({ message: "Success", todo }, 200);
};
