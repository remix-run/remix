import { deferred, json, redirect } from "../index";

const DEFERRED_PROMISE_PREFIX = "__deferred_promise:";

describe("deferred", () => {
  it("sets the Content-Type header", () => {
    let response = deferred({});
    expect(response.headers.get("Content-Type")).toEqual(
      "text/remix-deferred; charset=utf-8"
    );
  });

  it("preserves existing headers, including Content-Type", () => {
    let response = deferred(
      {},
      {
        headers: {
          "Content-Type": "text/remix-deferred; charset=iso-8859-1",
          "X-Remix": "is awesome",
        },
      }
    );

    expect(response.headers.get("Content-Type")).toEqual(
      "text/remix-deferred; charset=iso-8859-1"
    );
    expect(response.headers.get("X-Remix")).toEqual("is awesome");
  });

  it("accepts status as a second parameter", () => {
    let response = json({}, 201);
    expect(response.status).toEqual(201);
  });

  it("encodes the response body with null", async () => {
    let response = deferred(null);
    expect(await response.json()).toEqual(null);
    expect(Object.keys(response.deferred).length).toBe(0);
  });

  it("encodes the response body with number", async () => {
    let response = deferred(10);
    expect(await response.json()).toEqual(10);
    expect(Object.keys(response.deferred).length).toBe(0);
  });

  it("encodes the response body with array", async () => {
    let response = deferred([1, 2]);
    expect(await response.json()).toEqual([1, 2]);
    expect(Object.keys(response.deferred).length).toBe(0);
  });

  it("encodes the response body with object", async () => {
    let response = deferred({ hello: "remix" });
    expect(await response.json()).toEqual({ hello: "remix" });
    expect(Object.keys(response.deferred).length).toBe(0);
  });

  it("encodes the response body with object with successful promises", async () => {
    let response = deferred({
      foo: "remix",
      bar: Promise.resolve(10),
      baz: Promise.resolve({ sub: "value" }),
    });
    expect(await response.json()).toEqual({
      foo: "remix",
      bar: DEFERRED_PROMISE_PREFIX + "bar",
      baz: DEFERRED_PROMISE_PREFIX + "baz",
    });
    expect(response.deferred.bar).toBeDefined();
    expect(response.deferred.baz).toBeDefined();
    expect(await response.deferred.bar).toEqual(10);
    expect(await response.deferred.baz).toEqual({ sub: "value" });

    expect(response.body).toBeDefined();
    let reader = response.body.getReader();
    let decoder = new TextDecoder();
    let decodedChunks: string[] = [];
    for (
      let { done, value } = await reader.read(), chunkCount = 0;
      !done;
      { done, value } = await reader.read(), chunkCount++
    ) {
      if (chunkCount > 3) {
        throw new Error("Too many chunks seen in deferred body");
      }

      decodedChunks.push(decoder.decode(value));
    }

    expect(decodedChunks.length).toBe(3);

    expect(decodedChunks[0].endsWith("\n\n")).toBe(true);
    expect(decodedChunks[1].startsWith("data:")).toBe(true);
    expect(decodedChunks[1].endsWith("\n\n")).toBe(true);
    expect(decodedChunks[2].startsWith("data:")).toBe(true);
    expect(decodedChunks[2].endsWith("\n\n")).toBe(true);

    function decodeChunk(chunk: string) {
      return JSON.parse(chunk.replace(/^data:/, "").replace(/\n\n$/, ""));
    }

    expect(decodeChunk(decodedChunks[0])).toEqual({
      foo: "remix",
      bar: DEFERRED_PROMISE_PREFIX + "bar",
      baz: DEFERRED_PROMISE_PREFIX + "baz",
    });
    expect(decodeChunk(decodedChunks[1])).toEqual({ bar: 10 });
    expect(decodeChunk(decodedChunks[2])).toEqual({ baz: { sub: "value" } });
  });
});

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
