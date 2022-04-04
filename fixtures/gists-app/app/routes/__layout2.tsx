import { Outlet } from "@remix-run/react";

export default function LayoutTest2() {
  return (
    <div data-test-id="_layout">
      <h1>Layout Test 2</h1>
      <Outlet />
    </div>
  );
}
