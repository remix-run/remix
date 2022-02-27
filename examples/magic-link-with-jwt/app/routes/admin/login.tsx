import type { ActionFunction } from "remix";
import { Form as RemixForm, useActionData, useSubmit } from "remix";
import type { FormEventHandler } from "react";
import { useState } from "react";
import { magic } from "~/lib/magic";
import { login } from "~/lib/cookies.server";
import { Form, Button } from "react-bootstrap";

export const action: ActionFunction = async ({ request }) => {
  const didToken = (await request.formData()).get("didToken") as string;
  return await login(didToken);
};

const LoginRoute = (): JSX.Element => {
  const actionData = useActionData<{ status: number }>();
  const submit = useSubmit();
  const [email, setEmail] = useState("");

  const handleLoginWithEmail: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    const didToken = await magic?.auth.loginWithMagicLink({
      email,
    });

    if (didToken) {
      submit({ didToken }, { method: "post" });
    }
  };

  return (
    <div>
      <Form
        as={RemixForm}
        method="post"
        onSubmit={handleLoginWithEmail}
        autoComplete="email"
      >
        <Form.Group>
          <Form.Label>Email address</Form.Label>
          <Form.Control
            type="text"
            name="email"
            value={email}
            onChange={(e): void => setEmail(e.target.value)}
          />
          {actionData && <pre>{JSON.stringify(actionData, null, 2)}</pre>}
        </Form.Group>
        <Button type="submit">Log In</Button>
      </Form>
    </div>
  );
};

export default LoginRoute;
