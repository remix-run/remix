import { Form } from "remix";

export function action() {
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

export function ErrorBoundary({ error }) {
  return (
    <div data-test-id="action-error-boundary">
      <h1>Action Error Boundary</h1>
      <pre>{error.message}</pre>
    </div>
  );
}
