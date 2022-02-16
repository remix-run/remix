import lambdaTester from "lambda-tester";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";

import {
  createRequestHandler,
  createRemixHeaders,
  createRemixRequest
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the architect adapter
jest.mock("@remix-run/server-runtime");
let mockedCreateRequestHandler =
  createRemixRequestHandler as jest.MockedFunction<
    typeof createRemixRequestHandler
  >;

function createMockEvent(event: Partial<APIGatewayProxyEventV2> = {}) {
  let now = new Date();
  return {
    headers: {
      host: "localhost:3333",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
      "accept-language": "en-US,en;q=0.9",
      "accept-encoding": "gzip, deflate",
      ...event.headers
    },
    isBase64Encoded: false,
    rawPath: "/",
    rawQueryString: "",
    requestContext: {
      http: {
        method: "GET",
        path: "/",
        protocol: "HTTP/1.1",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
        sourceIp: "127.0.0.1",
        ...event.requestContext?.http
      },
      routeKey: "ANY /{proxy+}",
      accountId: "accountId",
      requestId: "requestId",
      apiId: "apiId",
      domainName: "id.execute-api.us-east-1.amazonaws.com",
      domainPrefix: "id",
      stage: "test",
      time: now.toISOString(),
      timeEpoch: now.getTime(),
      ...event.requestContext
    },
    routeKey: "foo",
    version: "2.0",
    ...event
  };
}

describe("architect createRequestHandler", () => {
  describe("basic requests", () => {
    afterEach(() => {
      mockedCreateRequestHandler.mockReset();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("handles requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async req => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      await lambdaTester(createRequestHandler({ build: undefined } as any))
        .event(createMockEvent({ rawPath: "/foo/bar" }))
        .expectResolve(res => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: /foo/bar");
        });
    });

    it("handles null body", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 200 });
      });

      await lambdaTester(createRequestHandler({ build: undefined } as any))
        .event(createMockEvent({ rawPath: "/foo/bar" }))
        .expectResolve(res => {
          expect(res.statusCode).toBe(200);
        });
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 204 });
      });

      await lambdaTester(createRequestHandler({ build: undefined } as any))
        .event(createMockEvent({ rawPath: "/foo/bar" }))
        .expectResolve(res => {
          expect(res.statusCode).toBe(204);
        });
    });

    it("sets headers", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        let headers = new Headers();
        headers.append("X-Time-Of-Year", "most wonderful");
        headers.append(
          "Set-Cookie",
          "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        headers.append(
          "Set-Cookie",
          "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax"
        );
        headers.append(
          "Set-Cookie",
          "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax"
        );

        return new Response(null, { headers });
      });

      await lambdaTester(createRequestHandler({ build: undefined } as any))
        .event(createMockEvent({ rawPath: "/" }))
        .expectResolve(res => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["x-time-of-year"]).toBe("most wonderful");
          expect(res.cookies).toEqual([
            "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax",
            "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax",
            "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax"
          ]);
        });
    });
  });
});

describe("architect createRemixHeaders", () => {
  describe("creates fetch headers from architect headers", () => {
    it("handles empty headers", () => {
      expect(createRemixHeaders({}, undefined)).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {},
        }
      `);
    });

    it("handles simple headers", () => {
      expect(createRemixHeaders({ "x-foo": "bar" }, undefined))
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
      expect(createRemixHeaders({ "x-foo": "bar", "x-bar": "baz" }, undefined))
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
      expect(createRemixHeaders({ "x-foo": "bar, baz" }, undefined))
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
        createRemixHeaders({ "x-foo": "bar, baz", "x-bar": "baz" }, undefined)
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
        createRemixHeaders({ "x-something-else": "true" }, [
          "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
          "__other=some_other_value; Path=/; Secure; HttpOnly; Expires=Wed, 21 Oct 2015 07:28:00 GMT; SameSite=Lax"
        ])
      ).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "Cookie": Array [
              "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
              "__other=some_other_value; Path=/; Secure; HttpOnly; Expires=Wed, 21 Oct 2015 07:28:00 GMT; SameSite=Lax",
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
          cookies: ["__session=value"]
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
