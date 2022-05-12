import {
  Headers as NodeHeaders,
  Request as NodeRequest
} from "@remix-run/node";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult
} from "aws-lambda";
import type {
  // This has been added as a global in node 15+
  AbortController,
  Response as NodeResponse,
} from "@remix-run/node";
import { URLSearchParams } from "url";

import { isBinaryType } from "../binaryTypes";

export function createRemixRequest(
  event: APIGatewayProxyEvent,
  abortController?: AbortController
): NodeRequest {
  let host = event.headers["x-forwarded-host"] || event.headers.host;
  let scheme = process.env.ARC_SANDBOX ? "http" : "https";
  let url = new URL(event.path, `${scheme}://${host}`);

  if (
    event.queryStringParameters &&
    Object.keys(event.queryStringParameters).length
  ) {
    url.search = `?${new URLSearchParams(event.queryStringParameters as unknown as Iterable<[string, string]>).toString()}`
  }

  let isFormData = event.headers["content-type"]?.includes(
    "multipart/form-data"
  );

  return new NodeRequest(url.href, {
    method: event.requestContext.httpMethod,
    headers: createRemixHeaders(event.headers),
    body:
      event.body && event.isBase64Encoded
        ? isFormData
          ? Buffer.from(event.body, "base64")
          : Buffer.from(event.body, "base64").toString()
        : event.body || undefined,
    abortController,
    signal: abortController?.signal,
  });
}

export function createRemixHeaders(
  requestHeaders: APIGatewayProxyEventHeaders
): NodeHeaders {
  let headers = new NodeHeaders();

  for (let [header, value] of Object.entries(requestHeaders)) {
    if (value) {
      headers.append(header, value);
    }
  }

  return headers;
}

export async function sendRemixResponse(
  nodeResponse: NodeResponse,
  abortController: AbortController
): Promise<APIGatewayProxyResult> {
  if (abortController.signal.aborted) {
    nodeResponse.headers.set("Connection", "close");
  }

  let contentType = nodeResponse.headers.get("Content-Type");
  let isBinary = isBinaryType(contentType);
  let body;
  let isBase64Encoded = false;

  if (isBinary) {
    let blob = await nodeResponse.arrayBuffer();
    body = Buffer.from(blob).toString("base64");
    isBase64Encoded = true;
  } else {
    body = await nodeResponse.text();
  }

  return {
    statusCode: nodeResponse.status,
    headers: Object.fromEntries(nodeResponse.headers),
    body,
    isBase64Encoded,
  };
}