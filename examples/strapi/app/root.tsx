import type { MetaFunction } from "@remix-run/node";
import { Links, LiveReload, Meta, Outlet } from "@remix-run/react";
import * as React from "react";

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Remix & Strapi",
  viewport: "width=device-width,initial-scale=1",
});

const App: React.FC = () => {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <LiveReload />
      </body>
    </html>
  );
};
export default App;
