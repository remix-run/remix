import { useEffect } from "react";
import { Meta, Links, Scripts, useRouteData } from "@remix-run/react";
import { Outlet } from "react-router-dom";
import styles from "url:./styles/app.css";

export function links() {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/@exampledev/new.css@1.1.3/new.css"
    },
    { rel: "stylesheet", href: styles }
  ];
}

export function loader({ request }) {
  return {
    enableScripts: new URL(request.url).searchParams.get("disableJs") == null
  };
}

export default function Root() {
  useEffect(() => {
    // We use this in the tests to wait for React to hydrate the page.
    window.reactIsHydrated = true;
  });

  let data = useRouteData();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="m-4">
        <div data-test-id="content">
          <Outlet />
        </div>
        {data.enableScripts && <Scripts />}
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }) {
  useEffect(() => {
    // We use this in the tests to wait for React to hydrate the page.
    window.reactIsHydrated = true;
  });

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Oops!</title>
        <link
          rel="stylesheet"
          href="//unpkg.com/@exampledev/new.css@1.1.3/new.css"
        />
      </head>
      <body>
        <div data-test-id="app-error-boundary">
          <h1>App Error Boundary</h1>
          <pre>{error.message}</pre>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
