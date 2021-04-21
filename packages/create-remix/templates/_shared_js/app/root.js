import {
  Meta,
  Links,
  Scripts,
  useRouteData,
  useLiveReload
} from "@remix-run/react";
import { Outlet } from "react-router-dom";

import stylesUrl from "./styles/global.css";

export let links = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export let loader = async () => {
  return { date: new Date() };
};

export default function App() {
  let data = useRouteData();
  useLiveReload();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />

        <footer>
          <p>This page was rendered at {data.date.toLocaleString()}</p>
        </footer>

        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <title>Oops!</title>
      </head>
      <body>
        <div>
          <h1>App Error</h1>
          <pre>{error.message}</pre>
          <p>
            Replace this UI with what you want users to see when your app throws
            uncaught errors.
          </p>
        </div>

        <Scripts />
      </body>
    </html>
  );
}
