import { Link, useLocation } from "react-router-dom";
import { json, useCatch } from "remix";

export function loader({ request }) {
  let url = new URL(request.url);
  if (url.searchParams.get("authed")) {
    return {};
  }

  throw json("catch data!", { status: 401 });
}

export default function LoaderCatchesNested() {
  let location = useLocation();
  return (
    <>
      <h2>Yay, your're authenticated!</h2>
      <Link to={location.pathname}>Logout</Link>
    </>
  );
}

export function CatchBoundary() {
  let caught = useCatch();
  let location = useLocation();

  return (
    <div data-test-id="/loader-errors/nested-catch">
      <h2>Nested Catch Boundary</h2>
      <Link to={location.pathname + "?authed=true"}>Login</Link>
      <p>
        There was an expected error at this specific route. The parent still
        renders cause it was fine, but this one threw an expected response.
      </p>
      <p>Status: {caught.status} {caught.statusText}</p>
      <pre>
        <code>{JSON.stringify(caught.data, null, 2)}</code>
      </pre>
    </div>
  );
}
