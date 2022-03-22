import type { MetaFunction } from "remix";

export const meta: MetaFunction = () => {
  return { title: "Dashboard" };
};

export default function Dashboard() {
  return (
    <div>
      <h1>This is a dashboard page</h1>
    </div>
  );
}
