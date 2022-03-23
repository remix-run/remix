import { Link } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return json({});
};

export default function Screen() {
  return <Link to="/">Home</Link>;
}
