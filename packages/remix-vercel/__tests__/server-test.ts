import { Response, Headers, RequestInfo, RequestInit } from "@remix-run/node";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node/server";
// @ts-ignore soon
import { createServerWithHelpers } from "@vercel/node/dist/helpers";
import listen from "test-listen";
import fetch from "node-fetch";

import { createRemixHeaders, createRequestHandler } from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the express adapter
jest.mock("@remix-run/node/server");
let mockedCreateRequestHandler = createRemixRequestHandler as jest.MockedFunction<
  typeof createRemixRequestHandler
>;

let consumeEventMock = jest.fn();
let mockBridge = { consumeEvent: consumeEventMock };
let server: any;
let url: string;

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

async function createApp() {
  server = createServerWithHelpers((req: any, res: any) => {
    // We don't have a real app to test, but it doesn't matter. We
    // won't ever call through to the real createRequestHandler
    // @ts-expect-error
    return createRequestHandler({ build: undefined })(req, res);
  }, mockBridge);

  url = await listen(server);
}

beforeEach(() => {
  consumeEventMock.mockClear();
});

describe("vercel createRequestHandler", () => {
  afterEach(async () => {
    mockedCreateRequestHandler.mockReset();
    await server.close();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("handles a request", async () => {
    mockedCreateRequestHandler.mockImplementation(() => async req => {
      return new Response(`URL: ${new URL(req.url).pathname}`);
    });

    await createApp();

    const res = await fetchWithProxyReq(url + "/foo/bar");

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("URL: /foo/bar");
  });

  it("handles a request with multiple Set-Cookie headers", async () => {
    mockedCreateRequestHandler.mockImplementation(() => async req => {
      const headers = new Headers(req.headers);
      headers.append("Cache-Control", "maxage=300");
      headers.append(
        "Set-Cookie",
        "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax"
      );
      headers.append(
        "Set-Cookie",
        "__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax"
      );

      return new Response("check out these headerssss", { headers });
    });

    await createApp();

    const res = await fetchWithProxyReq(url + "/foo/bar");

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("maxage=300");
    expect(res.headers.get("Set-Cookie")).toMatchInlineSnapshot(
      `"__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax, __other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax"`
    );
  });
});

describe("vercel createRemixHeaders", () => {
  afterEach(() => {
    mockedCreateRequestHandler.mockReset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("creates fetch headers from vercel headers", async () => {
    expect(
      createRemixHeaders({
        "Cache-Control": "maxage=300"
      })
    ).toMatchInlineSnapshot(`
      Headers {
        Symbol(map): Object {
          "Cache-Control": Array [
            "maxage=300",
          ],
        },
      }
    `);
  });

  it.todo("handles simple headers");
  it.todo("handles multiple headers");
  it.todo("handles headers with multiple values");
  it.todo("handles headers with multiple values and multiple headers");
  it("handles multiple set-cookie headers", () => {
    expect(
      createRemixHeaders({
        "Set-Cookie": ["foo=bar", "bar=baz"]
      })
    ).toMatchInlineSnapshot(`
      Headers {
        Symbol(map): Object {
          "Set-Cookie": Array [
            "foo=bar",
            "bar=baz",
          ],
        },
      }
    `);
  });
});

describe("vercel createRemixRequest", () => {
  it.todo("creates a request with the correct headers");
});
