import type { Params } from "react-router";

import type {
  AppLoadContext,
  AppData,
  LoaderFunction,
  ActionFunction,
  GlobalDataModule,
  RouteModule
} from "./buildModules";
import { Request, Response, isResponseLike } from "./fetch";
import { json } from "./responseHelpers";
import type { Session } from "./sessions";
import invariant from "./invariant";

async function executeLoader(
  loader: LoaderFunction,
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params = {}
): Promise<Response> {
  let result = await loader({ request, session, context, params });
  return isResponseLike(result) ? result : json(result);
}

export function loadGlobalData(
  dataModule: GlobalDataModule,
  request: Request,
  session: Session,
  context: AppLoadContext
): Promise<Response> {
  if (!dataModule.loader) {
    return Promise.resolve(json(null));
  }

  return executeLoader(dataModule.loader, request, session, context);
}

export function loadRouteData(
  routeModule: RouteModule,
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params
): Promise<Response> {
  if (!routeModule.loader) {
    return Promise.resolve(json(null));
  }

  return executeLoader(routeModule.loader, request, session, context, params);
}

async function executeAction(
  action: ActionFunction,
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params = {}
): Promise<Response> {
  let result = await action({ request, session, context, params });

  invariant(
    isResponseLike(result) && result.headers.get("Location") != null,
    `You made a ${request.method} request to ${request.url} but did not return ` +
      `a redirect. Please \`return redirect(newUrl)\` from your \`action\` ` +
      `to avoid reposts when users click the back button.`
  );

  return new Response("", {
    status: 303,
    headers: result.headers
  });
}

export function callRouteAction(
  routeId: string,
  routeModule: RouteModule,
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params
): Promise<Response> {
  invariant(
    routeModule.action,
    `You made a ${request.method} request to ${request.url} but did not provide ` +
      `an \`action\` for route "${routeId}", so there is no way to handle the ` +
      `request.`
  );

  return executeAction(routeModule.action, request, session, context, params);
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
