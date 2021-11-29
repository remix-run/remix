import type { ActionFunction } from "remix";
import { Form, json, Outlet, useActionData } from "remix";

export let action: ActionFunction = ({ request }) => {
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
