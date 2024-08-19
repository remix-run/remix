import * as assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFormData } from "./form-data.js";

describe("parseFormData", () => {
  it("should parse a multipart request", async () => {
    let request = new Request("http://localhost:8080", {
      method: "POST",
      headers: {
        "Content-Type":
          "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW"
      },
      body: [
        "------WebKitFormBoundary7MA4YWxkTrZu0gW",
        'Content-Disposition: form-data; name="text"',
        "",
        "Hello, World!",
        "------WebKitFormBoundary7MA4YWxkTrZu0gW",
        'Content-Disposition: form-data; name="file"; filename="example.txt"',
        "Content-Type: text/plain",
        "",
        "This is an example file.",
        "------WebKitFormBoundary7MA4YWxkTrZu0gW--"
      ].join("\r\n")
    });

    let formData = await parseFormData(request);

    assert.equal(formData.get("text"), "Hello, World!");

    let file = formData.get("file");
    assert.ok(file instanceof File);
    assert.equal(file.name, "example.txt");
    assert.equal(file.type, "text/plain");
    assert.equal(await file.text(), "This is an example file.");
  });
});
