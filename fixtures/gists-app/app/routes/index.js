import { Link } from "@remix-run/react";

import Shared from "../components/Shared";

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
            <Link to="/gists/mjijackson" className="text-blue-700 underline">
              Loader Redirect
            </Link>
          </li>
          <li>
            <Link
              to="/user-gists/ryanflorence"
              className="text-blue-700 underline"
            >
              Express Redirect
            </Link>
          </li>
          <li>
            <Link to="/fart" className="text-blue-700 underline">
              Broken link
            </Link>
          </li>
          <li>
            <Link to="/methods" className="text-blue-700 underline">
              Forms
            </Link>
          </li>
          <li>
            <Link to="/loader-errors?throw" className="text-blue-700 underline">
              Loader error with no ErrorBoundary
            </Link>
          </li>
          <li>
            <Link
              to="/loader-errors/nested"
              className="text-blue-700 underline"
            >
              Loader error in nested route with ErrorBoundary
            </Link>
          </li>

          <li>
            <Link to="/render-errors?throw" className="text-blue-700 underline">
              Render error with no ErrorBoundary
            </Link>
          </li>
          <li>
            <Link
              to="/render-errors/nested"
              className="text-blue-700 underline"
            >
              Render error in nested route with ErrorBoundary
            </Link>
          </li>
        </ul>
      </nav>
      <Shared />
    </div>
  );
}
