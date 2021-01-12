import { Outlet } from "react-router-dom";

export function loader({ request }) {
  let params = new URL(request.url).searchParams;
  if (params.has("throw")) {
    throw new Error("Explosions!!!! 💣");
  }
  return null;
}

export default function LoaderErrors() {
  return (
    <div data-test-id="/loader-errors">
      <h1>Exceptions</h1>
      <p>
        This is the parent route, it rendered just fine. Any errors in the
        children will be handled there, but this layout renders normally.
      </p>
      <Outlet />
    </div>
  );
}
