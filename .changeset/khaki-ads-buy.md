---
"@remix-run/react": patch
"@remix-run/server-runtime": patch
---

Remove hydration URL check that was originally added for React 17 hydration issues and we no longer support React 17

- Reverts the logic originally added in Remix `v1.18.0` via https://github.com/remix-run/remix/pull/6409
- This was added to resolve an issue that could arise when doing quick back/forward history navigations while JS was loading which would cause a mismatch between the server matches and client matches: https://github.com/remix-run/remix/issues/1757
- This specific hydration issue would then cause this React v17 only looping issue: https://github.com/remix-run/remix/issues/1678
- The URL comparison that we added in `1.18.0` turned out to be subject to false positives of it's own which could also put the user in looping scenarios
- Remix v2 upgraded it's minimal React version to v18 which eliminated the v17 hydration error loop
- React v18 handles this hydration error like any other error and does not result in a loop
- So we can remove our check and thus avoid the false-positive scenarios in which it may also trigger a loop
