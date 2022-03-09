import type { LoaderFunction } from "remix";
import {
  json,
  Links,
  LiveReload,
  Meta,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "remix";

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

export default function App() {
  const loaderData = useLoaderData<LoaderData>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
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
