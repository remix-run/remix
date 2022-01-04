import { json } from "remix";
import type { ActionFunction } from "remix";
import { requireUser } from "~/session.server";
import { updateTodo } from "~/db.server";
import type { Todo } from "~/models";
import { Sanitizer } from "~/utils/sanitizer";

export const action: ActionFunction = async ({ request, context, params }) => {
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
      const formData = await request.formData();
      const status = formData.get("id");

      const name = Sanitizer.cleanHtmlString(formData.get("name"));
      const description = Sanitizer.cleanHtmlString(
        formData.get("description")
      );

      // TODO: Handle invalid inputs
      const todoUpdates: Parameters<typeof updateTodo>[1] = {};
      if (status !== undefined) {
        if (status === "off") {
          todoUpdates.completed = false;
        } else {
          todoUpdates.completed = status === "on";
        }
      }

      if (name != null) {
        todoUpdates.name = name;
      }

      if (description != null) {
        todoUpdates.description = description;
      }

      const todo = await updateTodo(todoId, todoUpdates);
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
