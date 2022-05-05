import type { Readable } from "stream";
import {
  fetch as nodeFetch,
  Headers as BaseNodeHeaders,
  Request as BaseNodeRequest,
  Response as BaseNodeResponse,
} from "@remix-run/web-fetch";
export { File, Blob } from "@remix-run/web-file";

type NodeHeadersInit = ConstructorParameters<typeof BaseNodeHeaders>[0];
type NodeResponseBody = ConstructorParameters<typeof BaseNodeResponse>[0];
type NodeResponseInit = NonNullable<
  ConstructorParameters<typeof BaseNodeResponse>[1]
>;
type NodeRequestInfo =
  | ConstructorParameters<typeof BaseNodeRequest>[0]
  | NodeRequest;
type NodeRequestInit = Omit<
  NonNullable<ConstructorParameters<typeof BaseNodeRequest>[1]>,
  "body"
> & {
  body?:
    | NonNullable<ConstructorParameters<typeof BaseNodeRequest>[1]>["body"]
    | Readable;
};

export type {
  NodeHeadersInit as HeadersInit,
  NodeRequestInfo as RequestInfo,
  NodeRequestInit as RequestInit,
  NodeResponseInit as ResponseInit,
};

class NodeRequest extends BaseNodeRequest {
  constructor(info: NodeRequestInfo, init?: NodeRequestInit) {
    super(info, init as RequestInit);
  }

  public get headers(): BaseNodeHeaders {
    return super.headers as BaseNodeHeaders;
  }

  public clone(): NodeRequest {
    return new NodeRequest(this);
  }
}

class NodeResponse extends BaseNodeResponse {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(input: NodeResponseBody, init?: NodeResponseInit) {
    super(input, init);
  }

  public get headers(): BaseNodeHeaders {
    return super.headers as BaseNodeHeaders;
  }

  public clone(): NodeResponse {
    return new NodeResponse(super.clone().body, {
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      size: this.size,
    });
  }
}

export {
  BaseNodeHeaders as Headers,
  NodeRequest as Request,
  NodeResponse as Response,
};

export const fetch: typeof nodeFetch = (
  input: NodeRequestInfo,
  init?: NodeRequestInit
) => {
  init = {
    compress: false,
    ...init,
  };

  return nodeFetch(input, init as RequestInit);
};
