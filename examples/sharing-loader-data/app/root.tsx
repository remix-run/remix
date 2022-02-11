import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  json
} from "remix";
import type { LoaderFunction } from "remix";
import type { User } from "~/data.server";
import { getUser } from "~/data.server";

type LoaderData = { user: User };

export const loader: LoaderFunction = async () => {
  return json<LoaderData>({ user: await getUser() });
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
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}
