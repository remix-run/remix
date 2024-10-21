export function resourceRouteJsonWarning(
  type: "loader" | "action",
  routeId: string
) {
  return (
    "⚠️ REMIX FUTURE CHANGE: Externally-accessed resource routes will no longer be " +
    "able to return raw JavaScript objects or `null` in React Router v7 when " +
    "Single Fetch becomes the default. You can prepare for this change at your " +
    `convenience by wrapping the data returned from your \`${type}\` function in ` +
    `the \`${routeId}\` route with \`json()\`.  For instructions on making this ` +
    "change, see https://remix.run/docs/en/v2.13.1/guides/single-fetch#resource-routes"
  );
}
