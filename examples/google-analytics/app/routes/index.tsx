import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => ({
  title: "Home",
});

export default function Index() {
  return (
    <div>
      <h1>This is a Index/Home page</h1>
    </div>
  );
}
