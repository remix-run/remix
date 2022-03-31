import type { Context, HttpRequest } from "@azure/functions";
import {
  createRequestHandler as createRemixRequestHandler,
} from "@remix-run/node";

import {
  createRemixHeaders,
  createRemixRequest,
  createRequestHandler,
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the express adapter
jest.mock("@remix-run/node", () => {
  let original = jest.requireActual("@remix-run/node");
  return {
    ...original,
    createRequestHandler: jest.fn(),
  };
});

let mockedCreateRequestHandler =
  createRemixRequestHandler as jest.MockedFunction<
    typeof createRemixRequestHandler
  >;

describe("azure createRequestHandler", () => {
  let context: Context;

  beforeEach(() => {
    context = { log: jest.fn() } as unknown as Context;
  });

  describe("basic requests", () => {
    afterEach(() => {
      mockedCreateRequestHandler.mockReset();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("handles requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      let mockedRequest: HttpRequest = {
        method: "GET",
        url: "/foo/bar",
        rawBody: "",
        headers: {
          "x-ms-original-url": "http://localhost:3000/foo/bar",
        },
        params: {},
        query: {},
        body: "",
      };

      let res = await createRequestHandler({ build: undefined })(
        context,
        mockedRequest
      );

      expect(res.status).toBe(200);
      expect(res.body).toBe("URL: /foo/bar");
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response (null, { status: 204 });
      });

      let mockedRequest: HttpRequest = {
        method: "GET",
        url: "/foo/bar",
        rawBody: "",
        headers: {
          "x-ms-original-url": "http://localhost:3000/foo/bar",
        },
        params: {},
        query: {},
        body: "",
      };

      let res = await createRequestHandler({ build: undefined })(
        context,
        mockedRequest
      );

      expect(res.status).toBe(204);
    });

    it("sets headers", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        let headers = new Headers({ "X-Time-Of-Year": "most wonderful" });
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
        for(let [key, value] of req.headers.entries()) {
          headers.set(key, value);
        }
        return new Response (null, { headers });
      });

      let mockedRequest: HttpRequest = {
        method: "GET",
        url: "/foo/bar",
        rawBody: "",
        headers: {
          "x-ms-original-url": "http://localhost:3000/foo/bar",
        },
        params: {},
        query: {},
        body: "",
      };

      let res = await createRequestHandler({ build: undefined })(
        context,
        mockedRequest
      );

      expect(res.headers["x-ms-original-url"]).toEqual(["http://localhost:3000/foo/bar"]);
      expect(res.headers["X-Time-Of-Year"]).toEqual(["most wonderful"]);
      expect(res.headers["Set-Cookie"]).toEqual([
        "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax",
        "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax",
        "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax",
      ]);
    });
  });
});

describe("azure createRemixHeaders", () => {
  describe("creates fetch headers from azure headers", () => {
    it("handles empty headers", () => {
      expect(createRemixHeaders({})).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {},
        }
      `);
    });

    it("handles simple headers", () => {
      expect(createRemixHeaders({ "x-foo": "bar" })).toMatchInlineSnapshot(`
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
      expect(createRemixHeaders({ "x-foo": "bar", "x-bar": "baz" }))
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
      expect(createRemixHeaders({ "x-foo": "bar, baz" }))
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
      expect(createRemixHeaders({ "x-foo": "bar, baz", "x-bar": "baz" }))
        .toMatchInlineSnapshot(`
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
  });
});

describe("azure createRemixRequest", () => {
  it("creates a request with the correct headers", async () => {
    let request: HttpRequest = {
      method: "GET",
      url: "/foo/bar",
      rawBody: "",
      headers: {
        "x-ms-original-url": "http://localhost:3000/foo/bar",
      },
      params: {},
      query: {},
      body: "",
    };

    expect(createRemixRequest(request)).toMatchInlineSnapshot(`
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
              "x-ms-original-url": Array [
                "http://localhost:3000/foo/bar",
              ],
            },
          },
          "method": "GET",
          "parsedURL": Url {
            "auth": null,
            "hash": null,
            "host": "localhost:3000",
            "hostname": "localhost",
            "href": "http://localhost:3000/foo/bar",
            "path": "/foo/bar",
            "pathname": "/foo/bar",
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
