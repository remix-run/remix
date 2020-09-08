import React from "react";
import { Outlet } from "react-router-dom";

export default function Payments() {
  return (
    <div>
      <h1>Payments</h1>
      <Outlet />
    </div>
  );
}
