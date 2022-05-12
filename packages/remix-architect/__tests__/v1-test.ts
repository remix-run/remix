import fsp from "fs/promises";
import path from "path";
import type { APIGatewayProxyEvent } from "aws-lambda";
import {
  // This has been added as a global in node 15+
  AbortController,
  Response as NodeResponse,
} from "@remix-run/node";

import {
  createRemixHeaders,
  createRemixRequest,
  sendRemixResponse
} from "../api/v1";

function createMockEvent(event: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  let now = new Date();

  const headers = {
    host: "localhost:3333",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "upgrade-insecure-requests": "1",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate",
    ...event.headers,
  };

  delete event.headers;

  const requestContext = {
    httpMethod: "GET",
    routeKey: "ANY /{proxy+}",
    accountId: "accountId",
    requestId: "requestId",
    apiId: "apiId",
    domainName: "id.execute-api.us-east-1.amazonaws.com",
    domainPrefix: "id",
    stage: "test",
    requestTime: now.toISOString(),
    requestTimeEpoch: now.getTime(),
    ...event.requestContext,
  }

  delete event.requestContext;

  return {
    isBase64Encoded: false,
    resource: "/",
    path: "/",
    httpMethod: "GET",
    headers,
    multiValueHeaders: {},
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
    requestContext,
    pathParameters: null,
    stageVariables: null,
    body: "",
    ...event,
  };
}

describe("architect createRemixHeaders", () => {
  describe("creates fetch headers from architect headers", () => {
    it("handles empty headers", () => {
      expect(createRemixHeaders({})).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {},
        }
      `);
    });

    it("handles simple headers", () => {
      expect(createRemixHeaders({"x-foo": "bar"}))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "x-foo": Array [
              "bar",
            ],
          },
        }
      `);
    });

    it("handles multiple headers", () => {
      expect(createRemixHeaders({"x-foo": "bar", "x-bar": "baz"}))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "x-bar": Array [
              "baz",
            ],
            "x-foo": Array [
              "bar",
            ],
          },
        }
      `);
    });

    it("handles headers with multiple values", () => {
      expect(createRemixHeaders({"x-foo": "bar, baz"}))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "x-foo": Array [
              "bar, baz",
            ],
          },
        }
      `);
    });

    it("handles headers with multiple values and multiple headers", () => {
      expect(
        createRemixHeaders({"x-foo": "bar, baz", "x-bar": "baz"})
      ).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "x-bar": Array [
              "baz",
            ],
            "x-foo": Array [
              "bar, baz",
            ],
          },
        }
      `);
    });

    it("handles cookies", () => {
      expect(
        createRemixHeaders({
          "x-something-else": "true",
          "Cookie": "__session=some_value; __other=some_other_value"
        })
      ).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "Cookie": Array [
              "__session=some_value; __other=some_other_value",
            ],
            "x-something-else": Array [
              "true",
            ],
          },
        }
      `);
    });
  });
});

describe("architect createRemixRequest", () => {
  it("creates a request with the correct headers", () => {
    expect(
      createRemixRequest(
        createMockEvent({
          headers: {
            Cookie: "__session=value"
          },
        })
      )
    ).toMatchInlineSnapshot(`
      NodeRequest {
        "abortController": undefined,
        "agent": undefined,
        "compress": true,
        "counter": 0,
        "follow": 20,
        "size": 0,
        "timeout": 0,
        Symbol(Body internals): Object {
          "body": null,
          "disturbed": false,
          "error": null,
        },
        Symbol(Request internals): Object {
          "headers": Headers {
            Symbol(map): Object {
              "Cookie": Array [
                "__session=value",
              ],
              "accept": Array [
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              ],
              "accept-encoding": Array [
                "gzip, deflate",
              ],
              "accept-language": Array [
                "en-US,en;q=0.9",
              ],
              "host": Array [
                "localhost:3333",
              ],
              "upgrade-insecure-requests": Array [
                "1",
              ],
              "user-agent": Array [
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
              ],
            },
          },
          "method": "GET",
          "parsedURL": Url {
            "auth": null,
            "hash": null,
            "host": "localhost:3333",
            "hostname": "localhost",
            "href": "https://localhost:3333/",
            "path": "/",
            "pathname": "/",
            "port": "3333",
            "protocol": "https:",
            "query": null,
            "search": null,
            "slashes": true,
          },
          "redirect": "follow",
          "signal": undefined,
        },
      }
    `);
  });
});

describe("sendRemixResponse", () => {
  it("handles regular responses", async () => {
    let response = new NodeResponse("anything");
    let abortController = new AbortController();
    let result = await sendRemixResponse(response, abortController);
    expect(result.body).toBe("anything");
  });

  it("handles resource routes with regular data", async () => {
    let json = JSON.stringify({foo: "bar"});
    let response = new NodeResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "content-length": json.length.toString(),
      },
    });

    let abortController = new AbortController();

    let result = await sendRemixResponse(response, abortController);

    expect(result.body).toMatch(json);
  });

  it("handles resource routes with binary data", async () => {
    let image = await fsp.readFile(path.join(__dirname, "554828.jpeg"));

    let response = new NodeResponse(image, {
      headers: {
        "content-type": "image/jpeg",
        "content-length": image.length.toString(),
      },
    });

    let abortController = new AbortController();

    let result = await sendRemixResponse(response, abortController);

    expect(result.body).toMatch(image.toString("base64"));
  });
});
