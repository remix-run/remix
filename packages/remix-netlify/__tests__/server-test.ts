import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node/server";

import { createRemixHeaders, createRemixRequest } from "../server";
import { HandlerEvent } from "@netlify/functions";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the netlify adapter
jest.mock("@remix-run/node/server");
let mockedCreateRequestHandler = createRemixRequestHandler as jest.MockedFunction<
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

    it.todo("handles requests");

    it.todo("handles status codes");

    it.todo("sets headers");
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
