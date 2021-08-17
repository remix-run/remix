/**
 * A JSON response. Converts `data` to JSON and sets the `Content-Type` header.
 */
export function json<TResponse = Response, TResponseInit = ResponseInit>(
  data: any,
  init: number | TResponseInit
): TResponse {
  let responseInit: any = init;
  if (typeof init === "number") {
    responseInit = { status: init };
  }

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return (new Response(JSON.stringify(data), {
    ...responseInit,
    headers
  }) as unknown) as TResponse;
}

/**
 * A redirect response. Sets the status code and the `Location` header.
 * Defaults to "302 Found".
 */
export function redirect<TResponse = Response, TResponseInit = ResponseInit>(
  url: string,
  init: number | TResponseInit
): TResponse {
  let responseInit: any = init;
  if (typeof init === "number") {
    responseInit = { status: init };
  } else if (typeof responseInit.status === "undefined") {
    responseInit.status = 302;
  }

  let headers = new Headers(responseInit.headers);
  headers.set("Location", url);

  return (new Response("", {
    ...responseInit,
    headers
  }) as unknown) as TResponse;
}
