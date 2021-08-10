import { Response, Headers } from "@remix-run/node";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node/server";

import {
  createRemixHeaders,
  createRemixRequest,
  createRequestHandler
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the architect adapter
jest.mock("@remix-run/node/server");
let mockedCreateRequestHandler = createRemixRequestHandler as jest.MockedFunction<
  typeof createRemixRequestHandler
>;

describe.skip("architect createRequestHandler", () => {});

describe("architect createRemixHeaders", () => {
  describe("creates fetch headers from architect headers", () => {
    it("handles empty headers", () => {
      expect(createRemixHeaders({}, undefined)).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {},
        }
      `);
    });

    it("handles simple headers", () => {
      expect(createRemixHeaders({ "x-foo": "bar" }, undefined))
        .toMatchInlineSnapshot(`
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
      expect(createRemixHeaders({ "x-foo": "bar", "x-bar": "baz" }, undefined))
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
      expect(createRemixHeaders({ "x-foo": "bar, baz" }, undefined))
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
      expect(
        createRemixHeaders({ "x-foo": "bar, baz", "x-bar": "baz" }, undefined)
      ).toMatchInlineSnapshot(`
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

    it("handles cookies", () => {
      expect(
        createRemixHeaders({}, [
          "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
          "__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax"
        ])
      ).toMatchInlineSnapshot(`
        Headers {
          Symbol(map): Object {
            "Cookie": Array [
              "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
              "__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax",
            ],
          },
        }
      `);
    });
  });
});

describe("architect createRemixRequest", () => {
  it("creates a request with the correct headers", () => {
    expect(
      createRemixRequest({
        headers: {
          host: "localhost:3333",
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "upgrade-insecure-requests": "1",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
          "accept-language": "en-US,en;q=0.9",
          "accept-encoding": "gzip, deflate"
        },
        isBase64Encoded: false,
        rawPath: "/",
        rawQueryString: "",
        requestContext: {
          http: {
            method: "GET",
            path: "/",
            protocol: "http",
            userAgent:
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
            sourceIp: "127.0.0.1"
          },
          routeKey: "ANY /{proxy+}",
          accountId: "1234567890",
          requestId: "abcdefghijklmnopqrstuvwxyz",
          apiId: "1234567890abcdef",
          domainName: "localhost:3333",
          domainPrefix: "localhost:3333",
          stage: "prod",
          time: "2021-08-10T19:48:50.969Z",
          timeEpoch: 1628624930969
        },
        routeKey: "foo",
        version: "2.0",
        cookies: ["__session=value"]
      })
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
              ],
              "accept": Array [
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              ],
              "accept-encoding": Array [
                "gzip, deflate",
              ],
              "accept-language": Array [
                "en-US,en;q=0.9",
              ],
              "host": Array [
                "localhost:3333",
              ],
              "upgrade-insecure-requests": Array [
                "1",
              ],
              "user-agent": Array [
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
              ],
            },
          },
          "method": "GET",
          "parsedURL": Url {
            "auth": null,
            "hash": null,
            "host": "localhost:3333",
            "hostname": "localhost",
            "href": "http://localhost:3333/",
            "path": "/",
            "pathname": "/",
            "port": "3333",
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
