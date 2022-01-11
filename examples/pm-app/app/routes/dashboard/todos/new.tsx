import { json } from "remix";
import type { ActionFunction } from "remix";
import { requireUser } from "~/session.server";
import { createTodo, getTodosFromList } from "~/db.server";
import type { Todo } from "~/models";
import { Sanitizer } from "~/utils/sanitizer";

export const action: ActionFunction = async ({ request, params }) => {
  await requireUser(request, {
    redirect: "/sign-in"
  });

  let actionData: ActionData;
  if (request.method.toLowerCase() === "post") {
    const formData = await request.formData();
    const todoListId = params.listId || (formData.get("listId") as string);

    if (!todoListId || typeof todoListId !== "string") {
      actionData = { todo: null };
      throw json(actionData, 400);
    }

    const existingTodos = await getTodosFromList(todoListId);

    try {
      const name = Sanitizer.cleanHtmlString(formData.get("name"));
      const description = Sanitizer.cleanHtmlString(
        formData.get("description")
      );
      const order = existingTodos.length - 1;

      if (!name) {
        actionData = { todo: null };
        throw json(actionData, 400);
      }

      // TODO: Handle invalid inputs
      const todoData: Parameters<typeof createTodo>[0] = {
        name,
        order,
        todoListId,
        completed: false
      };

      if (description) {
        todoData.description = description;
      }

      const todo = await createTodo(todoData);
      actionData = { todo };
      return json(actionData, 200);
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
