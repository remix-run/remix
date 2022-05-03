import type { ActionFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { deleteProject } from "~/db.server";
import { requireUser } from "~/session.server";

export const action: ActionFunction = async ({ request, params }) => {
  await requireUser(request, {
    redirect: "/sign-in",
  });
  const projectId = params.projectId as string;
  if (projectId) {
    try {
      await deleteProject(projectId);
    } catch (e) {
      console.error(e);
    }
  }
  return redirect("/dashboard");
};
