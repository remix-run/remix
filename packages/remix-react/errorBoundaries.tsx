// TODO: We eventually might not want to import anything directly from `history`
// and leverage `react-router` here instead
import type { Location } from "history";
import React, { useContext } from "react";

import type {
  CatchBoundaryComponent,
  ErrorBoundaryComponent
} from "./routeModules";
import type { ThrownResponse } from "./errors";

type RemixErrorBoundaryProps = React.PropsWithChildren<{
  location: Location;
  component: ErrorBoundaryComponent;
  error?: Error;
}>;

type RemixErrorBoundaryState = {
  error: null | Error;
  location: Location;
};

export class RemixErrorBoundary extends React.Component<
  RemixErrorBoundaryProps,
  RemixErrorBoundaryState
> {
  constructor(props: RemixErrorBoundaryProps) {
    super(props);

    this.state = { error: props.error || null, location: props.location };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(
    props: RemixErrorBoundaryProps,
    state: RemixErrorBoundaryState
  ) {
    // When we get into an error state, the user will likely click "back" to the
    // previous page that didn't have an error. Because this wraps the entire
    // application (even the HTML!) that will have no effect--the error page
    // continues to display. This gives us a mechanism to recover from the error
    // when the location changes.
    //
    // Whether we're in an error state or not, we update the location in state
    // so that when we are in an error state, it gets reset when a new location
    // comes in and the user recovers from the error.
    if (state.location !== props.location) {
      return { error: props.error || null, location: props.location };
    }

    // If we're not changing locations, preserve the location but still surface
    // any new errors that may come through. We retain the existing error, we do
    // this because the error provided from the app state may be cleared without
    // the location changing.
    return { error: props.error || state.error, location: state.location };
  }

  render() {
    if (this.state.error) {
      return <this.props.component error={this.state.error} />;
    } else {
      return this.props.children;
    }
  }
}

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
              overflow: "auto"
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
            `
          }}
        />
      </body>
    </html>
  );
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
  location: Location;
  component: CatchBoundaryComponent;
  catch?: ThrownResponse;
}>;

export function RemixCatchBoundary({
  catch: catchVal,
  component: Component,
  children
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
            `
          }}
        />
      </body>
    </html>
  );
}
