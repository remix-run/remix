# Sharing Loader Data

Sometimes you have data loaded in one route and you want to access that data in another route's component that's active on screen. You can do this via the `useMatches` hook.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/sharing-loader-data)

## Example

This is a simple "workshop" app which has a "user" and a list of workshops. The user is loaded in the root loader and needed in the index route. The workshops are loaded in the workshops loader and then used in the individual workshop routes.

- [app/root.tsx](./app/root.tsx) - This loads the user
- [app/routes/index.tsx](./app/routes/index.tsx) - This accesses the root loader data to display the user's name
- [app/routes/workshops.tsx](./app/routes/workshops.tsx) - This loades the workshops to display them in a list of links
- [app/routes/workshops/$workshopId.tsx](./app/routes/workshops/workshopId.tsx) - This accesses the workshops loader data to display the workshop details

## Related Links

- [`useMatches`](https://remix.run/docs/en/v1/api/remix#usematches)

## Notes:

- The `app/routes/workshops/$workshopId.tsx` route has a loader in it to determine whether the workshop exists. This is important and does not defeat the purpose of sharing the data. The loader runs on the server and we benefit by sharing the data because we don't have to send the data to the client.
- A future version of Remix will provide an `id` on the `matches` which will make it easier to determine which match you want to access.
- You could create a custom hook for accessing specific matches and add type assertion functions to ensure type safety rather than use `as` casting.
