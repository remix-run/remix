import type { TrackedPromise } from "../index";
import {
  DeferredData,
  createDeferredReadableStream,
  parseDeferredReadableStream,
} from "../index";

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
    let deferrable = new DeferredData({ a: "a", b: "b", c });
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
    expect(parsed.data).toEqual({
      a: "a",
      b: "b",
      c: expect.any(Promise),
    });

    await parsed.resolveData(new AbortController().signal);
    await expect((parsed.data.c as TrackedPromise)._error.message).toEqual(
      "Unexpected end of JSON input"
    );
  });
});

describe("DeferredData", () => {
  it("throws when null is passed", () => {
    expect(() => new DeferredData(null as any)).toThrow();
  });
  it("throws when array is passed", () => {
    expect(() => new DeferredData([] as any)).toThrow();
  });
});

describe("encode / decode", () => {
  it("object without deferred", async () => {
    let stream = createDeferredReadableStream(
      new DeferredData({ a: "a", b: "b" })
    );

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed.data).toEqual({ a: "a", b: "b" });
  });

  it("object with deferred", async () => {
    let c = Promise.resolve("c value");
    let d = Promise.resolve("d value");
    let criticalData = { a: "a", b: "b" };
    let stream = createDeferredReadableStream(
      new DeferredData({ ...criticalData, c, d })
    );

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed.data).toEqual({
      ...criticalData,
      c: expect.any(Promise),
      d: expect.any(Promise),
    });
    await parsed.resolveData(new AbortController().signal);
    expect((parsed.data.c as TrackedPromise)._data).toEqual(await c);
    expect((parsed.data.d as TrackedPromise)._data).toEqual(await d);
  });

  it("object with deferred error", async () => {
    let c = Promise.resolve("c value");
    let d = Promise.reject(new Error("d error"));
    let criticalData = { a: "a", b: "b" };
    let stream = createDeferredReadableStream(
      new DeferredData({ ...criticalData, c, d })
    );

    let parsed = await parseDeferredReadableStream(stream);
    expect(parsed.data).toEqual({
      ...criticalData,
      c: expect.any(Promise),
      d: expect.any(Promise),
    });
    await parsed.resolveData(new AbortController().signal);
    expect((parsed.data.c as TrackedPromise)._data).toEqual(await c);
    expect((parsed.data.d as TrackedPromise)._error.message).toEqual("d error");
  });
});
