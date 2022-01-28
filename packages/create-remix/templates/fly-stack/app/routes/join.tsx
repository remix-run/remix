import { Form, Link, redirect } from "remix";
import type { ActionFunction, LoaderFunction, MetaFunction } from "remix";

import { sessionStorage, USER_SESSION_KEY } from "~/session.server";

import { createUser } from "~/models/user.server";
import invariant from "tiny-invariant";

const loader: LoaderFunction = async ({ request }) => {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  if (session.has(USER_SESSION_KEY)) {
    return redirect("/");
  }
  return {};
};

const action: ActionFunction = async ({ request }) => {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  invariant(typeof email === "string", "email must be a string");
  invariant(typeof password === "string", "password must be a string");

  const user = await createUser(email, password);

  if (!user) {
    return redirect("/login");
  }

  session.set(USER_SESSION_KEY, user.id);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
};

const meta: MetaFunction = () => ({
  title: "Join"
});

function JoinPage() {
  return (
    <div>
      <div>
        <h2>Join</h2>
      </div>

      <Form method="post">
        <label>
          <span>Email address</span>
          <input name="email" type="email" autoComplete="email" />
        </label>

        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
          />
        </label>

        <button type="submit">Sign in</button>
      </Form>

      <p>
        <Link to="/login">Already have an account?</Link>
      </p>
    </div>
  );
}

export default JoinPage;
export { action, loader, meta };
