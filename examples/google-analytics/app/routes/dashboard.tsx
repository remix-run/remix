import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => ({
  title: "Dashboard",
});

export default function Dashboard() {
  return (
    <div>
      <h1>This is a dashboard page</h1>
    </div>
  );
}
