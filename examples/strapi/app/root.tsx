import type { MetaFunction } from "remix";
import React from "react";
import { Links, LiveReload, Meta, Outlet } from "remix";

export const meta: MetaFunction = () => ({
  title: "Remix & Strapi"
});

const App: React.FC = () => {
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
        {process.env.NODE_ENV === "development" ? <LiveReload /> : null}
      </body>
    </html>
  );
};
export default App;
