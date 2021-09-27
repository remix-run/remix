import {
  Meta,
  Links,
  Scripts,
  useLoaderData,
  LiveReload,
  useCatch
} from "remix";
import { Outlet } from "react-router-dom";

import stylesUrl from "./styles/global.css";

export function links() {
  return [{ rel: "stylesheet", href: stylesUrl }];
}

export function loader() {
  return { date: new Date() };
}

function Document({ children, title }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        {title ? <title>{title}</title> : null}
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
  let data = useLoaderData();
  return (
    <Document>
      <Outlet />
      <footer>
        <p>This page was rendered at {data.date.toLocaleString()}</p>
      </footer>
    </Document>
  );
}

export function CatchBoundary() {
  let caught = useCatch();

  switch (caught.status) {
    case 401:
      return (
        <Document title="401 Unauthorized">
          <h1>401 Unauthorized</h1>
        </Document>
      );

    case 404:
      return (
        <Document title="404 Not Found">
          <h1>404 Not Found</h1>
        </Document>
      );

    default:
      throw new Error(
        `Unexpected caught response with status: ${caught.status}`
      );
  }
}

export function ErrorBoundary({ error }) {
  console.error(error);
  return (
    <Document title="Uh-oh!">
      <h1>App Error</h1>
      <pre>{error.message}</pre>
      <p>
        Replace this UI with what you want users to see when your app throws
        uncaught errors.
      </p>
    </Document>
  );
}
