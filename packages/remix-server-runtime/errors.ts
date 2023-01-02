import type { StaticHandlerContext } from "@remix-run/router";
import { isRouteErrorResponse } from "@remix-run/router";

/**
 * This thing probably warrants some explanation.
 *
 * The whole point here is to emulate componentDidCatch for server rendering and
 * data loading. It can get tricky. React can do this on component boundaries
 * but doesn't support it for server rendering or data loading. We know enough
 * with nested routes to be able to emulate the behavior (because we know them
 * statically before rendering.)
 *
 * Each route can export an `ErrorBoundary`.
 *
 * - When rendering throws an error, the nearest error boundary will render
 *   (normal react componentDidCatch). This will be the route's own boundary, but
 *   if none is provided, it will bubble up to the parents.
 * - When data loading throws an error, the nearest error boundary will render
 * - When performing an action, the nearest error boundary for the action's
 *   route tree will render (no redirect happens)
 *
 * During normal react rendering, we do nothing special, just normal
 * componentDidCatch.
 *
 * For server rendering, we mutate `renderBoundaryRouteId` to know the last
 * layout that has an error boundary that tried to render. This emulates which
 * layout would catch a thrown error. If the rendering fails, we catch the error
 * on the server, and go again a second time with the emulator holding on to the
 * information it needs to render the same error boundary as a dynamically
 * thrown render error.
 *
 * When data loading, server or client side, we use the emulator to likewise
 * hang on to the error and re-render at the appropriate layout (where a thrown
 * error would have been caught by cDC).
 *
 * When actions throw, it all works the same. There's an edge case to be aware
 * of though. Actions normally are required to redirect, but in the case of
 * errors, we render the action's route with the emulator holding on to the
 * error. If during this render a parent route/loader throws we ignore that new
 * error and render the action's original error as deeply as possible. In other
 * words, we simply ignore the new error and use the action's error in place
 * because it came first, and that just wouldn't be fair to let errors cut in
 * line.
 */

// TODO Re-export as ErrorResponse?
export interface ThrownResponse<T = any> {
  status: number;
  statusText: string;
  data: T;
}

// must be type alias due to inference issues on interfaces
// https://github.com/microsoft/TypeScript/issues/15300
export type SerializedError = {
  message: string;
  stack?: string;
};

export async function serializeError(error: Error): Promise<SerializedError> {
  return {
    message: error.message,
    stack: error.stack,
  };
}

export function serializeErrors(
  errors: StaticHandlerContext["errors"]
): StaticHandlerContext["errors"] {
  if (!errors) return null;
  let entries = Object.entries(errors);
  let serialized: StaticHandlerContext["errors"] = {};
  for (let [key, val] of entries) {
    // Hey you!  If you change this, please change the corresponding logic in
    // deserializeErrors in remix-react/errors.ts :)
    if (isRouteErrorResponse(val)) {
      serialized[key] = { ...val, __type: "RouteErrorResponse" };
    } else if (val instanceof Error) {
      serialized[key] = {
        message: val.message,
        stack: val.stack,
        __type: "Error",
      };
    } else {
      serialized[key] = val;
    }
  }
  return serialized;
}
