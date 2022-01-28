import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from "remix";
import { getCurrentUser } from "./db.server";

/*
 * Return data in any route where it makes sense
 E.g. we want access to the user object in every single route,
 so we return it right away in the root route.
 */
export const loader = async () => {
  const user = await getCurrentUser();
  return { user };
};

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
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
