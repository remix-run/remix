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
import type { ToastMessage } from "./message.server";
import { commitSession, getSession } from "./message.server";

type LoaderData = {
  toastMessage: ToastMessage | null;
};

export const meta: MetaFunction = () => {
  return {
    title: "Remix + Toast notifications"
  };
};

export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));

  const toastMessage = session.get("toastMessage") as ToastMessage;

  if (!toastMessage) {
    return json<LoaderData>({ toastMessage: null });
  }

  if (!toastMessage.type) {
    throw new Error("Message should have a type");
  }

  return json<LoaderData>(
    { toastMessage },
    { headers: { "Set-Cookie": await commitSession(session) } }
  );
};

export default function App() {
  const { toastMessage } = useLoaderData<LoaderData>();

  React.useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const { message, type } = toastMessage;

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
  }, [toastMessage]);

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
        <LiveReload />
      </body>
    </html>
  );
}
