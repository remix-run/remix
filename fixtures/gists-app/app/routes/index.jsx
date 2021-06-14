import { useEffect } from "react";
import { Link } from "remix";

import Shared from "../components/Shared";
// import Guitar from "../components/Guitar";
import { message as clientMessage } from "../scripts/message.client";
import { message as serverMessage } from "../scripts/message.server";

export function meta() {
  return {
    title: "Gists Fixture App",
    description: "We're just tryin' to make sure stuff works, ya know?!"
  };
}

export function loader() {
  if (process.env.NODE_ENV !== "test") {
    console.log(serverMessage);
  }

  return null;
}

export default function Index() {
  useEffect(() => {
    console.log(clientMessage);
  }, []);

  return (
    <div data-test-id="/">
      <header>
        <h1>Cool Gists App</h1>
      </header>
      <nav>
        <ul>
          <li>
            <Link to="/links">Link preloads and stuff</Link>
          </li>
          <li>
            <Link to="/gists">View Some gists</Link>
          </li>
          <li>
            <Link to="/gists/mjackson">View Michael's gists</Link>
          </li>
          <li>
            <Link to="/gists/mjijackson">Loader Redirect</Link>
          </li>
          <li>
            <Link to="/user-gists/ryanflorence">Express Redirect</Link>
          </li>
          <li>
            <Link to="/fart">Broken link</Link>
          </li>
          <li>
            <Link to="/methods">Forms</Link>
          </li>
          <li>
            <Link to="/actions">actions</Link>
          </li>
          <li>
            <Link to="/loader-errors?throw">
              Loader error with no ErrorBoundary
            </Link>
          </li>
          <li>
            <Link to="/loader-errors/nested">
              Loader error in nested route with ErrorBoundary
            </Link>
          </li>

          <li>
            <Link to="/render-errors?throw">
              Render error with no ErrorBoundary
            </Link>
          </li>
          <li>
            <Link to="/render-errors/nested">
              Render error in nested route with ErrorBoundary
            </Link>
          </li>

          <li>
            <Link to="prefs">Preferences</Link>
          </li>
        </ul>
      </nav>
      <Shared />
      {/*
      <hr />
      <Guitar />
      */}
    </div>
  );
}
