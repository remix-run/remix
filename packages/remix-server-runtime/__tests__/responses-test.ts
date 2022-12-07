import type { TypedResponse } from "../index";
import { json, redirect } from "../index";
import { isEqual } from "./utils";

describe("json", () => {
  it("sets the Content-Type header", () => {
    let response = json({});
    expect(response.headers.get("Content-Type")).toEqual(
      "application/json; charset=utf-8"
    );
  });

  it("preserves existing headers, including Content-Type", () => {
    let response = json(
      {},
      {
        headers: {
          "Content-Type": "application/json; charset=iso-8859-1",
          "X-Remix": "is awesome",
        },
      }
    );

    expect(response.headers.get("Content-Type")).toEqual(
      "application/json; charset=iso-8859-1"
    );
    expect(response.headers.get("X-Remix")).toEqual("is awesome");
  });

  it("encodes the response body", async () => {
    let response = json({ hello: "remix" });
    expect(await response.json()).toEqual({ hello: "remix" });
  });

  it("accepts status as a second parameter", () => {
    let response = json({}, 201);
    expect(response.status).toEqual(201);
  });

  it("infers input type", async () => {
    let response = json({ hello: "remix" });
    isEqual<typeof response, TypedResponse<{ hello: string }>>(true);
    let result = await response.json();
    expect(result).toMatchObject({ hello: "remix" });
  });

  it("disallows unmatched typed responses", async () => {
    let response = json("hello");
    isEqual<TypedResponse<number>, typeof response>(false);
  });

  it("disallows unserializables", () => {
    // @ts-expect-error
    expect(() => json(124n)).toThrow();
    // @ts-expect-error
    expect(() => json({ field: 124n })).toThrow();
  });
});

describe("redirect", () => {
  it("sets the status to 302 by default", () => {
    let response = redirect("/login");
    expect(response.status).toEqual(302);
  });

  it("sets the status to 302 when only headers are given", () => {
    let response = redirect("/login", {
      headers: {
        "X-Remix": "is awesome",
      },
    });
    expect(response.status).toEqual(302);
  });

  it("sets the Location header", () => {
    let response = redirect("/login");
    expect(response.headers.get("Location")).toEqual("/login");
  });

  it("preserves existing headers, but not Location", () => {
    let response = redirect("/login", {
      headers: {
        Location: "/",
        "X-Remix": "is awesome",
      },
    });

    expect(response.headers.get("Location")).toEqual("/login");
    expect(response.headers.get("X-Remix")).toEqual("is awesome");
  });

  it("accepts status as a second parameter", () => {
    let response = redirect("/profile", 301);
    expect(response.status).toEqual(301);
  });
});
