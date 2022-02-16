import * as React from "react";
import { useLocation } from "react-router-dom";

import { useBeforeUnload, useTransition } from "./components";

let STORAGE_KEY = "positions";

let positions: { [key: string]: number } = {};

if (typeof document !== "undefined") {
  let sessionPositions = sessionStorage.getItem(STORAGE_KEY);
  if (sessionPositions) {
    positions = JSON.parse(sessionPositions);
  }
}

export function ScrollRestoration() {
  useScrollRestoration();

  // wait for the browser to restore it on its own
  React.useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  // let the browser restore on it's own for refresh
  useBeforeUnload(
    React.useCallback(() => {
      window.history.scrollRestoration = "auto";
    }, [])
  );

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          let STORAGE_KEY = ${JSON.stringify(STORAGE_KEY)};
          if (!window.history.state || !window.history.state.key) {
            window.history.replaceState({ key: Math.random().toString(32).slice(2) }, null);
          }
          try {
            let positions = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
            let storedY = positions[window.history.state.key];
            if (typeof storedY === 'number') {
              window.scrollTo(0, storedY)
            }
          } catch(error) {
            console.error(error)
            sessionStorage.removeItem(STORAGE_KEY)
          }
        `
      }}
    />
  );
}

let hydrated = false;

function useScrollRestoration() {
  let location = useLocation();
  let transition = useTransition();

  let wasSubmissionRef = React.useRef(false);

  React.useEffect(() => {
    if (transition.submission) {
      wasSubmissionRef.current = true;
    }
  }, [transition]);

  React.useEffect(() => {
    if (transition.location) {
      positions[location.key] = window.scrollY;
    }
  }, [transition, location]);

  useBeforeUnload(
    React.useCallback(() => {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    }, [])
  );

  if (typeof document !== "undefined") {
    // eslint-disable-next-line
    React.useLayoutEffect(() => {
      // don't do anything on hydration, the component already did this with an
      // inline script.
      if (!hydrated) {
        hydrated = true;
        return;
      }

      let y = positions[location.key];

      // been here before, scroll to it
      if (y) {
        window.scrollTo(0, y);
        return;
      }

      // try to scroll to the hash
      if (location.hash) {
        let el = document.querySelector(location.hash);
        if (el) {
          el.scrollIntoView();
          return;
        }
      }

      // don't do anything on submissions
      if (wasSubmissionRef.current === true) {
        wasSubmissionRef.current = false;
        return;
      }

      // otherwise go to the top on new locations
      window.scrollTo(0, 0);
    }, [location]);
  }

  React.useEffect(() => {
    if (transition.submission) {
      wasSubmissionRef.current = true;
    }
  }, [transition]);
}
