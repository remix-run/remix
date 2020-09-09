import React from "react";
import { Outlet } from "react-router-dom";
import { Link } from "@remix-run/react";

export default function Gists() {
  return (
    <div data-test-id="/gists">
      <header>
        <h1>Gists</h1>
        <ul>
          <li>
            <Link to="/gists/ryanflorence" className="text-blue-700 underline">
              Ryan Florence
            </Link>
          </li>
          <li>
            <Link to="/gists/mjackson" className="text-blue-700 underline">
              Michael Jackson
            </Link>
          </li>
        </ul>
      </header>
      <Outlet />
    </div>
  );
}
