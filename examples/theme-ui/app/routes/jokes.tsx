/** @jsx jsx */
import React from "react";
import { jsx } from "@theme-ui/core";
import { Link } from "@remix-run/react";

export default function Jokes() {
  return (
    <div sx={{ backgroundColor: "primary" }}>
      <h1>Jokes</h1>
      <p>This route works fine.</p>
      <Link to="/">Back to home</Link>
    </div>
  );
}
