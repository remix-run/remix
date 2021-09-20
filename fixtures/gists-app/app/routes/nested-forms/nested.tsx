import { Form, json, useActionData } from "remix";
import { Outlet } from "react-router-dom";

export function action() {
  return json("nested layout action data");
}

export default function NestedFormsIndexLayout() {
  let actionData = useActionData<string>();

  return (
    <div>
      <Form method="post">
        {actionData ? <p>{actionData}</p> : null}
        <button type="submit">Submit Nested Form</button>
      </Form>

      <Outlet />
    </div>
  );
}
