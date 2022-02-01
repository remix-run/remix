import { json } from "remix";
import type { ActionFunction } from "remix";
import { requireUser } from "~/session.server";
import { deleteTodo } from "~/db.server";
import type { Todo } from "~/models";

export const action: ActionFunction = async ({ request, params }) => {
  await requireUser(request, {
    redirect: "/sign-in"
  });

  let actionData: ActionData;
  if (request.method.toLowerCase() === "post") {
    const todoId = params.todoId as string;

    if (!todoId || typeof todoId !== "string") {
      actionData = { todo: null };
      throw json(actionData, 400);
    }

    try {
      actionData = { todo: await deleteTodo(todoId) };
      return json(actionData);
    } catch (e) {
      actionData = { todo: null };
      return json(actionData, 400);
    }
  }
  return json({ todo: null }, 400);
};

interface ActionData {
  todo: Todo | null;
}
