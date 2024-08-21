import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ByteRange, getByteLength, getIndexes } from "./byte-range.js";

describe("getByteLength", () => {
  it("returns the correct length", () => {
    let size = 100;

    let range: ByteRange = { start: 10, end: 20 };
    assert.strictEqual(getByteLength(range, size), 10);

    range = { start: 10, end: -10 };
    assert.strictEqual(getByteLength(range, size), 80);

    range = { start: -10, end: -10 };
    assert.strictEqual(getByteLength(range, size), 0);

    range = { start: -10, end: 20 };
    assert.strictEqual(getByteLength(range, size), 0);
  });
});

describe("getIndexes", () => {
  it("returns the correct indexes", () => {
    let size = 100;

    let range: ByteRange = { start: 10, end: 20 };
    assert.deepStrictEqual(getIndexes(range, size), [10, 20]);

    range = { start: 10, end: -10 };
    assert.deepStrictEqual(getIndexes(range, size), [10, 90]);

    range = { start: -10, end: -10 };
    assert.deepStrictEqual(getIndexes(range, size), [90, 90]);

    range = { start: -10, end: 20 };
    assert.deepStrictEqual(getIndexes(range, size), [90, 90]);
  });
});
