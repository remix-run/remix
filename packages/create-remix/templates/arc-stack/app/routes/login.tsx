import type { ActionFunction, LoaderFunction, MetaFunction } from "remix";
import { Form, json, Link, useActionData } from "remix";
import { redirect } from "remix";
import Alert from "@reach/alert";

import { getSession, sessionStorage } from "~/session.server";
import { getUserByEmail } from "~/models/user";
import { bcrypt } from "~/db.server";

const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request);
  if (session.has("user")) return redirect("/");
  return {};
};

interface ActionData {
  errors: {
    email?: string;
    password?: string;
  };
}

const action: ActionFunction = async ({ request }) => {
  const session = await getSession(request);
  const formData = await request.formData();

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string") {
    return json<ActionData>(
      { errors: { email: "Email is required" } },
      { status: 400 }
    );
  }

  if (typeof password !== "string") {
    return json<ActionData>(
      { errors: { password: "Password is required" } },
      { status: 400 }
    );
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return json<ActionData>(
      { errors: { email: "Email does not exist" } },
      { status: 400 }
    );
  }

  const authorized = await bcrypt.compare(password, user.password);
  if (!authorized) {
    return json<ActionData>(
      { errors: { password: "Password is incorrect" } },
      { status: 400 }
    );
  }

  session.set("user", { email: user.email });

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
};

const meta: MetaFunction = () => ({
  title: "Login"
});

function LoginPage() {
  const actionData = useActionData<ActionData>();

  return (
    <>
      <Form method="post">
        <label>
          <span>Email</span>
          <input type="email" name="email" />
          {actionData?.errors?.email && (
            <Alert style={{ color: "red" }}>{actionData.errors.email}</Alert>
          )}
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" />
          {actionData?.errors?.password && (
            <Alert style={{ color: "red" }}>{actionData.errors.password}</Alert>
          )}
        </label>
        <button type="submit">Log in</button>
      </Form>
      <div>
        Don't have an account? <Link to="/join">Join</Link>
      </div>
    </>
  );
}

export default LoginPage;
export { action, loader, meta };
