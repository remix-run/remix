import { useEffect } from "react";
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useCatch,
  useLoaderData,
  useMatches
} from "remix";
import normalizeHref from "@exampledev/new.css/new.css";

import stylesHref from "./styles/app.css";

export function links() {
  return [
    {
      rel: "stylesheet",
      href: normalizeHref
    },
    { rel: "stylesheet", href: stylesHref },
    { rel: "stylesheet", href: "/resources/theme-css" }
  ];
}

export function loader({ request }) {
  return {
    enableScripts: new URL(request.url).searchParams.get("disableJs") == null
  };
}

export let handle = {
  breadcrumb: () => <Link to="/">Home</Link>
};

export let unstable_shouldReload = () => false;

export default function Root() {
  useEffect(() => {
    // We use this in the tests to wait for React to hydrate the page.
    window.reactIsHydrated = true;
  });

  let data = useLoaderData();
  let matches = useMatches();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body className="m-4">
        <header>
          <ol className="breadcrumbs">
            {matches
              .filter(match => match.handle?.breadcrumb)
              .map((match, index) => (
                <li key={index}>{match.handle.breadcrumb(match)}</li>
              ))}
          </ol>
        </header>
        <div data-test-id="content" id="content">
          <Outlet />
        </div>
        {data.enableScripts ? (
          <>
            <ScrollRestoration />
            <Scripts />
          </>
        ) : null}
      </body>
    </html>
  );
}

export function CatchBoundary() {
  let caught = useCatch();

  useEffect(() => {
    // We use this in the tests to wait for React to hydrate the page.
    window.reactIsHydrated = true;
  });

  switch (caught.status) {
    case 404:
      return (
        <html lang="en">
          <head>
            <meta charSet="utf-8" />
            <title>404 Not Found</title>
            <Links />
          </head>
          <body>
            <div data-test-id="app-catch-boundary">
              <h1>404 Not Found</h1>
            </div>
            <Scripts />
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
            <div data-test-id="app-catch-boundary">
              <h1>
                {caught.status} {caught.statusText}
              </h1>
              {caught.data ? (
                <pre>
                  <code>{JSON.stringify(caught.data, null, 2)}</code>
                </pre>
              ) : null}
            </div>
            <Scripts />
          </body>
        </html>
      );
  }
}

export function ErrorBoundary({ error }) {
  useEffect(() => {
    // We use this in the tests to wait for React to hydrate the page.
    window.reactIsHydrated = true;
  });

  console.error(error);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Oops!</title>
        <Links />
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
