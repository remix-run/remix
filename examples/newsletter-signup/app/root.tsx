import { Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";

import styles from "./styles.css";

export function links() {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/modern-normalize@1.1.0/modern-normalize.css",
    },
    { rel: "stylesheet", href: styles },
  ];
}

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
