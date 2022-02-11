import { json } from "remix";
import type { LoaderFunction, ActionFunction } from "remix";
import { requireUser } from "~/session.server";
import { getTodo, updateTodo } from "~/db.server";
import type { Todo } from "~/models";

export const loader: LoaderFunction = async ({ request, context, params }) => {
  const todoId = params.todoId as string;
  await requireUser(request, {
    redirect: "/sign-in"
  });

  const todo = await getTodo(todoId);

  if (!todo) {
    const data: LoaderData = { todo: null };
    return json(data, 404);
  }

  const data: LoaderData = { todo };
  return json(data);
};

export const action: ActionFunction = async ({ request, context, params }) => {
  await requireUser(request, {
    redirect: "/sign-in"
  });

  let actionData: ActionData;

  // Toggle actions
  if (request.method.toLowerCase() === "post") {
    const todoId = params.todoId as string;

    if (!todoId || typeof todoId !== "string") {
      actionData = { todo: null };
      throw json(actionData, 400);
    }

    try {
      const formData = await request.formData();
      const status = formData.get("id");

      const todo = await updateTodo(todoId, {
        completed: status === "on"
      });
      actionData = { todo };
      return json(actionData, 200);
    } catch (e) {
      // console.error(e);
      actionData = { todo: null };
      return json(actionData, 400);
    }
  }
  return json({ message: "Bad request", todo: null }, 400);
};

interface LoaderData {
  todo: Todo | null;
}

interface ActionData {
  todo: Todo | null;
}
