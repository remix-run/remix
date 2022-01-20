import type { ActionFunction, LoaderFunction } from "remix";
import { Form, json, useLoaderData } from "remix";
import { authenticator, sessionStorage, supabaseStrategy } from "~/auth.server";

type LoaderData = {
  error: { message: string } | null;
};

export const action: ActionFunction = async ({ request }) => {
  await authenticator.authenticate("sb", request, {
    successRedirect: "/private",
    failureRedirect: "/login"
  });
};

export const loader: LoaderFunction = async ({ request }) => {
  await supabaseStrategy.checkSession(request, {
    successRedirect: "/private"
  });

  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  const error = session.get(
    authenticator.sessionErrorKey
  ) as LoaderData["error"];

  return json<LoaderData>({ error });
};

export default function Screen() {
  const { error } = useLoaderData<LoaderData>();

  return (
    <Form method="post">
      {error && <div>{error.message}</div>}
      <div>
        <label htmlFor="email">Email</label>
        <input type="email" name="email" id="email" />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input type="password" name="password" id="password" />
      </div>

      <button>Log In</button>
    </Form>
  );
}
