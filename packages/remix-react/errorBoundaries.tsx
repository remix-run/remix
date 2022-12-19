import React, { useContext } from "react";
import type { ErrorResponse } from "@remix-run/router";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import type { CatchBoundaryComponent } from "./routeModules";
import type { ThrownResponse } from "./errors";

/**
 * When app's don't provide a root level ErrorBoundary, we default to this.
 */
export function RemixRootDefaultErrorBoundary({ error }: { error: Error }) {
  console.error(error);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,viewport-fit=cover"
        />
        <title>Application Error!</title>
      </head>
      <body>
        <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
          <h1 style={{ fontSize: "24px" }}>Application Error</h1>
          <pre
            style={{
              padding: "2rem",
              background: "hsla(10, 50%, 50%, 0.1)",
              color: "red",
              overflow: "auto",
            }}
          >
            {error.stack}
          </pre>
        </main>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log(
                "💿 Hey developer👋. You can provide a way better UX than this when your app throws errors. Check out https://remix.run/guides/errors for more information."
              );
            `,
          }}
        />
      </body>
    </html>
  );
}

export function V2_RemixRootDefaultErrorBoundary() {
  let error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <RemixRootDefaultCatchBoundaryImpl caught={error} />;
  } else if (error instanceof Error) {
    return <RemixRootDefaultErrorBoundary error={error} />;
  } else {
    let errorString =
      error == null
        ? "Unknown Error"
        : typeof error === "object" && "toString" in error
        ? error.toString()
        : JSON.stringify(error);
    return <RemixRootDefaultErrorBoundary error={new Error(errorString)} />;
  }
}

let RemixCatchContext = React.createContext<ThrownResponse | undefined>(
  undefined
);

/**
 * Returns the status code and thrown response data.
 *
 * @see https://remix.run/api/conventions#catchboundary
 */
export function useCatch<
  Result extends ThrownResponse = ThrownResponse
>(): Result {
  return useContext(RemixCatchContext) as Result;
}

type RemixCatchBoundaryProps = React.PropsWithChildren<{
  component: CatchBoundaryComponent;
  catch?: ErrorResponse;
}>;

export function RemixCatchBoundary({
  catch: catchVal,
  component: Component,
  children,
}: RemixCatchBoundaryProps) {
  if (catchVal) {
    return (
      <RemixCatchContext.Provider value={catchVal}>
        <Component />
      </RemixCatchContext.Provider>
    );
  }

  return <>{children}</>;
}

/**
 * When app's don't provide a root level CatchBoundary, we default to this.
 */
export function RemixRootDefaultCatchBoundary() {
  let caught = useCatch();
  return <RemixRootDefaultCatchBoundaryImpl caught={caught} />;
}

function RemixRootDefaultCatchBoundaryImpl({
  caught,
}: {
  caught: ThrownResponse;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,viewport-fit=cover"
        />
        <title>Unhandled Thrown Response!</title>
      </head>
      <body>
        <h1 style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
          {caught.status} {caught.statusText}
        </h1>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              console.log(
                "💿 Hey developer👋. You can provide a way better UX than this when your app throws 404s (and other responses). Check out https://remix.run/guides/not-found for more information."
              );
            `,
          }}
        />
      </body>
    </html>
  );
}
