import type { ActionFunction} from "remix";
import { redirect } from "remix";
import { getSession, sessionStorage } from "~/session.server";

export const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request);

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session)
    }
  });
};
