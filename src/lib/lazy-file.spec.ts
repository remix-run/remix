import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type LazyFileContent, LazyFile } from "./lazy-file.js";

function createContent(value = ""): LazyFileContent {
  let buffer = new TextEncoder().encode(value);
  return {
    byteLength: buffer.byteLength,
    read() {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        }
      });
    }
  };
}

describe("LazyFile", () => {
  it("has the correct name, size, type, and lastModified timestamp", () => {
    let now = Date.now();
    let file = new LazyFile(createContent("X".repeat(100)), "example.txt", {
      type: "text/plain",
      lastModified: now
    });

    assert.equal(file.name, "example.txt");
    assert.equal(file.size, 100);
    assert.equal(file.type, "text/plain");
    assert.equal(file.lastModified, now);
  });

  it("returns the file's contents as a stream", async () => {
    let content = createContent("hello world");
    let file = new LazyFile(content, "hello.txt", {
      type: "text/plain"
    });

    let decoder = new TextDecoder();
    let result = "";
    for await (let chunk of file.stream()) {
      result += decoder.decode(chunk, { stream: true });
    }
    result += decoder.decode();

    assert.equal(result, "hello world");
  });

  it("returns the file's contents as a string", async () => {
    let content = createContent("hello world");
    let file = new LazyFile(content, "hello.txt", {
      type: "text/plain"
    });

    assert.equal(await file.text(), "hello world");
  });

  describe("slice()", () => {
    it("returns a file with the same name, type, and lastModified timestamp when slicing a file", () => {
      let file = new LazyFile(createContent(), "hello.txt", {
        type: "text/plain",
        lastModified: Date.now()
      });
      let slice = file.slice(0, 5, file.type);
      assert.equal(slice.name, file.name);
      assert.equal(slice.type, file.type);
      assert.equal(slice.lastModified, file.lastModified);
    });

    it("returns a file with the same size as the original when slicing from 0 to the end", () => {
      let file = new LazyFile(createContent("hello world"), "hello.txt", {
        type: "text/plain"
      });
      let slice = file.slice(0);
      assert.equal(slice.size, file.size);
    });

    it('returns a file with size 0 when the "start" index is greater than the content length', () => {
      let file = new LazyFile(createContent("hello world"), "hello.txt", {
        type: "text/plain"
      });
      let slice = file.slice(100);
      assert.equal(slice.size, 0);
    });

    it('returns a file with size 0 when the "start" index is greater than the "end" index', () => {
      let file = new LazyFile(createContent("hello world"), "hello.txt", {
        type: "text/plain"
      });
      let slice = file.slice(5, 0);
      assert.equal(slice.size, 0);
    });

    it("calls content.read() with the correct range", t => {
      let content = createContent("X".repeat(100));
      let read = t.mock.method(content, "read");
      let file = new LazyFile(content, "example.txt", { type: "text/plain" });
      file.slice(10, 20).stream();
      assert.equal(read.mock.calls.length, 1);
      assert.deepEqual(read.mock.calls[0].arguments, [10, 20]);
    });

    it('calls content.read() with the correct range when slicing a file with a negative "start" index', t => {
      let content = createContent("X".repeat(100));
      let read = t.mock.method(content, "read");
      let file = new LazyFile(content, "example.txt", { type: "text/plain" });
      file.slice(-10).stream();
      assert.equal(read.mock.calls.length, 1);
      assert.deepEqual(read.mock.calls[0].arguments, [90, 100]);
    });

    it('calls content.read() with the correct range when slicing a file with a negative "end" index', t => {
      let content = createContent("X".repeat(100));
      let read = t.mock.method(content, "read");
      let file = new LazyFile(content, "example.txt", { type: "text/plain" });
      file.slice(0, -10).stream();
      assert.equal(read.mock.calls.length, 1);
      assert.deepEqual(read.mock.calls[0].arguments, [0, 90]);
    });

    it('calls content.read() with the correct range when slicing a file with negative "start" and "end" indexes', t => {
      let content = createContent("X".repeat(100));
      let read = t.mock.method(content, "read");
      let file = new LazyFile(content, "example.txt", { type: "text/plain" });
      file.slice(-20, -10).stream();
      assert.equal(read.mock.calls.length, 1);
      assert.deepEqual(read.mock.calls[0].arguments, [80, 90]);
    });

    it('calls content.read() with the correct range when slicing a file with a "start" index greater than the "end" index', t => {
      let content = createContent("X".repeat(100));
      let read = t.mock.method(content, "read");
      let file = new LazyFile(content, "example.txt", { type: "text/plain" });
      file.slice(20, 10).stream();
      assert.equal(read.mock.calls.length, 1);
      assert.deepEqual(read.mock.calls[0].arguments, [20, 20]);
    });
  });
});
