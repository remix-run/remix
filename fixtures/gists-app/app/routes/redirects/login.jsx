import {
  redirect,
  json,
  Form,
  useLoaderData
} from "remix";

import { sessionStorage } from "~/redirects.server";

export let action = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  session.flash("done", "yes");

  throw redirect("/redirects/login", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
};

export let loader = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return json(!!session.get("done"), {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
};

export default function Login() {
  let done = useLoaderData();

  return (
    <div>
      <h1>Login</h1>
      {done ? (
        <p data-testid="done">Logged In!</p>
      ) : (
        <Form method="post">
          <button type="submit">Push me to login</button>
        </Form>
      )}
    </div>
  );
}
