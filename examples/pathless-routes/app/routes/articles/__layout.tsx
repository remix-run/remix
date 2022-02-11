import { Outlet } from "remix";

export default function () {
  return (
    <div style={{ color: "red" }}>
      <Outlet />
    </div>
  );
}
