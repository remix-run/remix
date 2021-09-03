import { json, useCatch } from "remix";

export function loader() {
  throw json("catch data!", { status: 400 });
}

export default function LoaderCatchesNested() {
  return <div>Loader catch nested</div>;
}

export function CatchBoundary() {
  let caught = useCatch();
  return (
    <div data-test-id="/loader-errors/nested-catch">
      <h2>Nested Catch Boundary</h2>
      <p>
        There was an expected error at this specific route. The parent still
        renders cause it was fine, but this one threw an expected response.
      </p>
      <p>Status: {caught.status}</p>
      <pre>
        <code>{JSON.stringify(caught.data, null, 2)}</code>
      </pre>
    </div>
  );
}
