import { Form } from "remix";

export async function action() {
  throw new Error("I am an action error!");
}

export default function ActionErrors() {
  return (
    <div data-test-id="/action-errors">
      <h1>Action Errors</h1>
      <Form method="post">
        <button type="submit">Go</button>
      </Form>
    </div>
  );
}
