import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isUrlEncodedRequest, parseFormData } from "./form-data.js";

describe("isUrlEncodedRequest", () => {
  it('returns true for "application/x-www-form-urlencoded" requests', () => {
    let request = new Request("https://example.com", {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    assert.ok(isUrlEncodedRequest(request));
  });

  it('returns false for "multipart/form-data" requests', () => {
    let request = new Request("https://example.com", {
      headers: { "Content-Type": "multipart/form-data" }
    });

    assert.ok(!isUrlEncodedRequest(request));
  });
});
