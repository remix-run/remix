import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  useCatch,
} from "@remix-run/react";
import type { FunctionComponent } from "react";

import stylesUrl from "~/styles/global.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  viewport: "width=device-width,initial-scale=1",
});

const Document: FunctionComponent<{ title?: string }> = ({
  children,
  title,
}) => (
  <html lang="en">
    <head>
      {title ? <title>{title}</title> : null}
      <Meta />
      <Links />
    </head>

    <body>
      {children}
      <Scripts />
      <LiveReload />
    </body>
  </html>
);

const App: FunctionComponent = () => (
  <Document>
    <Outlet />
  </Document>
);
export default App;

export const CatchBoundary: FunctionComponent = () => {
  const caught = useCatch();

  switch (caught.status) {
    case 401:
    case 404:
      return (
        <Document title={`${caught.status} ${caught.statusText}`}>
          <h1>
            {caught.status} {caught.statusText}
          </h1>
        </Document>
      );

    default:
      throw new Error(
        `Unexpected caught response with status: ${caught.status}`
      );
  }
};

export const ErrorBoundary: FunctionComponent<{ error: Error }> = ({
  error,
}) => {
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
};
