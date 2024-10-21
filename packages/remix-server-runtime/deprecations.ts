export function resourceRouteJsonWarning(
  type: "loader" | "action",
  routeId: string
) {
  return (
    "⚠️ REMIX FUTURE CHANGE: Resource routes will no longer be able to " +
    "return null or raw JavaScript objects in v3 when Single Fetch becomes the default. " +
    "You can prepare for this change at your convenience by wrapping the data " +
    `returned from your \`${type}\` function in the \`${routeId}\` route with ` +
    "`json()`.  For instructions on making this change see " +
    "https://remix.run/docs/en/v2.9.2/guides/single-fetch#resource-routes"
  );
}
