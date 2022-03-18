import * as React from "react";
import { Outlet } from "remix";

export default function LayoutTest() {
  return (
    <div data-test-id="_layout">
      <h1>Layout Test</h1>
      <Outlet />
    </div>
  );
}
