import type {
  ActionFunction,
  LoaderFunction,
  MetaFunction} from "remix";
import {
  Form,
  json,
  Link,
  useActionData
} from "remix";
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

  const errors: ActionData["errors"] = {};
  if (typeof email !== "string") {
    errors.email = "Email is required";
  }

  if (typeof password !== "string") {
    errors.password = "Password is required";
  }

  if (errors.email || errors.password) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  const db = await arc.tables();
  const result = await db.people.query({
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: { ":pk": `email#${email}` }
  });

  console.log(result.Items);

  if (!result.Items.length) {
    return json<ActionData>(
      { errors: { email: "Invalid Email" } },
      { status: 400 }
    );
  }

  const [user] = result.Items;

  const authorized = await bcrypt.verify(String(password), user.password);
  console.log({ authorized });

  if (!authorized) {
    return json<ActionData>(
      { errors: { password: "Invalid password" } },
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
