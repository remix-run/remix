import React from "react";
import { Link } from "@remix-run/react";

export function meta() {
  return {
    title: "Gists Fixture App",
    description: "We're just tryin' to make sure stuff works, ya know?!"
  };
}

export default function Index() {
  return (
    <div data-test-id="/">
      <header>
        <h1>Cool Gists App</h1>
      </header>
      <nav>
        <ul>
          <li>
            <Link to="/gists" className="text-blue-700 underline">
              View Some gists
            </Link>
          </li>
          <li>
            <Link
              to="/user-gists/ryanflorence"
              className="text-blue-700 underline"
            >
              Server Redirect
            </Link>
          </li>
          <li>
            <Link to="/fart" className="text-blue-700 underline">
              Broken link
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
