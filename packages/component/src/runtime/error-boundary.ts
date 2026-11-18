import { isRemixNode, type RemixNode } from './core/vnode.ts'
import type { Handle, RenderFn } from './component.ts'

/**
 * Renders the UI an {@link ErrorBoundary} shows in place of its children after they throw.
 *
 * @param error The value thrown while rendering the children. In the browser, a fallback
 * hydrated from server HTML receives a generic `Error` because the server does not send error
 * details to the browser.
 * @param retry Renders the children again with new component instances. Does nothing on the
 * server.
 * @returns Content to render in place of the children.
 */
export type ErrorBoundaryFallback = (error: unknown, retry: () => void) => RemixNode

/**
 * Props accepted by the built-in {@link ErrorBoundary} component.
 */
export interface ErrorBoundaryProps {
  /** Content to render until it throws. */
  children?: RemixNode
  /**
   * Content to render when the children throw while rendering. Pass a function to read the
   * error or to let the user render the children again.
   */
  fallback: RemixNode | ErrorBoundaryFallback
}

/**
 * Built-in component that renders fallback content when its children throw during setup or
 * render.
 *
 * On the server, a boundary renders its fallback in place of children that throw or contain a
 * blocking `<Frame>` that fails to resolve. The rest of the document still renders, and the
 * error is reported to the `onError` option of `renderToStream()`.
 *
 * In the browser, a boundary catches errors from its children's first render, hydration, and
 * later updates. It removes the failed content, disposes its components, logs the error with
 * `console.error()`, and renders the fallback. The boundary keeps showing the fallback until
 * `retry` is called or it is replaced, such as by changing its `key`.
 *
 * Errors thrown by event handlers, queued tasks, and frame reloads are not caught. Errors thrown
 * by the fallback itself are caught by the next boundary up.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, retry) => (
 *     <div role="alert">
 *       <p>Reviews failed to load.</p>
 *       <button type="button" mix={on('click', retry)}>
 *         Try again
 *       </button>
 *     </div>
 *   )}
 * >
 *   <Reviews bookId={book.id} />
 * </ErrorBoundary>
 * ```
 *
 * @param handle Component handle for the boundary instance.
 * @returns A render function that renders the children. The renderer swaps in the fallback.
 */
export function ErrorBoundary(handle: Handle<ErrorBoundaryProps>): RenderFn {
  return () => handle.props.children
}

/**
 * Resolves an {@link ErrorBoundary}'s fallback content for an error.
 *
 * @param fallback The boundary's `fallback` prop.
 * @param error Error caught by the boundary.
 * @param retry Renders the children again.
 * @returns Fallback content.
 */
export function renderErrorBoundaryFallback(
  fallback: unknown,
  error: unknown,
  retry: () => void,
): RemixNode {
  if (isFallbackFunction(fallback)) return fallback(error, retry)
  if (!isRemixNode(fallback)) {
    throw new TypeError('ErrorBoundary fallback must be a function or renderable content')
  }
  return fallback
}

function isFallbackFunction(value: unknown): value is ErrorBoundaryFallback {
  return typeof value === 'function'
}
