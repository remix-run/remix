import type { LoaderFunction } from "remix";
import { json, Link } from "remix";

export const loader: LoaderFunction = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return json({});
};

export default function Screen() {
  return <Link to="/">Home</Link>;
}
