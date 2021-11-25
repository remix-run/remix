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

export function headers() {
  return {
    test: "value"
  };
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
            <Link to="/fart">Broken link</Link>
          </li>
          <li>
            <Link to="/methods">Forms</Link>
          </li>
          <li>
            <Link to="/actions">Actions</Link>
          </li>
          <li>
            <Link to="/fetchers">Fetchers</Link>
          </li>
          <li>
            <Link to="/loader-errors?throw">
              Loader error with no ErrorBoundary
            </Link>
          </li>
          <li>
            <Link to="/loader-errors?catch">
              Loader throws Response with no CatchBoundary
            </Link>
          </li>
          <li>
            <Link to="/loader-errors/nested">
              Loader error in nested route with ErrorBoundary
            </Link>
          </li>
          <li>
            <Link to="/loader-errors/nested-catch">
              Loader error in nested route with CatchBoundary
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
            <Link to="/multiple-set-cookies">Multiple Set Cookie Headers</Link>
          </li>

          <li>
            <Link to="prefs">Preferences</Link>
          </li>
          <li>
            <Link to="/catchall/flat">Catchall flat</Link>
          </li>
          <li>
            <Link to="/catchall/flat/sub">Catchall flat subroute</Link>
          </li>
          <li>
            <Link to="/catchall-nested">
              Catchall with layout index takes precedence
            </Link>
          </li>
          <li>
            <Link to="/catchall-nested/sub">Catchall with layout splat</Link>
          </li>
          <li>
            <Link to="/catchall-nested-no-layout">Catchall without layout</Link>
          </li>
          <li>
            <Link to="/catchall-nested-no-layout/sub">
              Catchall without layout splat
            </Link>
          </li>
          <li>
            <Link to="/with-layout">Route with _layout</Link>
          </li>
          <li>
            <Link to="/resources">Resource routes</Link>
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
