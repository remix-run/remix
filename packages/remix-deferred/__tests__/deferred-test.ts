import {
  DEFERRED_VALUE_PLACEHOLDER_PREFIX,
  createDeferredReadableStream,
  getDeferrableData,
  parseDeferredReadableStream,
} from "../index";

describe("getDeferrableData", () => {
  it("handles undefined", () => {
    expect(getDeferrableData(undefined)).toEqual({
      criticalData: undefined,
      deferredData: undefined,
    });
  });

  it("handles null", () => {
    expect(getDeferrableData(null)).toEqual({
      criticalData: null,
      deferredData: undefined,
    });
  });

  it("handles string", () => {
    expect(getDeferrableData("hello, world")).toEqual({
      criticalData: "hello, world",
      deferredData: undefined,
    });
  });

  it("handles number", () => {
    expect(getDeferrableData(42)).toEqual({
      criticalData: 42,
      deferredData: undefined,
    });
  });

  it("handles boolean", () => {
    expect(getDeferrableData(true)).toEqual({
      criticalData: true,
      deferredData: undefined,
    });
  });

  it("handles object without deferred", () => {
    expect(getDeferrableData({ a: "a", b: "b" })).toEqual({
      criticalData: { a: "a", b: "b" },
      deferredData: undefined,
    });
  });

  it("handles array without deferred", () => {
    expect(getDeferrableData([1, 2, 3])).toEqual({
      criticalData: [1, 2, 3],
      deferredData: undefined,
    });
  });

  it("handles object with deferred", () => {
    let deferred = Promise.resolve("hello, world");
    let criticalData = { a: "a", b: "b" };
    expect(getDeferrableData({ ...criticalData, c: deferred })).toEqual({
      criticalData: {
        ...criticalData,
        c: DEFERRED_VALUE_PLACEHOLDER_PREFIX + "c",
      },
      deferredData: { c: deferred },
    });
  });

  it("handles array with deferred", () => {
    let deferred = Promise.resolve("hello, world");
    let criticalData = [0, 1];
    expect(getDeferrableData([...criticalData, deferred])).toEqual({
      criticalData: [...criticalData, DEFERRED_VALUE_PLACEHOLDER_PREFIX + "2"],
      deferredData: { 2: deferred },
    });
  });
});

describe("parseDeferredReadableStream", () => {
  it("throws when no stream is passed", async () => {
    await expect(
      // @ts-expect-error
      parseDeferredReadableStream(null)
    ).rejects.toThrow("parseDeferredReadableStream requires stream argument");
  });

  it("throws if no initial data is found", async () => {
    let stream = new ReadableStream({
      async start(controller) {
        controller.close();
      },
    });

    await expect(parseDeferredReadableStream(stream)).rejects.toThrow(
      "no critical data"
    );
  });

  it("rejects deferred when error occurs with stream", async () => {
    let c = Promise.resolve("c value");
    let deferrable = getDeferrableData({ a: "a", b: "b", c });
    let stream = new ReadableStream({
      start(controller) {
        let encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(JSON.stringify(deferrable.criticalData) + "\n\n")
        );
        controller.enqueue(encoder.encode("%%%%%%") + "\n\n");
        controller.close();
      },
    });
    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: {
        a: "a",
        b: "b",
        c: DEFERRED_VALUE_PLACEHOLDER_PREFIX + "c",
      },
      deferredData: {
        c: expect.any(Promise),
      },
    });

    await expect(parsed.deferredData!.c).rejects.toThrow(
      "Unexpected end of JSON input"
    );
  });
});

describe("createDeferredReadableStream", () => {
  it("throws when critical data is undefined", () => {
    expect(() =>
      createDeferredReadableStream({
        criticalData: undefined,
        deferredData: undefined,
      })
    ).toThrow();
  });
});

describe("encode / decode", () => {
  it("null as critical data", async () => {
    let stream = createDeferredReadableStream({
      criticalData: null,
      deferredData: undefined,
    });

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: null,
      deferredData: undefined,
    });
  });

  it("string as critical data", async () => {
    let stream = createDeferredReadableStream({
      criticalData: "hello, world",
      deferredData: undefined,
    });

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: "hello, world",
      deferredData: undefined,
    });
  });

  it("number as critical data", async () => {
    let stream = createDeferredReadableStream({
      criticalData: 42,
      deferredData: undefined,
    });

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: 42,
      deferredData: undefined,
    });
  });

  it("boolean as critical data", async () => {
    let stream = createDeferredReadableStream({
      criticalData: true,
      deferredData: undefined,
    });

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: true,
      deferredData: undefined,
    });
  });

  it("object without deferred", async () => {
    let stream = createDeferredReadableStream({
      criticalData: { a: "a", b: "b" },
      deferredData: undefined,
    });

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: { a: "a", b: "b" },
      deferredData: undefined,
    });
  });

  it("array without deferred", async () => {
    let stream = createDeferredReadableStream({
      criticalData: [1, 2, 3],
      deferredData: undefined,
    });

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: [1, 2, 3],
      deferredData: undefined,
    });
  });

  it("object with deferred", async () => {
    let c = Promise.resolve("c value");
    let d = Promise.resolve("d value");
    let criticalData = { a: "a", b: "b" };
    let stream = createDeferredReadableStream(
      getDeferrableData({ ...criticalData, c, d })
    );

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: {
        ...criticalData,
        c: DEFERRED_VALUE_PLACEHOLDER_PREFIX + "c",
        d: DEFERRED_VALUE_PLACEHOLDER_PREFIX + "d",
      },
      deferredData: { c: expect.any(Promise), d: expect.any(Promise) },
    });
    expect(await parsed.deferredData!.c).toEqual(await c);
    expect(await parsed.deferredData!.d).toEqual(await d);
  });

  it("array with deferred", async () => {
    let c = Promise.resolve("c value");
    let d = Promise.resolve("d value");
    let criticalData = [0, 1];
    let stream = createDeferredReadableStream(
      getDeferrableData([...criticalData, c, d])
    );

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: [
        ...criticalData,
        DEFERRED_VALUE_PLACEHOLDER_PREFIX + "2",
        DEFERRED_VALUE_PLACEHOLDER_PREFIX + "3",
      ],
      deferredData: { 2: expect.any(Promise), 3: expect.any(Promise) },
    });

    expect(await parsed.deferredData![2]).toEqual(await c);
    expect(await parsed.deferredData![3]).toEqual(await d);
  });

  it("object with deferred error", async () => {
    let c = Promise.resolve("c value");
    let d = Promise.reject(new Error("d error"));
    let criticalData = { a: "a", b: "b" };
    let stream = createDeferredReadableStream(
      getDeferrableData({ ...criticalData, c, d })
    );

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: {
        ...criticalData,
        c: DEFERRED_VALUE_PLACEHOLDER_PREFIX + "c",
        d: DEFERRED_VALUE_PLACEHOLDER_PREFIX + "d",
      },
      deferredData: { c: expect.any(Promise), d: expect.any(Promise) },
    });
    expect(await parsed.deferredData!.c).toEqual(await c);
    await expect(parsed.deferredData!.d).rejects.toThrow("d error");
  });

  it("array with deferred error", async () => {
    let c = Promise.resolve("c value");
    let d = Promise.reject(new Error("d error"));
    let criticalData = [0, 1];
    let stream = createDeferredReadableStream(
      getDeferrableData([...criticalData, c, d])
    );

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed).toEqual({
      criticalData: [
        ...criticalData,
        DEFERRED_VALUE_PLACEHOLDER_PREFIX + "2",
        DEFERRED_VALUE_PLACEHOLDER_PREFIX + "3",
      ],
      deferredData: { 2: expect.any(Promise), 3: expect.any(Promise) },
    });

    expect(await parsed.deferredData![2]).toEqual(await c);
    await expect(parsed.deferredData![3]).rejects.toThrow("d error");
  });
});
