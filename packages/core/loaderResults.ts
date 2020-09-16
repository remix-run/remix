export class LoaderResult {
  readonly routeId: string;
  readonly httpStatus: number;
  constructor(routeId: string, httpStatus = 200) {
    this.routeId = routeId;
    this.httpStatus = httpStatus;
  }
}

export class LoaderResultChangeStatusCode extends LoaderResult {}

export class LoaderResultCopy extends LoaderResult {}

export class LoaderResultError extends LoaderResult {
  readonly message: string;
  readonly stack?: string;
  constructor(routeId: string, message: string, stack?: string) {
    super(routeId, 500);
    this.message = message;
    this.stack = stack;
  }
}

export class LoaderResultRedirect extends LoaderResult {
  readonly location: string;
  constructor(routeId: string, location: string, httpStatus = 302) {
    super(routeId, httpStatus);
    this.location = location;
  }
}

export class LoaderResultSuccess extends LoaderResult {
  readonly data: any;
  constructor(routeId: string, data: any) {
    super(routeId);
    this.data = data;
  }
}

export function loaderResultJsonStringifyReplacer(
  _key: string,
  value: any
): any {
  if (value instanceof LoaderResult) {
    if (value instanceof LoaderResultChangeStatusCode) {
      return {
        type: "LoaderResultChangeStatusCode",
        routeId: value.routeId,
        httpStatus: value.httpStatus
      };
    }

    if (value instanceof LoaderResultCopy) {
      return { type: "LoaderResultCopy", routeId: value.routeId };
    }

    if (value instanceof LoaderResultError) {
      return {
        type: "LoaderResultError",
        routeId: value.routeId,
        message: value.message,
        stack: value.stack
      };
    }

    if (value instanceof LoaderResultRedirect) {
      return {
        type: "LoaderResultRedirect",
        routeId: value.routeId,
        httpStatus: value.httpStatus,
        location: value.location
      };
    }

    if (value instanceof LoaderResultSuccess) {
      return {
        type: "LoaderResultSuccess",
        routeId: value.routeId,
        data: value.data
      };
    }
  }

  return value;
}

export function stringifyLoaderResults(
  results: LoaderResult[],
  space = 0
): string {
  return JSON.stringify(results, loaderResultJsonStringifyReplacer, space);
}

export function loaderResultJsonParseReviver(_key: string, value: any): any {
  if (value) {
    if (value.type === "LoaderResultChangeStatusCode") {
      return new LoaderResultChangeStatusCode(value.routeId, value.httpStatus);
    }

    if (value.type === "LoaderResultCopy") {
      return new LoaderResultCopy(value.routeId);
    }

    if (value.type === "LoaderResultError") {
      return new LoaderResultError(value.routeId, value.message, value.stack);
    }

    if (value.type === "LoaderResultRedirect") {
      return new LoaderResultRedirect(
        value.routeId,
        value.location,
        value.httpStatus
      );
    }

    if (value.type === "LoaderResultSuccess") {
      return new LoaderResultSuccess(value.routeId, value.data);
    }
  }

  return value;
}

export function parseLoaderResults(results: string): any {
  return JSON.parse(results, loaderResultJsonParseReviver);
}
