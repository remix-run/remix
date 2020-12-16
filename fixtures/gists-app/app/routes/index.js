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
            <Link to="/exceptions?throw" className="text-blue-700 underline">
              Root Exception
            </Link>
          </li>
          <li>
            <Link to="/exceptions/nested" className="text-blue-700 underline">
              Nested Exception
            </Link>
          </li>
        </ul>
      </nav>
      <Shared />
    </div>
  );
}
