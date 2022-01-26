import { ActionFunction, redirect } from "remix";
import { getSession, sessionStorage } from "~/session.server";

export let action: ActionFunction = async ({ request }) => {
  let session = await getSession(request);

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
};
