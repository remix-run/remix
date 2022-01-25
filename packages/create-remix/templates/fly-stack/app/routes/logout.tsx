import { redirect } from "remix";
import type { ActionFunction } from "remix";
import { sessionStorage } from "~/session.server";

export const action: ActionFunction = async ({ request }) => {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session)
    }
  });
};
