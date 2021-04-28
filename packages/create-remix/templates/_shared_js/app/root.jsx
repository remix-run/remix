import { Meta, Links, Scripts, useRouteData, LiveReload } from "remix";
import { Outlet } from "react-router-dom";

import stylesUrl from "./styles/global.css";

export function links() {
  return [{ rel: "stylesheet", href: stylesUrl }];
}

export function loader() {
  return { date: new Date() };
}

function Document({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}

        <Scripts />
        {process.env.NODE_ENV === "development" && <LiveReload />}
      </body>
    </html>
  );
}

export default function App() {
  let data = useRouteData();
  return (
    <Document>
      <Outlet />
      <footer>
        <p>This page was rendered at {data.date.toLocaleString()}</p>
      </footer>
    </Document>
  );
}

export function ErrorBoundary({ error }) {
  console.error(error);
  return (
    <Document>
      <h1>App Error</h1>
      <pre>{error.message}</pre>
      <p>
        Replace this UI with what you want users to see when your app throws
        uncaught errors.
      </p>
    </Document>
  );
}
