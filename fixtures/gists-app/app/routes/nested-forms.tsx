import type { ActionFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Outlet, useActionData } from "@remix-run/react";

export let action: ActionFunction = async ({ request }) => {
  return json("layout action data");
};

export default function NestedFormsIndexLayout() {
  let actionData = useActionData<string>();

  return (
    <div>
      <Form method="post" action=".">
        {actionData ? <p>{actionData}</p> : null}
        <button type="submit">Submit Layout Form</button>
      </Form>

      <Outlet />
    </div>
  );
}
