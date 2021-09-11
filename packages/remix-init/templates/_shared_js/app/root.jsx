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
import styles404Url from "./styles/404.css";

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
    case 404:
      return (
        <html lang="en">
          <head>
            <meta charSet="utf-8" />
            <title>404 Not Found</title>
            <link rel="stylesheet" href={styles404Url} />
            <Links />
          </head>
          <body>
            <h1>404 Not Found</h1>
          </body>
        </html>
      );
    default:
      console.warn("Unexpected catch", caught);

      return (
        <html lang="en">
          <head>
            <meta charSet="utf-8" />
            <title>{caught.status} Uh-oh!</title>
            <Links />
          </head>
          <body>
            <h1>{caught.status} Uh-oh!</h1>
            {caught.data ? (
              <pre>
                <code>{JSON.stringify(caught.data, null, 2)}</code>
              </pre>
            ) : null}
          </body>
        </html>
      );
  }
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
