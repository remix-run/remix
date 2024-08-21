import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as path from "node:path";

import { DiskFileStorage } from "./disk-file-storage.node.js";

const __dirname = new URL(".", import.meta.url).pathname;

describe("DiskFileStorage (node)", () => {
  let directory = path.resolve(__dirname, "../../test-disk-storage");

  it("stores and retrieves files", async () => {
    let storage = new DiskFileStorage(directory);
    let file = new File(["Hello, world!"], "hello.txt", { type: "text/plain" });

    await storage.put("hello", file);

    assert.ok(await storage.has("hello"));

    let retrieved = await storage.get("hello");

    assert.ok(retrieved);
    assert.equal(retrieved.name, "hello.txt");
    assert.equal(retrieved.type, "text/plain");
    assert.equal(retrieved.size, 13);

    let buffer = await retrieved.arrayBuffer();

    assert.equal(buffer.byteLength, 13);

    let text = new TextDecoder().decode(buffer);

    assert.equal(text, "Hello, world!");

    await storage.remove("hello");

    assert.ok(!(await storage.has("hello")));
    assert.equal(await storage.get("hello"), null);
  });
});
