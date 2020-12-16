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
      <p>This exception is thrown inside a nested route.</p>
      <Outlet />
    </>
  );
}
