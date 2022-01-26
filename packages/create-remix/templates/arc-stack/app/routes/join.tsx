import type { ActionFunction, LoaderFunction, MetaFunction } from "remix";
import { Form, json, Link, useActionData } from "remix";
import { redirect } from "remix";
import Alert from "@reach/alert";

import { arc, bcrypt } from "~/db.server";
import { getSession, sessionStorage } from "~/session.server";

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

  const errors: Record<string, string> = {};
  if (typeof email !== "string") {
    errors.email = "Email is required";
  }

  if (typeof password !== "string") {
    errors.password = "Password is required";
  }

  if (errors.email || errors.password) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(String(password));

  const db = await arc.tables();
  const user = await db.people.put({
    pk: `email#${email}`,
    password: hashedPassword
  });

  session.set("user", { email: user.email });

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
  const validation = useActionData<ActionData>();

  return (
    <>
      <Form method="post">
        <label>
          <span>Email</span>
          <input type="email" name="email" />
          {validation?.errors?.email && (
            <Alert style={{ color: "red" }}>{validation.errors.email}</Alert>
          )}
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="password" />
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
