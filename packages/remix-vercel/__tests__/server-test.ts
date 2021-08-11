import { Headers, Response, RequestInfo, RequestInit } from "@remix-run/node";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node/server";
// @ts-expect-error TODO: add type definition for this
import { createServerWithHelpers } from "@vercel/node/dist/helpers";
import listen from "test-listen";
import fetch from "node-fetch";

import { createRemixHeaders, createRequestHandler } from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the vercel adapter
jest.mock("@remix-run/node/server");
let mockedCreateRequestHandler = createRemixRequestHandler as jest.MockedFunction<
  typeof createRemixRequestHandler
>;

// TODO: add real type definition
let server: any;
let url: string;
let consumeEventMock = jest.fn();
let mockBridge = { consumeEvent: consumeEventMock };

async function fetchWithProxyReq(_url: RequestInfo, opts: RequestInit = {}) {
  if (opts.body) {
    // eslint-disable-next-line
    // @ts-ignore look into
    opts = { ...opts, body: Buffer.from(opts.body) };
  }

  consumeEventMock.mockImplementationOnce(() => opts);

  return fetch(_url, {
    ...opts,
    headers: { ...opts.headers, "x-now-bridge-request-id": "2" }
  });
}

describe("vercel createRequestHandler", () => {
  beforeEach(async () => {
    consumeEventMock.mockClear();

    server = createServerWithHelpers((req: any, res: any) => {
      // We don't have a real app to test, but it doesn't matter. We
      // won't ever call through to the real createRequestHandler
      // @ts-expect-error
      return createRequestHandler({ build: undefined })(req, res);
    }, mockBridge);

    url = await listen(server);
  });

  afterEach(async () => {
    mockedCreateRequestHandler.mockReset();
    await server.close();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("basic requests", () => {
    it("handles requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async req => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      const res = await fetchWithProxyReq(url + "/foo/bar");

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("URL: /foo/bar");
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response("", { status: 204 });
      });

      let res = await fetchWithProxyReq(url);

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

      let res = await fetchWithProxyReq(url);

      expect(res.headers.get("x-time-of-year")).toBe("most wonderful");
      expect(res.headers.get("set-cookie")).toEqual(
        "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax, second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax, third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax"
      );
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
  it.todo("creates a request with the correct headers");
});
