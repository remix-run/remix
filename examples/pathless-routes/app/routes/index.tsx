import type { MetaFunction } from "remix";

export const meta: MetaFunction = () => {
  return { title: "Home" };
};

export default function IndexRoute() {
  return <h2>Home</h2>;
}
