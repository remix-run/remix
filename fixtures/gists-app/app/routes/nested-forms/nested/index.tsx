import { Form, json, useActionData } from "remix";
import { Outlet } from "react-router-dom";

export function action() {
  return json("nested index action data");
}

export default function NestedFormsIndexLayout() {
  let actionData = useActionData<string>();

  return (
    <div>
      <Form method="post">
        {actionData ? <p>{actionData}</p> : null}
        <button type="submit">Submit Nested Index Form</button>
      </Form>

      <Outlet />
    </div>
  );
}
