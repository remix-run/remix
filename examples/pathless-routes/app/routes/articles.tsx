import { Link, Outlet } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { attributes } from "./articles/__layout/hello.md";

export const meta: MetaFunction = () => {
  return { title: "Articles" };
};

export default function ArticlesRoute() {
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
