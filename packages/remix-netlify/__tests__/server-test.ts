import fsp from "fs/promises";
import path from "path";
import lambdaTester from "lambda-tester";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node";
import type { HandlerEvent } from "@netlify/functions";

import {
  createRemixHeaders,
  createRemixRequest,
  createRequestHandler,
  sendRemixResponse,
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the netlify adapter
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

function createMockEvent(event: Partial<HandlerEvent> = {}): HandlerEvent {
  return {
    rawUrl: "http://localhost:3000/",
    rawQuery: "",
    path: "/",
    httpMethod: "GET",
    headers: {
      host: "localhost:3000",
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...event,
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
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000/foo/bar" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: /foo/bar");
        });
    });

    it("handles root // requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000//" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: //");
        });
    });

    it("handles nested // requests", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000//foo//bar" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: //foo//bar");
        });
    });

    it("handles root // requests (development)", async () => {
      let oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ path: "//" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: //");
        });

      process.env.NODE_ENV = oldEnv;
    });

    it("handles nested // requests (development)", async () => {
      let oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ path: "//foo//bar" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: //foo//bar");
        });

      process.env.NODE_ENV = oldEnv;
    });

    it("handles null body", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 200 });
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
        });
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 204 });
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(204);
        });
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

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000" }))
        .expectResolve((res) => {
          expect(res.multiValueHeaders["x-time-of-year"]).toEqual([
            "most wonderful",
          ]);
          expect(res.multiValueHeaders["set-cookie"]).toEqual([
            "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax",
            "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax",
            "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax",
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
      expect(createRemixHeaders({ "x-foo": ["bar"] })).toMatchInlineSnapshot(`
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
      expect(createRemixHeaders({ "x-foo": ["bar"], "x-bar": ["baz"] }))
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
      expect(createRemixHeaders({ "x-foo": ["bar", "baz"] }))
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
      expect(createRemixHeaders({ "x-foo": ["bar", "baz"], "x-bar": ["baz"] }))
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

    it("handles cookies", () => {
      expect(
        createRemixHeaders({
          Cookie: [
            "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
            "__other=some_other_value; Path=/; Secure; HttpOnly; Expires=Wed, 21 Oct 2015 07:28:00 GMT; SameSite=Lax",
          ],

          "x-something-else": ["true"],
        })
      ).toMatchInlineSnapshot(`
        Headers {
          Symbol(headers list): HeadersList {
            "cookies": null,
            Symbol(headers map): Map {
              "cookie" => {
                "name": "Cookie",
                "value": "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax; __other=some_other_value; Path=/; Secure; HttpOnly; Expires=Wed, 21 Oct 2015 07:28:00 GMT; SameSite=Lax",
              },
              "x-something-else" => {
                "name": "x-something-else",
                "value": "true",
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

describe("netlify createRemixRequest", () => {
  it("creates a request with the correct headers", () => {
    expect(
      createRemixRequest(
        createMockEvent({
          multiValueHeaders: {
            Cookie: ["__session=value", "__other=value"],
          },
        })
      )
    ).toMatchInlineSnapshot(`
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
              "cookie" => {
                "name": "cookie",
                "value": "__session=value; __other=value",
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
          "url": "http://localhost:3000/",
          "urlList": [
            "http://localhost:3000/",
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
              "cookie" => {
                "name": "cookie",
                "value": "__session=value; __other=value",
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

describe("sendRemixResponse", () => {
  it("handles regular responses", async () => {
    let response = new Response("anything");
    let result = await sendRemixResponse(response);
    expect(result.body).toBe("anything");
  });

  it("handles resource routes with regular data", async () => {
    let json = JSON.stringify({ foo: "bar" });
    let response = new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "content-length": json.length.toString(),
      },
    });

    let result = await sendRemixResponse(response);

    expect(result.body).toMatch(json);
  });

  it("handles resource routes with binary data", async () => {
    let image = await fsp.readFile(path.join(__dirname, "554828.jpeg"));

    let response = new Response(image, {
      headers: {
        "content-type": "image/jpeg",
        "content-length": image.length.toString(),
      },
    });

    let result = await sendRemixResponse(response);

    expect(result.body).toMatch(image.toString("base64"));
  });
});
