import type { ActionFunction, LoaderFunction, MetaFunction } from "remix";
import { Form, json, Link, useActionData } from "remix";
import { redirect } from "remix";
import Alert from "@reach/alert";

import { createUserSession, getUserId } from "~/session.server";
import { createUser, getUserByEmail } from "~/models/user";

const loader: LoaderFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return {};
};

interface ActionData {
  errors: {
    email?: string;
    password?: string;
  };
}

const action: ActionFunction = async ({ request }) => {
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

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    return json<ActionData>(
      { errors: { email: "Email already exists" } },
      { status: 400 }
    );
  }

  const user = await createUser(email, password);

  return createUserSession(request, user, "/");
};

const meta: MetaFunction = () => ({
  title: "Join"
});

function JoinPage() {
  const validation = useActionData<ActionData>();

  return (
    <>
      <Form method="post">
        <label>
          <span>Email</span>
          <input type="email" name="email" autoComplete="email" />
          {validation?.errors?.email && (
            <Alert style={{ color: "red" }}>{validation.errors.email}</Alert>
          )}
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" autoComplete="new-password" />
          {validation?.errors?.password && (
            <Alert style={{ color: "red" }}>{validation.errors.password}</Alert>
          )}
        </label>
        <button type="submit">Join</button>
      </Form>
      <div>
        Already have an account? <Link to="/login">Log in</Link>
      </div>
    </>
  );
}

export default JoinPage;
export { action, loader, meta };
