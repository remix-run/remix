// ////////////////////////////////////////////////////////////////////////////////
// // - update actionData whenever an action lands
// // - update loaderData unless a later load has resolved already
// // - Ignore errors the same way the browser does w/o JS (new locations cancel
// //   everything about a previous location). This means only the latest
// //   location can trigger the error boundary, otherwise we'd have different
// //   results at the same location between documents and script navigation.
// //   one day I think I'd like to collect all of the errors and put them in the
// //   error boundary, any actions, any loaders, everything, but that day is not
// //   today.

// import type { Location } from "history";
// import type { RouteData } from "./routeData";

// async function fetchResources() {}
// async function fetchAction() {}
// function findRedirect() {}
// async function extractLoaderData() {}
// async function extractActionData() {}
// function isRedirect() {}
// function isAction() {}

// interface Init {
//   location: Location;
//   loaderData: RouteData;
//   actionData: RouteData;
// }

// export function transitionManager(
//   init: Init,
//   {
//     onChange,
//     onRedirect
//   }: { onChange: () => void; onRedirect: (pathname: string) => void }
// ) {
//   let currentLoadId = 0;
//   let pendingLoads = new Map();
//   let abortControllers = new Set();
//   let submitRefs = new WeakMap();

//   let state = {
//     location: init.location,
//     loaderData: init.loaderData,
//     actionData: init.actionData,
//     pendingSubmits: new Map(),
//     nextLocation: null,
//     error: null,
//     errorBoundaryId: null
//   };

//   function update(updates) {
//     Object.assign({}, state, updates);
//     onChange(state);
//   }

//   async function get(location, matches, actionError) {
//     let id = ++currentLoadId;
//     let controller = new AbortController();

//     pendingLoads.add(id, location);
//     abortControllers.set(id, controller);

//     let isStale = () => !pendingLoads.has(id);

//     let responses = await fetchResources(location, matches, actionError);
//     if (isStale()) return;

//     let redirect = findRedirect(responses);
//     if (redirect) return handleRedirect(redirect);

//     let [loaderData, error, errorBoundaryId] = await extractLoaderData(
//       responses,
//       matches
//     );
//     if (isStale()) return;

//     let showError = error && location === state.nextLocation;
//     if (!showError) {
//       // ignore errors of earlier locations (like the browser)
//       error = null;
//       errorBoundaryId = null;
//     }

//     let url = location.pathname + location.search;

//     if (showError) {
//       clearAllLoads();
//     } else {
//       clearStaleLoaderIds(id, url);
//     }

//     let latestUrl = state.location.pathname + state.location.search;
//     let onSamePage = url === latestUrl;
//     if (onSamePage) {
//       update({
//         loaderData,
//         location: location === state.nextLocation ? location : state.location,
//         error,
//         errorBoundaryId
//       });
//     }
//   }

//   async function post(location, matches, ref) {
//     submitRefs.set(ref, location.id);

//     let response = await fetchAction(location);
//     let isStale = () => {
//       let refResubmitted = submitRefs.get(ref) !== location.id;
//       return refResubmitted;
//     };

//     if (isStale()) return;
//     if (isRedirect(response)) return handleRedirect(response);

//     let [data, error] = await extractActionData(response, matches);
//     if (isStale()) return;

//     if (error) {
//       await get(location, matches, error);
//       return;
//     }

//     let actionData = new Map(state.actionData);
//     actionData.set(ref, data);

//     update({ actionData });
//     await get(location, matches);
//   }

//   function clearAllLoads() {}

//   function clearStaleLoaderIds(latestId, resolvedUrl) {
//     let nextPendingLoadIds = new Map();
//     for (let [location, id] of pendingLoads) {
//       let url = location.pathname + location.search;
//       let isStale = url === resolvedUrl && id <= latestId;
//       if (isStale) {
//         abortControllers.get(latestId).abort();
//         abortControllers.delete(latestId);
//       } else {
//         nextPendingLoadIds.add(id, location);
//       }
//     }
//     pendingLoads = nextPendingLoadIds;
//   }

//   async function handleRedirect(response) {
//     let location = response.headers.get("X-Remix-Redirect");
//     onChange(location);
//   }

//   return async (location, matches, submitRef) => {
//     update({ nextLocation: location });
//     if (isAction(location)) {
//       await post(location, matches, submitRef);
//     } else {
//       await get(location, matches);
//     }
//   };
// }
