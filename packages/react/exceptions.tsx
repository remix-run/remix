import React from "react";
import type { Location } from "history";
import { useLocation } from "react-router-dom";

type UncaughtExceptionProps = { error: Error };

type RemixErrorBoundaryProps = React.PropsWithChildren<{
  component:
    | React.FunctionComponent<UncaughtExceptionProps>
    | React.ComponentClass<UncaughtExceptionProps>;
}>;

// Because our error boundary needs to reset on new locations, and classes can't
// use hooks, and `contextType` (to access location from context) doesn't work
// with `getDerivedStateFromProps` (where we diff location and reset error
// state), we make a quick wrapper to send the location to the error boundary
// implementation. Another option is to plumb `location` all the way from the
// top of RemixEntry down to `createClientRoute`. This feels less intrusive than
// that.
export function RemixErrorBoundary(props: RemixErrorBoundaryProps) {
  return <RemixErrorBoundaryImpl {...props} location={useLocation()} />;
}

type RemixErrorBoundaryImplProps = React.PropsWithChildren<{
  location: Location;
  component:
    | React.FunctionComponent<UncaughtExceptionProps>
    | React.ComponentClass<UncaughtExceptionProps>;
}>;

type RemixErrorBoundaryImplState = {
  error: null | Error;
  location: Location;
};

export class RemixErrorBoundaryImpl extends React.Component<
  RemixErrorBoundaryImplProps,
  RemixErrorBoundaryImplState
> {
  state = { error: null, location: this.props.location };

  static defaultProps = {
    component: RemixDefaultUncaughtException
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(
    props: RemixErrorBoundaryImplProps,
    state: RemixErrorBoundaryImplState
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
      return { error: null, location: props.location };
    }
    return state;
  }

  render() {
    if (this.state.error) {
      return <this.props.component error={this.state.error!} />;
    } else {
      return this.props.children;
    }
  }
}

/**
 * When app routes don't provide an `UncaughtException` component, we default to this.
 */
export function RemixDefaultUncaughtException({ error }: { error: Error }) {
  return (
    <main
      // For our tests, if we really care to remove this attribute in production
      // there's a babel transform that does it.
      data-test-id="remix-uncaught-exception"
      style={{
        border: "solid 2px hsl(10, 50%, 50%)",
        padding: "2rem"
      }}
    >
      <div>
        <h1>Uncaught Exception!</h1>
        <p>
          If you are not the developer, please click back in your browser and
          try again.
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
          There was an uncaught exception in your application. Check the browser
          console and/or server console to inspect the error.
        </p>
        <p>
          If you are the developer, consider adding your own error boundary so
          users don't see this page when unexpected errors happen in production!
        </p>
        <p>
          Read more about{" "}
          <a
            target="_blank"
            rel="noreferrer"
            href="https://remix.run/dashboard/docs/errors"
          >
            Error Handling in Remix
          </a>
          .
        </p>
      </div>
    </main>
  );
}

/**
 * When app's don't provide a root level uncaught component, we default to this.
 */
export function RemixRootDefaultUncaughtError({ error }: { error: Error }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Uncaught Exception!</title>
      </head>
      <body>
        <RemixDefaultUncaughtException error={error} />
      </body>
    </html>
  );
}
