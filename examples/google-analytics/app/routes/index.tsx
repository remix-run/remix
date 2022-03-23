import type { MetaFunction } from "remix";

export const meta: MetaFunction = () => {
  return { title: "Home" };
};

export default function Index() {
  return (
    <div>
      <h1>This is a Index/Home page</h1>
    </div>
  );
}
