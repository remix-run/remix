import { Routes, Route, Outlet } from "react-router-dom";

export default function LayoutTest() {
  return (
    <div>
      <h1>Layout Test</h1>
      <Outlet />
    </div>
  );
}
