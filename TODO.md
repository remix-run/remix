## React Router TODOs

- Fix history bug, when hash clicks happen, `location.key` reverts to `default`
- For scrolling, add `useAction()` hook
- Be suspense
  - <Router preload={({ previousLocation, nextLocation }) => Promise<void>}>
  - `usePending()`
  - <Route preload={({ previousLocation, nextLocation }) => Promise<unknown>}>
  - `usePreloadValue()`
- Re-export all `react-router` types in `react-router-dom`
