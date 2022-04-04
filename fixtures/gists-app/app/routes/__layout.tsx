import { Outlet } from "@remix-run/react";
import * as React from "react";

export default function LayoutTest() {
  return (
    <div data-test-id="_layout">
      <h1>Layout Test</h1>
      <Outlet />
    </div>
  );
}
