import { Outlet, useLocation } from "react-router-dom";

export default function RenderError() {
  let location = useLocation();
  let params = new URLSearchParams(location.search);
  if (params.has("throw")) {
    throw new Error("Explosions!!!! 💣");
  }
  return (
    <>
      <h1>Exceptions</h1>
      <p>
        This is the parent route, it rendered just fine. Any errors in the
        children will be handled there, but this layout renders normally.
      </p>
      <Outlet />
    </>
  );
}
