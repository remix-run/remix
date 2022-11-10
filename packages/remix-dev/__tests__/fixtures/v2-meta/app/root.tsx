import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export function meta() {
  return [
    { title: "Remix" },
    { charSet: "utf-8" },
    { name: "description", content: "Center-stack goodness" },
    { property: "og:description", content: "Center-stack goodness" },
  ];
}

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
