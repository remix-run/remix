import type { FormMethod as FormMethodRR } from "react-router-dom";

export type AppData = any;

export type FormMethod = FormMethodRR;

export type FormEncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data";

export function isCatchResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Catch") != null
  );
}

export function isErrorResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Error") != null
  );
}

export function isRedirectResponse(response: any): boolean {
  return (
    response instanceof Response &&
    response.headers.get("X-Remix-Redirect") != null
  );
}

export async function fetchData(
  request: Request,
  routeId: string,
  isAction: boolean
): Promise<Response | Error> {
  let url = new URL(request.url);
  url.searchParams.set("_data", routeId);

  let init: RequestInit | undefined;

  // TODO: There's a bug in @remix-run/router here at the moment where the
  // loader Request keeps method POST after a submission.  Matt has a local
  // fix but this does the trick for now.  Once the fix is merged to the
  // router, we can remove the isAction param and use the method here
  // if (request.method !== "GET") {
  if (isAction) {
    init = {
      method: request.method,
      body: await request.formData(),
    };
  }

  // TODO: Dropped credentials:"same-origin" since it's the default
  let response = await fetch(url.href, init);

  if (isErrorResponse(response)) {
    let data = await response.json();
    let error = new Error(data.message);
    error.stack = data.stack;
    return error;
  }

  // TODO: Confirm difference between regex extractData JSON detection versus
  // @remix-run/router detection
  return response;
}
