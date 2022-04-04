import type { LinksFunction } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";

// @ts-expect-error
import Shared from "~/components/Shared";

export let links: LinksFunction = () => [
  {
    rel: "stylesheet",
    href: "https://unpkg.com/@highlightjs/cdn-assets@11.2.0/styles/a11y-dark.min.css",
  },
];

export let handle = {
  breadcrumb: () => <Link to="/blog">Blog</Link>,
};

export default function BlogLayout() {
  return (
    <>
      <Outlet />
      <Shared />
    </>
  );
}
