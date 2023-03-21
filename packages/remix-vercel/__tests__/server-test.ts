import supertest from "supertest";
import { createRequest, createResponse } from "node-mocks-http";
import { createServerWithHelpers } from "@vercel/node-bridge/helpers";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node";
import { Readable } from "stream";

import {
  createRemixHeaders,
  createRemixRequest,
  createRequestHandler,
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the vercel adapter
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

let consumeEventMock = jest.fn();
let mockBridge = { consumeEvent: consumeEventMock };

function createApp() {
  // TODO: get supertest args into the event
  consumeEventMock.mockImplementationOnce(() => ({ body: "" }));
  let server = createServerWithHelpers(
    // @ts-expect-error
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
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
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

    it("handles root // requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request.get("//").set({ "x-now-bridge-request-id": "2" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("URL: //");
    });

    it("handles nested // requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request
        .get("//foo//bar")
        .set({ "x-now-bridge-request-id": "2" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("URL: //foo//bar");
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

    // https://github.com/node-fetch/node-fetch/blob/4ae35388b078bddda238277142bf091898ce6fda/test/response.js#L142-L148
    it("handles body as stream", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        let stream = Readable.from("hello world");
        return new Response(stream as any, { status: 200 }) as unknown as Response;
      });

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request.get("/").set({ "x-now-bridge-request-id": "2" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("hello world");
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 204 });
      });

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request.get("/").set({ "x-now-bridge-request-id": "2" });

      expect(res.status).toBe(204);
    });

    it("sets headers", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
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
        return new Response(null, { headers });
      });

      let request = supertest(createApp());
      // note: vercel's createServerWithHelpers requires a x-now-bridge-request-id
      let res = await request.get("/").set({ "x-now-bridge-request-id": "2" });

      expect(res.headers["x-time-of-year"]).toBe("most wonderful");
      expect(res.headers["set-cookie"]).toEqual([
        "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax",
        "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax",
        "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax",
      ]);
    });
  });
});

describe("vercel createRemixHeaders", () => {
  describe("creates fetch headers from vercel headers", () => {
    it("handles empty headers", () => {
      expect(createRemixHeaders({})).toMatchInlineSnapshot(`
        Headers {
          Symbol(headers list): HeadersList {
            "cookies": null,
            Symbol(headers map): Map {},
            Symbol(headers map sorted): null,
          },
          Symbol(guard): "none",
        }
      `);
    });

    it("handles simple headers", () => {
      expect(createRemixHeaders({ "x-foo": "bar" })).toMatchInlineSnapshot(`
        Headers {
          Symbol(headers list): HeadersList {
            "cookies": null,
            Symbol(headers map): Map {
              "x-foo" => {
                "name": "x-foo",
                "value": "bar",
              },
            },
            Symbol(headers map sorted): null,
          },
          Symbol(guard): "none",
        }
      `);
    });

    it("handles multiple headers", () => {
      expect(createRemixHeaders({ "x-foo": "bar", "x-bar": "baz" }))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(headers list): HeadersList {
            "cookies": null,
            Symbol(headers map): Map {
              "x-foo" => {
                "name": "x-foo",
                "value": "bar",
              },
              "x-bar" => {
                "name": "x-bar",
                "value": "baz",
              },
            },
            Symbol(headers map sorted): null,
          },
          Symbol(guard): "none",
        }
      `);
    });

    it("handles headers with multiple values", () => {
      expect(createRemixHeaders({ "x-foo": "bar, baz" }))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(headers list): HeadersList {
            "cookies": null,
            Symbol(headers map): Map {
              "x-foo" => {
                "name": "x-foo",
                "value": "bar, baz",
              },
            },
            Symbol(headers map sorted): null,
          },
          Symbol(guard): "none",
        }
      `);
    });

    it("handles headers with multiple values and multiple headers", () => {
      expect(createRemixHeaders({ "x-foo": "bar, baz", "x-bar": "baz" }))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(headers list): HeadersList {
            "cookies": null,
            Symbol(headers map): Map {
              "x-foo" => {
                "name": "x-foo",
                "value": "bar, baz",
              },
              "x-bar" => {
                "name": "x-bar",
                "value": "baz",
              },
            },
            Symbol(headers map sorted): null,
          },
          Symbol(guard): "none",
        }
      `);
    });

    it("handles multiple set-cookie headers", () => {
      expect(
        createRemixHeaders({
          "set-cookie": [
            "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
            "__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax",
          ],
        })
      ).toMatchInlineSnapshot(`
        Headers {
          Symbol(headers list): HeadersList {
            "cookies": [
              "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
              "__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax",
            ],
            Symbol(headers map): Map {
              "set-cookie" => {
                "name": "set-cookie",
                "value": "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax, __other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax",
              },
            },
            Symbol(headers map sorted): null,
          },
          Symbol(guard): "none",
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
        "Cache-Control": "max-age=300, s-maxage=3600",
      },
    }) as VercelRequest;
    let response = createResponse() as unknown as VercelResponse;

    expect(createRemixRequest(request, response)).toMatchInlineSnapshot(`
      Request {
        Symbol(realm): {
          "settingsObject": {
            "baseUrl": undefined,
          },
        },
        Symbol(state): {
          "body": null,
          "cache": "default",
          "client": {
            "baseUrl": undefined,
          },
          "credentials": "same-origin",
          "cryptoGraphicsNonceMetadata": "",
          "destination": "",
          "done": false,
          "headersList": HeadersList {
            "cookies": null,
            Symbol(headers map): Map {
              "cache-control" => {
                "name": "cache-control",
                "value": "max-age=300, s-maxage=3600",
              },
              "x-forwarded-host" => {
                "name": "x-forwarded-host",
                "value": "localhost:3000",
              },
              "x-forwarded-proto" => {
                "name": "x-forwarded-proto",
                "value": "http",
              },
            },
            Symbol(headers map sorted): null,
          },
          "historyNavigation": false,
          "initiator": "",
          "integrity": "",
          "keepalive": false,
          "localURLsOnly": false,
          "method": "GET",
          "mode": "cors",
          "origin": "client",
          "parserMetadata": "",
          "policyContainer": "client",
          "preventNoCacheCacheControlHeaderModification": false,
          "priority": null,
          "redirect": "follow",
          "redirectCount": 0,
          "referrer": "client",
          "referrerPolicy": "",
          "reloadNavigation": false,
          "replacesClientId": "",
          "reservedClient": null,
          "responseTainting": "basic",
          "serviceWorkers": "all",
          "taintedOrigin": false,
          "timingAllowFailed": false,
          "unsafeRequest": false,
          "url": "http://localhost:3000/foo/bar",
          "urlList": [
            "http://localhost:3000/foo/bar",
          ],
          "useCORSPreflightFlag": false,
          "useCredentials": false,
          "userActivation": false,
          "window": "client",
        },
        Symbol(signal): AbortSignal {
          Symbol(kEvents): Map {},
          Symbol(events.maxEventTargetListeners): 10,
          Symbol(events.maxEventTargetListenersWarned): false,
          Symbol(kHandlers): Map {},
          Symbol(kAborted): false,
          Symbol(kReason): undefined,
          Symbol(realm): {
            "settingsObject": {
              "baseUrl": undefined,
            },
          },
        },
        Symbol(headers): Headers {
          Symbol(headers list): HeadersList {
            "cookies": null,
            Symbol(headers map): Map {
              "cache-control" => {
                "name": "cache-control",
                "value": "max-age=300, s-maxage=3600",
              },
              "x-forwarded-host" => {
                "name": "x-forwarded-host",
                "value": "localhost:3000",
              },
              "x-forwarded-proto" => {
                "name": "x-forwarded-proto",
                "value": "http",
              },
            },
            Symbol(headers map sorted): null,
          },
          Symbol(guard): "request",
          Symbol(realm): {
            "settingsObject": {
              "baseUrl": undefined,
            },
          },
        },
      }
    `);
  });
});
