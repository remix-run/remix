import type { ActionFunction, LoaderFunction } from "remix";
import { deleteTodoList } from "~/db.server";
import { requireUser } from "~/session.server";
import { redirect } from "remix";

export const action: ActionFunction = async ({ request, params }) => {
  await requireUser(request, {
    redirect: "/sign-in"
  });
  const listId = params.listId as string;
  if (listId) {
    await deleteTodoList(listId);
  }
  return redirect("/dashboard");
};

export const loader: LoaderFunction = async ({ request, params }) => {
  await requireUser(request, {
    redirect: "/sign-in"
  });
  const listId = params.listId as string;
  if (listId) {
    await deleteTodoList(listId);
  }
  return redirect("/dashboard");
};
