import { Outlet } from "react-router-dom";

export default function LayoutTest() {
  return (
    <div data-test-id="_layout">
      <h1>Layout Test</h1>
      <Outlet />
    </div>
  );
}
