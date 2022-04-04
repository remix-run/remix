import { Outlet } from "@remix-run/react";

export default function Test() {
  return (
    <div>
      <h1>Shell</h1>
      <Outlet />
    </div>
  );
}
