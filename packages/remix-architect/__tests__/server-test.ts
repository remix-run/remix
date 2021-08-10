import { Response, Headers } from "@remix-run/node";
import { createRequestHandler as createRemixRequestHandler } from "@remix-run/node/server";

import {
  createRemixHeaders,
  createRemixRequest,
  createRequestHandler
} from "../server";

// We don't want to test that the remix server works here (that's what the
// puppetteer tests do), we just want to test the express adapter
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

    // it.skip("handles multiple set-cookie headers", () => {
    //   expect(
    //     createRemixHeaders(
    //       {
    //         "set-cookie": [
    //           "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax",
    //           "__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax"
    //         ]
    //       },
    //       undefined
    //     )
    //   ).toMatchInlineSnapshot(`
    //     Headers {
    //       Symbol(map): Object {
    //         "set-cookie": Array [
    //           "__session=some_value; Path=/; Secure; HttpOnly; MaxAge=7200; SameSite=Lax,__other=some_other_value; Path=/; Secure; HttpOnly; MaxAge=3600; SameSite=Lax",
    //         ],
    //       },
    //     }
    //   `);
    // });

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
  it.todo("creates a request with the correct headers");
});
