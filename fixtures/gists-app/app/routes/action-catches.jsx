import { Form, json } from "remix";

export async function action() {
  throw json("action catch data!", { status: 401 });
}

export default function ActionCatches() {
  return (
    <div data-test-id="/action-errors">
      <h1>Action Catches</h1>
      <Form method="post">
        <button type="submit">Go</button>
      </Form>
    </div>
  );
}
