import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { MetaFunction } from "@remix-run/node";
import { getCurrentUser } from "./db.server";

/*
 * Return data in any route where it makes sense
 E.g. we want access to the user object in every single route,
 so we return it right away in the root route.
 */
export const loader = async () => {
  const user = await getCurrentUser();
  return json({ user });
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "New Remix App",
  viewport: "width=device-width,initial-scale=1",
});

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
