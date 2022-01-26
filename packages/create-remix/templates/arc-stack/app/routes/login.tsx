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

  let errors: ActionData["errors"] = {};
  if (typeof email !== "string") {
    errors.email = "Email is required";
  }

  if (typeof password !== "string") {
    errors.password = "Password is required";
  }

  if (errors.email || errors.password) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  let client = await arc.tables();
  let people = client.people;

  let result = await people.query({
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: { ":email": email },
  });

  console.log(result.Items);

  if (!result.Items.length) {
    return json<ActionData>(
      { errors: { email: "Invalid Email" } },
      { status: 400 }
    );
  }

  let [user] = result.Items;

  let authorized = await bcrypt.verify(String(password), user.password);
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
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
};

let meta: MetaFunction = () => ({
  title: "Login",
});

function LoginPage() {
  let actionData = useActionData<ActionData>();

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
        Don't have an account?
        <Link to="/join">Join</Link>
      </div>
    </>
  );
}

export default LoginPage;
export { action, loader, meta };
