import { useFetcher } from "remix";

export function action() {
  throw new Error("I am an action error!");
}

export default function ActionErrors() {
  const fetcher = useFetcher();

  return (
    <div data-test-id="/action-errors">
      <h1>Action Errors</h1>
      <fetcher.Form method="post">
        <button type="submit">Go</button>
      </fetcher.Form>
    </div>
  );
}
