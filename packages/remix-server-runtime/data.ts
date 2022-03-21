import type { RouteMatch } from "./routeMatching";
import type { ServerRoute } from "./routes";
import { json, isResponse, isRedirectResponse } from "./responses";

/**
 * An object of arbitrary for route loaders and actions provided by the
 * server's `getLoadContext()` function.
 */
export type AppLoadContext = any;

/**
 * Data for a route that was returned from a `loader()`.
 */
export type AppData = any;

export async function callRouteAction({
  loadContext,
  match,
  request,
}: {
  loadContext: unknown;
  match: RouteMatch<ServerRoute>;
  request: Request;
}) {
  let action = match.route.module.action;

  if (!action) {
    let response = new Response(null, { status: 405 });
    response.headers.set("X-Remix-Catch", "yes");
    return response;
  }

  let result;
  try {
    result = await action({
      request: stripDataParam(stripIndexParam(request)),
      context: loadContext,
      params: match.params,
    });
  } catch (error: unknown) {
    if (!isResponse(error)) {
      throw error;
    }

    if (!isRedirectResponse(error)) {
      error.headers.set("X-Remix-Catch", "yes");
    }
    result = error;
  }

  if (result === undefined) {
    throw new Error(
      `You defined an action for route "${match.route.id}" but didn't return ` +
        `anything from your \`action\` function. Please return a value or \`null\`.`
    );
  }

  if (!isResponse(result)) {
    console.warn(
      `You returned a values other than a \`Response\` object from the action for route "${match.route.id}". This is deprecated and will result in a server error in a future version of Remix.

To fix this and remove the warning, you can return the same value passed into our \`json\` helper function which will construct a \`Response\` instance:


    // before
    export async function action() {
      return someData;
    }

    // after
    import { json } from "remix";

    export async function action() {
      return json(someData);
    }

    // You can also return a \`Response\` directly:
    export async function action() {
      return new Response(someData, {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
`
    );
    return json(result);
  }
  return result;
}

export async function callRouteLoader({
  loadContext,
  match,
  request,
}: {
  request: Request;
  match: RouteMatch<ServerRoute>;
  loadContext: unknown;
}) {
  let loader = match.route.module.loader;

  if (!loader) {
    throw new Error(
      `You made a ${request.method} request to ${request.url} but did not provide ` +
        `a \`loader\` for route "${match.route.id}", so there is no way to handle the ` +
        `request.`
    );
  }

  let result;
  try {
    result = await loader({
      request: stripDataParam(stripIndexParam(request.clone())),
      context: loadContext,
      params: match.params,
    });
  } catch (error: unknown) {
    if (!isResponse(error)) {
      throw error;
    }

    if (!isRedirectResponse(error)) {
      error.headers.set("X-Remix-Catch", "yes");
    }
    result = error;
  }

  if (result === undefined) {
    throw new Error(
      `You defined a loader for route "${match.route.id}" but didn't return ` +
        `anything from your \`loader\` function. Please return a value or \`null\`.`
    );
  }

  if (!isResponse(result)) {
    console.warn(
      `You returned a values other than a \`Response\` object from the loader for route "${match.route.id}". This is deprecated and will result in a server error in a future version of Remix.

  To fix this and remove the warning, you can return the same value passed into our \`json\` helper function which will construct a \`Response\` instance:


      // before
      export async function loader() {
        return someData;
      }

      // after
      import { json } from "remix";

      export async function loader() {
        return json(someData);
      }

      // You can also return an \`Response\` directly:
      export async function loader() {
        return new Response(someData, {
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
  `
    );
    return json(result);
  }
  return result;
}

function stripIndexParam(request: Request) {
  let url = new URL(request.url);
  let indexValues = url.searchParams.getAll("index");
  url.searchParams.delete("index");
  let indexValuesToKeep = [];
  for (let indexValue of indexValues) {
    if (indexValue) {
      indexValuesToKeep.push(indexValue);
    }
  }
  for (let toKeep of indexValuesToKeep) {
    url.searchParams.append("index", toKeep);
  }

  return new Request(url.href, request);
}

function stripDataParam(request: Request) {
  let url = new URL(request.url);
  url.searchParams.delete("_data");
  return new Request(url.href, request);
}

export function extractData(response: Response): Promise<unknown> {
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  // What other data types do we need to handle here? What other kinds of
  // responses are people going to be returning from their loaders?
  // - application/x-www-form-urlencoded ?
  // - multipart/form-data ?
  // - binary (audio/video) ?

  return response.text();
}
