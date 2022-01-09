import type { ActionFunction } from "remix";
import { json } from "remix";
import {
  commitSession,
  setErrorMessage,
  setSuccessMessage
} from "~/message.server";

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const number = formData.get("number");

  if (!number) {
    const session = await setErrorMessage(request, "Number is required!");
    return json(
      { ok: false },
      {
        headers: { "Set-Cookie": await commitSession(session) }
      }
    );
  }

  if (Number(number) === 10) {
    const session = await setSuccessMessage(request, "Awesome");
    return json(
      { ok: true },
      {
        headers: { "Set-Cookie": await commitSession(session) }
      }
    );
  } else {
    const session = await setErrorMessage(request, "Wrong! Guess again");
    return json(
      { ok: false },
      {
        headers: { "Set-Cookie": await commitSession(session) }
      }
    );
  }
};
