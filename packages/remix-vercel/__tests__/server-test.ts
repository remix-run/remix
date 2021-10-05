import supertest from "supertest";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/server-runtime";
import { createRequest } from "node-mocks-http";
import { createServerWithHelpers } from "@vercel/node/dist/helpers";
import { VercelRequest } from "@vercel/node";

import {
  createRemixHeaders,
  createRemixRequest,
  createRequestHandler
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the vercel adapter
jest.mock("@remix-run/server-runtime");
let mockedCreateRequestHandler = createRemixRequestHandler as jest.MockedFunction<
  typeof createRemixRequestHandler
>;

let consumeEventMock = jest.fn();
let mockBridge = { consumeEvent: consumeEventMock };

function createApp() {
  // TODO: get supertest args into the event
  consumeEventMock.mockImplementationOnce(() => ({ body: "" }));
  let server = createServerWithHelpers(
    createRequestHandler({ build: undefined }),
    mockBridge
  );
  return server;
}

describe("vercel createRequestHandler", () => {
  describe("basic requests", () => {
    afterEach(async () => {
      mockedCreateRequestHandler.mockReset();
      consumeEventMock.mockClear();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("handles requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async req => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request
        .get("/foo/bar")
        .set({ "x-now-bridge-request-id": "2" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("URL: /foo/bar");
    });

    it("handles null body", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 200 });
      });

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request.get("/").set({ "x-now-bridge-request-id": "2" });

      expect(res.status).toBe(200);
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response("", { status: 204 });
      });

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request.get("/").set({ "x-now-bridge-request-id": "2" });

      expect(res.status).toBe(204);
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

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request.get("/").set({ "x-now-bridge-request-id": "2" });

      expect(res.headers["x-time-of-year"]).toBe("most wonderful");
      expect(res.headers["set-cookie"]).toEqual([
        "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax",
        "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax",
        "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax"
      ]);
    });
  });
});

describe("vercel createRemixHeaders", () => {
  describe("creates fetch headers from vercel headers", () => {
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

    it("handles multiple set-cookie headers", () => {
      expect(
        createRemixHeaders({
          "set-cookie": [
            "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
            "__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax"
          ]
        })
      ).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "set-cookie": Array [
              "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
              "__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax",
            ],
          },
        }
      `);
    });
  });
});

describe("vercel createRemixRequest", () => {
  it("creates a request with the correct headers", async () => {
    let request = createRequest({
      method: "GET",
      url: "/foo/bar",
      headers: {
        "x-forwarded-host": "localhost:3000",
        "x-forwarded-proto": "http",
        "Cache-Control": "max-age=300, s-maxage=3600"
      }
    }) as VercelRequest;

    expect(createRemixRequest(request)).toMatchInlineSnapshot(`
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
              "cache-control": Array [
                "max-age=300, s-maxage=3600",
              ],
              "x-forwarded-host": Array [
                "localhost:3000",
              ],
              "x-forwarded-proto": Array [
                "http",
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
