import { Outlet } from "remix";

export default function ArticleLayoutRoute() {
  return (
    <div style={{ color: "red" }}>
      <Outlet />
    </div>
  );
}
