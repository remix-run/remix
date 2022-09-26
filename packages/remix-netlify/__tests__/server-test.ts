import fsp from "fs/promises";
import path from "path";
import lambdaTester from "lambda-tester";
import {
  // This has been added as a global in node 15+, but we expose it here while we
  // support Node 14
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  AbortController,
  createRequestHandler as createRemixRequestHandler,
  Response as NodeResponse,
} from "@remix-run/node";
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
    headers: {},
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

      // @ts-expect-error We don't have a real app to test, but it doesn't matter. We
      // won't ever call through to the real createRequestHandler
      await lambdaTester(createRequestHandler({ build: undefined }))
        .event(createMockEvent({ rawUrl: "http://localhost:3000/foo/bar" }))
        .expectResolve((res) => {
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
        .expectResolve((res) => {
          expect(res.statusCode).toBe(200);
        });
    });

    it("handles status codes", async () => {
      mockedCreateRequestHandler.mockImplementation(() => async () => {
        return new Response(null, { status: 204 });
      });

      // @ts-expect-error We don't have a real app to test, but it doesn't matter. We
      // won't ever call through to the real createRequestHandler
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

      // @ts-expect-error We don't have a real app to test, but it doesn't matter. We
      // won't ever call through to the real createRequestHandler
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
          Symbol(query): Array [],
          Symbol(context): null,
        }
      `);
    });

    it("handles simple headers", () => {
      expect(createRemixHeaders({ "x-foo": ["bar"] })).toMatchInlineSnapshot(`
        Headers {
          Symbol(query): Array [
            "x-foo",
            "bar",
          ],
          Symbol(context): null,
        }
      `);
    });

    it("handles multiple headers", () => {
      expect(createRemixHeaders({ "x-foo": ["bar"], "x-bar": ["baz"] }))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(query): Array [
            "x-foo",
            "bar",
            "x-bar",
            "baz",
          ],
          Symbol(context): null,
        }
      `);
    });

    it("handles headers with multiple values", () => {
      expect(createRemixHeaders({ "x-foo": ["bar", "baz"] }))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(query): Array [
            "x-foo",
            "bar",
            "x-foo",
            "baz",
          ],
          Symbol(context): null,
        }
      `);
    });

    it("handles headers with multiple values and multiple headers", () => {
      expect(createRemixHeaders({ "x-foo": ["bar", "baz"], "x-bar": ["baz"] }))
        .toMatchInlineSnapshot(`
        Headers {
          Symbol(query): Array [
            "x-foo",
            "bar",
            "x-foo",
            "baz",
            "x-bar",
            "baz",
          ],
          Symbol(context): null,
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
          Symbol(query): Array [
            "cookie",
            "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
            "cookie",
            "__other=some_other_value; Path=/; Secure; HttpOnly; Expires=Wed, 21 Oct 2015 07:28:00 GMT; SameSite=Lax",
            "x-something-else",
            "true",
          ],
          Symbol(context): null,
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
      NodeRequest {
        "agent": undefined,
        "compress": true,
        "counter": 0,
        "follow": 20,
        "highWaterMark": 16384,
        "insecureHTTPParser": false,
        "size": 0,
        Symbol(Body internals): Object {
          "body": null,
          "boundary": null,
          "disturbed": false,
          "error": null,
          "size": 0,
          "type": null,
        },
        Symbol(Request internals): Object {
          "headers": Headers {
            Symbol(query): Array [
              "cookie",
              "__session=value",
              "cookie",
              "__other=value",
            ],
            Symbol(context): null,
          },
          "method": "GET",
          "parsedURL": "http://localhost:3000/",
          "redirect": "follow",
          "signal": AbortSignal {},
        },
      }
    `);
  });
});

describe("sendRemixResponse", () => {
  it("handles regular responses", async () => {
    let response = new NodeResponse("anything");
    let result = await sendRemixResponse(response);
    expect(result.body).toBe("anything");
  });

  it("handles resource routes with regular data", async () => {
    let json = JSON.stringify({ foo: "bar" });
    let response = new NodeResponse(json, {
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

    let response = new NodeResponse(image, {
      headers: {
        "content-type": "image/jpeg",
        "content-length": image.length.toString(),
      },
    });

    let result = await sendRemixResponse(response);

    expect(result.body).toMatch(image.toString("base64"));
  });
});
