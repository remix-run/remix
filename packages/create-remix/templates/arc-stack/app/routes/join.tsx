import {
  ActionFunction,
  Form,
  json,
  Link,
  LoaderFunction,
  MetaFunction,
  useActionData,
} from "remix";
import { redirect } from "remix";
import Alert from "@reach/alert";

import { arc, bcrypt } from "~/db.server";
import { getSession, sessionStorage } from "~/session.server";

let loader: LoaderFunction = async ({ request }) => {
  let session = await getSession(request);
  if (session.has("user")) return redirect("/");
  return {};
};

interface ActionData {
  errors: {
    email?: string;
    password?: string;
  };
}

let action: ActionFunction = async ({ request }) => {
  let session = await getSession(request);
  let formData = await request.formData();

  let email = formData.get("email");
  let password = formData.get("password");

  let errors: Record<string, string> = {};
  if (typeof email !== "string") {
    errors.email = "Email is required";
  }

  if (typeof password !== "string") {
    errors.password = "Password is required";
  }

  if (errors.email || errors.password) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  let hashedPassword = await bcrypt.hash(String(password));

  let db = await arc.tables();
  let user = await db.people.put({
    email,
    password: hashedPassword,
  });

  session.set("user", { email: user.email });

  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
};

let meta: MetaFunction = () => ({
  title: "Join",
});

function JoinPage() {
  let validation = useActionData<ActionData>();

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
        Already have an account?
        <Link to="/login">Log in</Link>
      </div>
    </>
  );
}

export default JoinPage;
export { action, loader, meta };
