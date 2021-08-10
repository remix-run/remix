import fs from "fs";
import fsp from "fs/promises";
import path from "path";

import type { NullableMappedPosition } from "source-map";
import { SourceMapConsumer } from "source-map";

const ROOT = process.cwd() + "/";
const SOURCE_PATTERN = /(?<at>\s+at.+)\((?<filename>.+):(?<line>\d+):(?<column>\d+)\)/;

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

export interface ComponentDidCatchEmulator {
  error?: SerializedError;
  loaderBoundaryRouteId: string | null;
  // `null` means the app layout threw before any routes rendered
  renderBoundaryRouteId: string | null;
  trackBoundaries: boolean;
}

export interface SerializedError {
  message: string;
  stack?: string;
}

export async function serializeError(error: Error): Promise<SerializedError> {
  let stack = await formatStackTrace(error);

  return {
    message: error.message,
    stack
  };
}

export async function formatServerError(error: Error): Promise<Error> {
  error.stack = await formatStackTrace(error);
  return error;
}

export async function formatStackTrace(error: Error) {
  const cache = new Map();
  const lines = error.stack?.split("\n") || [];
  const promises = lines.map(line => mapToSourceFile(cache, line));
  const stack = (await Promise.all(promises)).join("\n") || error.stack;

  return stack;
}

export async function mapToSourceFile(
  cache: Map<string, SourceMapConsumer>,
  stackLine: string
) {
  let match = SOURCE_PATTERN.exec(stackLine);

  if (!match?.groups) {
    // doesn't match pattern but may still have a filename
    return relativeFilename(stackLine);
  }

  let { at, filename } = match.groups;
  let line: number | string = match.groups.line;
  let column: number | string = match.groups.column;
  let mapFilename = `${filename}.map`;
  let smc = cache.get(mapFilename);
  filename = relativeFilename(filename);

  if (!smc) {
    if (
      await fsp
        .access(mapFilename, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false)
    ) {
      // read source map and setup consumer
      const map = JSON.parse(await fsp.readFile(mapFilename, "utf-8"));
      map.sourceRoot = path.dirname(mapFilename);
      smc = await new SourceMapConsumer(map);
      cache.set(mapFilename, smc);
    }
  }

  if (smc) {
    const pos = getOriginalPositionFor(
      smc,
      parseInt(line, 10),
      parseInt(column, 10)
    );

    if (pos.source) {
      filename = relativeFilename(pos.source);
      line = pos.line || "?";
      column = pos.column || "?";
      at = `    at \`${getSourceContentFor(smc, pos)}\` `;
    }
  }

  return `${at}(${filename}:${line}:${column})`;
}

export function relativeFilename(filename: string) {
  if (filename.includes("route-module:")) {
    filename = filename.substring(filename.indexOf("route-module:"));
  }
  return filename.replace("route-module:", "").replace(ROOT, "./");
}

export function getOriginalPositionFor(
  smc: SourceMapConsumer,
  line: number,
  column: number
) {
  return smc.originalPositionFor({ line, column });
}

export function getSourceContentFor(
  smc: SourceMapConsumer,
  pos: NullableMappedPosition
) {
  let src: string | null = null;
  if (pos?.source && typeof pos.line === "number") {
    src = smc.sourceContentFor(pos.source);
  }

  if (!src) {
    return "<unknonwn location>";
  }

  return src.split("\n")[pos.line! - 1].trim();
}
