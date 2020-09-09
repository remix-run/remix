import { createReadStream } from "fs";
import { Readable } from "stream";
import { Headers, Message } from "../platform";

describe("Headers", () => {
  it("clones an existing headers object", () => {
    let originalHeaders = new Headers({
      "Content-Type": "text/html",
      "Content-Length": "123"
    });

    let headers = new Headers(originalHeaders);

    expect(headers.entries()).toMatchInlineSnapshot(`
      Array [
        Array [
          "content-type",
          "text/html",
        ],
        Array [
          "content-length",
          "123",
        ],
      ]
    `);
  });

  it("knows if it has a header or not", () => {
    let headers = new Headers();
    headers.set("Content-Type", "text/html");

    expect(headers.has("Content-Type")).toBe(true);
    expect(headers.has("Set-Cookie")).toBe(false);
  });

  it("appends values to a header when it is already present", () => {
    let headers = new Headers({
      "Set-Cookie": "cookie=yummy"
    });

    headers.append("Set-Cookie", "type=chocolate-chip");

    expect(headers.get("Set-Cookie")).toMatchInlineSnapshot(
      `"cookie=yummy,type=chocolate-chip"`
    );
  });

  it("provides the keys in insertion order", () => {
    let headers = new Headers();
    headers.set("Content-Type", "text/html");
    headers.set("Content-Length", "123");

    expect(headers.keys()).toMatchInlineSnapshot(`
      Array [
        "content-type",
        "content-length",
      ]
    `);
  });

  it("provides the values in insertion order", () => {
    let headers = new Headers();
    headers.set("Content-Type", "text/html");
    headers.set("Content-Length", "123");

    expect(headers.values()).toMatchInlineSnapshot(`
      Array [
        "text/html",
        "123",
      ]
    `);
  });

  it("iterates over entries in insertion order", () => {
    let headers = new Headers();
    headers.set("Content-Type", "text/html");
    headers.set("Content-Length", "123");

    expect(headers.entries()).toMatchInlineSnapshot(`
      Array [
        Array [
          "content-type",
          "text/html",
        ],
        Array [
          "content-length",
          "123",
        ],
      ]
    `);
  });
});

function drainStream(stream: Readable) {
  return new Promise(accept => {
    stream
      .on("data", () => {})
      .on("end", () => {
        accept();
      });
  });
}

describe("Message", () => {
  it("knows when a stream body has been used", async () => {
    let stream = createReadStream(__filename);
    let message = new Message(stream);

    expect(message.bodyUsed).toBe(false);

    await drainStream(message.body as Readable);

    expect(message.bodyUsed).toBe(true);
  });
});
