import type { ActionFunction } from "remix";
import { auth } from "~/auth.server";

export const action: ActionFunction = async ({ request }) => {
  return await auth.authenticate("github", request, {
    successRedirect: "/private",
    failureRedirect: "/"
  });
};
