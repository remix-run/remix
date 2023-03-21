import fsp from "fs/promises";
import path from "path";
import lambdaTester from "lambda-tester";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node";

import {
  createRequestHandler,
  createRemixHeaders,
  createRemixRequest,
  sendRemixResponse,
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the architect adapter
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
      ...event.headers,
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
        ...event.requestContext?.http,
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
      ...event.requestContext,
    },
    routeKey: "foo",
    version: "2.0",
    ...event,
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
      mockedCreateRequestHandler.mockImplementation(() => async (req) => {
        return new Response(`URL: ${new URL(req.url).pathname}`);
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawPath: "/foo/bar" }))
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
        .event(createMockEvent({ rawPath: "//" }))
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
        .event(createMockEvent({ rawPath: "//foo//bar" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.body).toBe("URL: //foo//bar");
        });
    });

    it("handles null body", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 200 });
      });

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawPath: "/foo/bar" }))
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
        .event(createMockEvent({ rawPath: "/foo/bar" }))
        .expectResolve((res) => {
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

      // We don't have a real app to test, but it doesn't matter. We won't ever
      // call through to the real createRequestHandler
      // @ts-expect-error
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawPath: "/" }))
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["x-time-of-year"]).toBe("most wonderful");
          expect(res.cookies).toEqual([
            "first=one; Expires=0; Path=/; HttpOnly; Secure; SameSite=Lax",
            "second=two; MaxAge=1209600; Path=/; HttpOnly; Secure; SameSite=Lax",
            "third=three; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax",
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
      expect(createRemixHeaders({ "x-foo": "bar" }, undefined))
        .toMatchInlineSnapshot(`
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
      expect(createRemixHeaders({ "x-foo": "bar", "x-bar": "baz" }, undefined))
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
      expect(createRemixHeaders({ "x-foo": "bar, baz" }, undefined))
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
      expect(
        createRemixHeaders({ "x-foo": "bar, baz", "x-bar": "baz" }, undefined)
      ).toMatchInlineSnapshot(`
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
        createRemixHeaders({ "x-something-else": "true" }, [
          "__session=some_value",
          "__other=some_other_value",
        ])
      ).toMatchInlineSnapshot(`
        Headers {
          Symbol(headers list): HeadersList {
            "cookies": null,
            Symbol(headers map): Map {
              "x-something-else" => {
                "name": "x-something-else",
                "value": "true",
              },
              "cookie" => {
                "name": "Cookie",
                "value": "__session=some_value; __other=some_other_value",
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

describe("architect createRemixRequest", () => {
  it("creates a request with the correct headers", () => {
    expect(
      createRemixRequest(
        createMockEvent({
          cookies: ["__session=value"],
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
              "accept" => {
                "name": "accept",
                "value": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              },
              "accept-encoding" => {
                "name": "accept-encoding",
                "value": "gzip, deflate",
              },
              "accept-language" => {
                "name": "accept-language",
                "value": "en-US,en;q=0.9",
              },
              "cookie" => {
                "name": "cookie",
                "value": "__session=value",
              },
              "host" => {
                "name": "host",
                "value": "localhost:3333",
              },
              "upgrade-insecure-requests" => {
                "name": "upgrade-insecure-requests",
                "value": "1",
              },
              "user-agent" => {
                "name": "user-agent",
                "value": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
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
          "url": "https://localhost:3333/",
          "urlList": [
            "https://localhost:3333/",
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
              "accept" => {
                "name": "accept",
                "value": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              },
              "accept-encoding" => {
                "name": "accept-encoding",
                "value": "gzip, deflate",
              },
              "accept-language" => {
                "name": "accept-language",
                "value": "en-US,en;q=0.9",
              },
              "cookie" => {
                "name": "cookie",
                "value": "__session=value",
              },
              "host" => {
                "name": "host",
                "value": "localhost:3333",
              },
              "upgrade-insecure-requests" => {
                "name": "upgrade-insecure-requests",
                "value": "1",
              },
              "user-agent" => {
                "name": "user-agent",
                "value": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
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
