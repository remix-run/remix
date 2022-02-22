// const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  "testing-library/await-async-query": ERROR,
  "testing-library/await-async-utils": ERROR,
  "testing-library/no-await-sync-events": ERROR,
  "testing-library/no-await-sync-query": ERROR,
  "testing-library/no-debugging-utils": WARN,
  "testing-library/no-promise-in-fire-event": ERROR,
  "testing-library/no-render-in-setup": ERROR,
  "testing-library/no-unnecessary-act": ERROR,
  "testing-library/no-wait-for-empty-callback": ERROR,
  "testing-library/no-wait-for-multiple-assertions": ERROR,
  "testing-library/no-wait-for-side-effects": ERROR,
  "testing-library/no-wait-for-snapshot": ERROR,
  "testing-library/prefer-find-by": WARN,
  "testing-library/prefer-presence-queries": WARN,
  "testing-library/prefer-query-by-disappearance": WARN,
  "testing-library/prefer-screen-queries": WARN,
  "testing-library/prefer-user-event": WARN,
  "testing-library/prefer-wait-for": WARN,
  "testing-library/render-result-naming-convention": WARN,
};
