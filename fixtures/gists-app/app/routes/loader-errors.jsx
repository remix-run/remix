import { json, Outlet } from "remix";

export function loader({ request }) {
  let params = new URL(request.url).searchParams;
  if (params.has("throw")) {
    throw new Error("I am a loader error!");
  }
  if (params.has("catch")) {
    throw json("catch data!", { status: 401 });
  }
  return null;
}

export default function LoaderErrors() {
  return (
    <div data-test-id="/loader-errors">
      <h1>Loader Errors</h1>
      <p>
        This is the parent route, it rendered just fine. Any errors in the
        children will be handled there, but this layout renders normally.
      </p>
      <Outlet />
    </div>
  );
}
