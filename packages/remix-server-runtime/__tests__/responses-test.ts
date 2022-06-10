import { deferred, json, redirect } from "../index";

const DEFERRED_PROMISE_PREFIX = "__deferred_promise:";

describe("deferred", () => {
  type ChunkType = "initial" | "data" | "error";
  function chunkTypeAndData(chunk: string): [ChunkType, unknown] {
    let type = "initial";
    if (chunk.startsWith("data:")) {
      type = "data";
    } else if (chunk.startsWith("error:")) {
      type = "error";
    }

    if (!chunk.endsWith("\n\n")) {
      type = "invalid-terminator";
    }

    let data = undefined;
    if (type !== "unknown") {
      data = JSON.parse(
        chunk
          .replace(/^data:/, "")
          .replace(/^error:/, "")
          .replace(/\n\n$/, "")
      );
    }

    return [type, data];
  }

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
    let data = {
      foo: "remix",
      bar: Promise.resolve(10),
      baz: Promise.resolve({ sub: "value" }),
    };

    let response = deferred(data);
    expect(await response.json()).toEqual({
      foo: "remix",
      bar: DEFERRED_PROMISE_PREFIX + "bar",
      baz: DEFERRED_PROMISE_PREFIX + "baz",
    });
    expect(response.deferred.bar).toBeDefined();
    expect(response.deferred.baz).toBeDefined();
    expect(await response.deferred.bar).toEqual(await data.bar);
    expect(await response.deferred.baz).toEqual(await data.baz);

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

    let [initialChunkType, initialData] = chunkTypeAndData(decodedChunks[0]);
    expect(initialChunkType).toBe("initial");
    expect(initialData).toEqual({
      foo: "remix",
      bar: DEFERRED_PROMISE_PREFIX + "bar",
      baz: DEFERRED_PROMISE_PREFIX + "baz",
    });

    let [secondChunkType, secondChunkData] = chunkTypeAndData(decodedChunks[1]);
    expect(secondChunkType).toBe("data");
    let secondChunkDataKeys = Object.keys(secondChunkData);
    expect(secondChunkDataKeys.length).toBe(1);
    expect(secondChunkData[secondChunkDataKeys[0]]).toEqual(
      await data[secondChunkDataKeys[0]]
    );

    let [thirdChunkType, thirdChunkData] = chunkTypeAndData(decodedChunks[2]);
    expect(thirdChunkType).toBe("data");
    let thirdChunkDataKeys = Object.keys(thirdChunkData);
    expect(thirdChunkDataKeys.length).toBe(1);
    expect(thirdChunkData[thirdChunkDataKeys[0]]).toEqual(
      await data[thirdChunkDataKeys[0]]
    );
  });

  it("encodes the response body with object with rejected promises", async () => {
    let data = {
      foo: "remix",
      bar: Promise.reject(new Error("rejected")),
      baz: Promise.resolve({ sub: "value" }),
    };
    let response = deferred(data);
    expect(await response.json()).toEqual({
      foo: "remix",
      bar: DEFERRED_PROMISE_PREFIX + "bar",
      baz: DEFERRED_PROMISE_PREFIX + "baz",
    });
    expect(response.deferred.bar).toBeDefined();
    expect(response.deferred.baz).toBeDefined();
    await expect(response.deferred.bar).rejects.toThrowError("rejected");
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

    let [initialChunkType, initialData] = chunkTypeAndData(decodedChunks[0]);
    expect(initialChunkType).toBe("initial");
    expect(initialData).toEqual({
      foo: "remix",
      bar: DEFERRED_PROMISE_PREFIX + "bar",
      baz: DEFERRED_PROMISE_PREFIX + "baz",
    });

    let [secondChunkType, secondChunkData] = chunkTypeAndData(decodedChunks[1]);
    let secondChunkDataKeys = Object.keys(secondChunkData);
    expect(secondChunkDataKeys.length).toBe(1);
    if (secondChunkType === "error") {
      let error = await data[secondChunkDataKeys[0]].catch((e) => e);
      // eslint-disable-next-line jest/no-conditional-expect
      expect(secondChunkData[secondChunkDataKeys[0]]).toEqual({
        message: error.message,
        stack: error.stack,
      });
    } else if (secondChunkType === "data") {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(secondChunkData[secondChunkDataKeys[0]]).toEqual(
        await data[secondChunkDataKeys[0]]
      );
    } else {
      throw new Error("Unexpected chunk type");
    }

    let [thirdChunkType, thirdChunkData] = chunkTypeAndData(decodedChunks[2]);
    let thirdChunkDataKeys = Object.keys(thirdChunkData);
    expect(thirdChunkDataKeys.length).toBe(1);
    if (thirdChunkType === "error") {
      let error = await data[thirdChunkDataKeys[0]].catch((e) => e);
      // eslint-disable-next-line jest/no-conditional-expect
      expect(thirdChunkData[thirdChunkDataKeys[0]]).toEqual({
        message: error.message,
        stack: error.stack,
      });
    } else if (thirdChunkType === "data") {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(thirdChunkData[thirdChunkDataKeys[0]]).toEqual(
        await data[thirdChunkDataKeys[0]]
      );
    } else {
      throw new Error("Unexpected chunk type");
    }
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
