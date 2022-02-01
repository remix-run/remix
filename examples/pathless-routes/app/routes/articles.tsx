import { Link, Outlet } from "remix";
import type { MetaFunction } from "remix";
import { attributes } from "./articles/__layout/hello.md";

export const meta: MetaFunction = () => {
  return { title: "Articles" };
};

export default function () {
  return (
    <>
      <div>
        <h2>Articles</h2>
        <Link to={attributes.slug}>{attributes.meta.title}</Link>
      </div>
      <Outlet />
    </>
  );
}
