import React from "react";
import { create as createTestRenderer } from "react-test-renderer";
import { Link } from "@remix-run/react";

describe("A <Link>", () => {
  it("works", () => {
    let renderer = createTestRenderer(<Link />);
    expect(renderer.toJSON()).toMatchInlineSnapshot(`
      <a
        href="#"
      >
        link
      </a>
    `);
  });
});
