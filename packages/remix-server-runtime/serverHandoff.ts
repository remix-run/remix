import type { HydrationState } from "@remix-run/router";

import type { AssetsManifest, FutureConfig } from "./entry";
import { escapeHtml } from "./markup";

type ValidateShape<T, Shape> =
  // If it extends T
  T extends Shape
    ? // and there are no leftover props after removing the base
      Exclude<keyof T, keyof Shape> extends never
      ? // we are good
        T
      : // otherwise it's either too many or too few props
        never
    : never;

// TODO: Remove Promises from serialization
export function createServerHandoffString<T>(serverHandoff: {
  // Don't allow StaticHandlerContext to be passed in verbatim, since then
  // we'd end up including duplicate info
  state: ValidateShape<T, HydrationState>;
  criticalCss?: string;
  url: string;
  future: FutureConfig;
  isSpaMode: boolean;
}): string {
  // Uses faster alternative of jsesc to escape data returned from the loaders.
  // This string is inserted directly into the HTML in the `<Scripts>` element.
  return escapeHtml(JSON.stringify(serverHandoff));
}

export function remixContextJsString(handoff: string) {
  return `window.__remixContext = ${handoff};`;
}

export function remixEntryJsString(
  manifest: AssetsManifest,
  routeIds: string[],
  handoff?: string
) {
  let str = JSON.stringify;
  return [
    manifest.hmrRuntime ? `import ${str(manifest.hmrRuntime)};` : "",
    `import ${JSON.stringify(manifest.url)};`,
    ...routeIds.map(
      (id, i) =>
        `import * as route${i} from ${str(manifest.routes[id].module)};`
    ),
    // If we got a handoff, insert it after the imports (used for SPA mode library mode)
    handoff ? remixContextJsString(handoff) : "",
    `window.__remixRouteModules = {${routeIds
      .map((id, index) => `${str(id)}:route${index}`)
      .join(",")}}`,
    `import(${str(manifest.entry.module)});`,
  ]
    .filter((l) => l)
    .join("\n");
}
