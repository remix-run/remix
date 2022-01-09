import * as React from "react";
import {
  json,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from "remix";
import type { LoaderFunction, MetaFunction } from "remix";

import { Toaster, toast } from "react-hot-toast";
import { commitSession, getSession } from "./message.server";

type LoaderData = { message: string | null; type: string | null };

export const meta: MetaFunction = () => {
  return {
    title: "Remix + Toast notifications"
  };
};

export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));

  const message = session.get("message");
  const type = session.get("type");

  if (!message) {
    return json<LoaderData>({ message: null, type: null });
  }

  if (!type) {
    throw new Error("Message should have a type");
  }

  return json<LoaderData>(
    { message, type },
    { headers: { "Set-Cookie": await commitSession(session) } }
  );
};

export default function App() {
  const data = useLoaderData<LoaderData>();

  React.useEffect(() => {
    const { message, type } = data;

    if (!message && !type) {
      return;
    }
    switch (type) {
      case "success":
        toast.success(message);
        break;
      case "error":
        toast.error(message);
        break;
      default:
        throw new Error(`${type} is not handled`);
    }
  }, [data]);

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
        <Toaster />
        <ScrollRestoration />
        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}
