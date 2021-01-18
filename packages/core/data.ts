import type { Params } from "react-router";

import type { AppLoadContext, AppData, RouteModule } from "./buildModules";
import { Request, Response, isResponseLike } from "./fetch";
import { json } from "./responseHelpers";
import type { Session } from "./sessions";

export async function loadRouteData(
  routeId: string,
  routeModule: RouteModule,
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params
): Promise<Response> {
  if (!routeModule.loader) {
    return Promise.resolve(json(null));
  }

  let result = await routeModule.loader({ request, session, context, params });

  if (result === undefined) {
    throw new Error(
      `You defined a loader for route "${routeId}" but didn't return ` +
        `anything from your \`loader\` function. We can't do everything for you! 😅`
    );
  }

  return isResponseLike(result) ? result : json(result);
}

export async function callRouteAction(
  routeId: string,
  routeModule: RouteModule,
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params
): Promise<Response> {
  if (!routeModule.action) {
    throw new Error(
      `You made a ${request.method} request to ${request.url} but did not provide ` +
        `an \`action\` for route "${routeId}", so there is no way to handle the ` +
        `request.`
    );
  }

  let result = await routeModule.action({ request, session, context, params });

  if (!isResponseLike(result) || result.headers.get("Location") == null) {
    throw new Error(
      `You made a ${request.method} request to ${request.url} but did not return ` +
        `a redirect. Please \`return redirect(newUrl)\` from your \`action\` ` +
        `function to avoid reposts when users click the back button.`
    );
  }

  return new Response("", {
    status: 303,
    headers: result.headers
  });
}

/**
 * Extracts the actual data from a data loader result.
 */
export function extractData(response: Response): Promise<AppData> {
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
