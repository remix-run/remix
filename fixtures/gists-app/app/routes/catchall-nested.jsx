import { Outlet } from "remix";

export default function Comp() {
  return (
    <div>
      <h1>Catchall nested layout</h1>
      <Outlet />
    </div>
  );
}
