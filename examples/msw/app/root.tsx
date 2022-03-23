import { Links, LiveReload, Meta, Scripts, ScrollRestoration, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction, MetaFunction } from "@remix-run/node";

type LoaderData = { message: string };

export const loader: LoaderFunction = async () => {
  const data = await fetch("https://my-mock-api.com").then((response) =>
    response.json()
  );

  if (!data || typeof data.message !== "string") {
    throw json({ message: "Server error" }, { status: 500 });
  }

  return json<LoaderData>(data);
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "New Remix App",
  viewport: "width=device-width,initial-scale=1",
});

export default function App() {
  const loaderData = useLoaderData<LoaderData>();

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>{loaderData.message}</h1>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
