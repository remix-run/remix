import { Outlet } from "remix";

export default function Test() {
  return (
    <div>
      <h1>Shell</h1>
      <Outlet />
    </div>
  );
}
