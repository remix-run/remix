import { Form, redirect, useFetcher } from "remix";
import type { ActionFunction } from "remix";
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
    return redirect("/", {
      headers: { "Set-Cookie": await commitSession(session) }
    });
  }

  if (Number(number) === 10) {
    const session = await setSuccessMessage(request, "Awesome");
    return redirect("/", {
      headers: { "Set-Cookie": await commitSession(session) }
    });
  } else {
    const session = await setErrorMessage(request, "Wrong! Guess again");
    return redirect("/", {
      headers: { "Set-Cookie": await commitSession(session) }
    });
  }
};

export default function () {
  const fetcher = useFetcher();

  return (
    <>
      <h2>Action handled by the same route</h2>
      <Form method="post">
        <label>
          Enter the secret number: <input name="number" type="text" required />
        </label>
        <button>Submit</button>
      </Form>
      <h2>Action handled by resource route</h2>
      <fetcher.Form method="post" action="/submit-secret">
        <label>
          Enter the secret number: <input name="number" type="text" required />
        </label>
        <button>Submit</button>
      </fetcher.Form>
    </>
  );
}
