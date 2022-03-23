import * as React from "react";
import { Toaster, toast } from "react-hot-toast";
import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction, MetaFunction } from "@remix-run/node";

import type { ToastMessage } from "./message.server";
import { commitSession, getSession } from "./message.server";

type LoaderData = {
  toastMessage: ToastMessage | null;
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Remix + Toast notifications",
  viewport: "width=device-width,initial-scale=1",
});

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
