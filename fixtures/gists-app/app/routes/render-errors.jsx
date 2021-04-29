import { Outlet, useLocation } from "react-router-dom";

export default function RenderErrors() {
  let location = useLocation();
  let params = new URLSearchParams(location.search);
  if (params.has("throw")) {
    throw new Error("I am a render error!");
  }
  return (
    <div data-test-id="/render-errors">
      <h1>Render Errors</h1>
      <p>
        This is the parent route, it rendered just fine. Any errors in the
        children will be handled there, but this layout renders normally.
      </p>
      <Outlet />
    </div>
  );
}
