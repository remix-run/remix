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
        <title>Uncaught Exception!</title>
      </head>
      <body>
        <main
          style={{
            border: "solid 2px hsl(10, 50%, 50%)",
            padding: "2rem"
          }}
        >
          <div>
            <h1>Uncaught Exception!</h1>
            <p>
              If you are not the developer, please click back in your browser
              and try again.
            </p>
            <div
              style={{
                fontFamily: `"SFMono-Regular",Consolas,"Liberation Mono",Menlo,Courier,monospace`,
                padding: "1rem",
                margin: "1rem 0",
                border: "solid 4px"
              }}
            >
              {error.message}
            </div>
            <p>
              There was an uncaught exception in your application. Check the
              browser console and/or server console to inspect the error.
            </p>
            <p>
              If you are the developer, consider adding your own error boundary
              so users don't see this page when unexpected errors happen in
              production!
            </p>
            <p>
              Read more about{" "}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://remix.run/guides/errors"
              >
                Error Handling in Remix
              </a>
              .
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}

let RemixCatchContext = React.createContext<ThrownResponse | undefined>(
  undefined
);

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
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Unhandled Thrown Response!</title>
      </head>
      <body>
        <main
          style={{
            border: "solid 2px hsl(10, 50%, 50%)",
            padding: "2rem"
          }}
        >
          <div>
            <h1>Unhandled Thrown Response!</h1>
            <p>
              If you are not the developer, please click back in your browser
              and try again.
            </p>
            <p>There was an unhandled thrown response in your application.</p>
            <p>
              If you are the developer, consider adding your own catch boundary
              so users don't see this page when unhandled thrown response happen
              in production!
            </p>
            <p>
              Read more about{" "}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://remix.run/guides/errors"
              >
                Throwing Responses in Remix
              </a>
              .
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
