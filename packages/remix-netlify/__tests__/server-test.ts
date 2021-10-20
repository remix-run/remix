import lambdaTester from "lambda-tester";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import type { HandlerEvent } from "@netlify/functions";

import {
  createRemixHeaders,
  createRemixRequest,
  createRequestHandler
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the netlify adapter
jest.mock("@remix-run/server-runtime");
let mockedCreateRequestHandler =
  createRemixRequestHandler as jest.MockedFunction<
    typeof createRemixRequestHandler
  >;

function createMockEvent(event: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    rawUrl: "http://localhost:3000/",
    rawQuery: "",
    path: "/",
    httpMethod: "GET",
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...event
  };
}

describe("netlify createRequestHandler", () => {
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

      // @ts-expect-error We don't have a real app to test, but it doesn't matter. We
      // won't ever call through to the real createRequestHandler
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000/foo/bar" }))
        .expectResolve(res => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: /foo/bar");
        });
    });

    it("handles null body", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 200 });
      });

      // @ts-expect-error We don't have a real app to test, but it doesn't matter. We
      // won't ever call through to the real createRequestHandler
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000" }))
        .expectResolve(res => {
          expect(res.statusCode).toBe(200);
        });
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response("", { status: 204 });
      });

      // @ts-expect-error We don't have a real app to test, but it doesn't matter. We
      // won't ever call through to the real createRequestHandler
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000" }))
        .expectResolve(res => {
          expect(res.statusCode).toBe(204);
        });
    });

    it("sets headers", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        const headers = new Headers({ "X-Time-Of-Year": "most wonderful" });
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

        return new Response("", { headers });
      });

      // @ts-expect-error We don't have a real app to test, but it doesn't matter. We
      // won't ever call through to the real createRequestHandler
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000" }))
        .expectResolve(res => {
          expect(res.multiValueHeaders["X-Time-Of-Year"]).toEqual([
            "most wonderful"
          ]);
          expect(res.multiValueHeaders["Set-Cookie"]).toEqual([
            "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax",
            "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax",
            "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax"
          ]);
        });
    });
  });
});

describe("netlify createRemixHeaders", () => {
  describe("creates fetch headers from netlify headers", () => {
    it("handles empty headers", () => {
      expect(createRemixHeaders({})).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {},
        }
      `);
    });

    it("handles simple headers", () => {
      expect(createRemixHeaders({ "x-foo": ["bar"] })).toMatchInlineSnapshot(`
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
      expect(createRemixHeaders({ "x-foo": ["bar"], "x-bar": ["baz"] }))
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
      expect(createRemixHeaders({ "x-foo": ["bar", "baz"] }))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "x-foo": Array [
              "bar",
              "baz",
            ],
          },
        }
      `);
    });

    it("handles headers with multiple values and multiple headers", () => {
      expect(createRemixHeaders({ "x-foo": ["bar", "baz"], "x-bar": ["baz"] }))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "x-bar": Array [
              "baz",
            ],
            "x-foo": Array [
              "bar",
              "baz",
            ],
          },
        }
      `);
    });

    it("handles cookies", () => {
      expect(
        createRemixHeaders({
          Cookie: [
            "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
            "__other=some_other_value; Path=/; Secure; HttpOnly; Expires=Wed, 21 Oct 2015 07:28:00 GMT; SameSite=Lax"
          ],
          "x-something-else": ["true"]
        })
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

describe("netlify createRemixRequest", () => {
  it("creates a request with the correct headers", () => {
    expect(
      createRemixRequest(
        createMockEvent({
          multiValueHeaders: {
            Cookie: ["__session=value", "__other=value"]
          }
        })
      )
    ).toMatchInlineSnapshot(`
      Request {
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
                "__other=value",
              ],
            },
          },
          "method": "GET",
          "parsedURL": Url {
            "auth": null,
            "hash": null,
            "host": "localhost:3000",
            "hostname": "localhost",
            "href": "http://localhost:3000/",
            "path": "/",
            "pathname": "/",
            "port": "3000",
            "protocol": "http:",
            "query": null,
            "search": null,
            "slashes": true,
          },
          "redirect": "follow",
          "signal": null,
        },
      }
    `);
  });
});
