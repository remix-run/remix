import { Outlet } from "@remix-run/react";

export default function ArticleLayoutRoute() {
  return (
    <div style={{ color: "red" }}>
      <Outlet />
    </div>
  );
}
