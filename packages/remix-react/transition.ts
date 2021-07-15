// TODO: try/catch get/post or the fetches or something!
import type { Location } from "history";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { ClientRoute } from "./routes";

import { matchClientRoutes } from "./routeMatching";
import invariant from "./invariant";

type ClientMatch = RouteMatch<ClientRoute>;

// FIXME: Put error stuff as init info too so we can initialize in an error
// state from the server?
export interface TransitionManagerInit {
  routes: ClientRoute[];
  location: Location;
  loaderData: RouteData;
  actionData?: RouteData;
  error?: Error;
  errorBoundaryId?: null | string;
  onChange: (state: TransitionState) => void;
  onRedirect: (pathname: string, ref?: SubmissionRef) => void;
}

export interface TransitionState {
  /**
   * The current location the user sees in the browser, during a transition this
   * is the "old page"
   */
  location: Location;

  /**
   * The current set of route matches the user sees in the browser. During a
   * transition this are the "old matches"
   */
  matches: ClientMatch[];

  /**
   * Data from the loaders that user sees in the browser. During a transition
   * this is the "old" data, unless there are multiple pending forms, in which
   * case this may be updated as fresh data loads complete
   */
  loaderData: RouteData;

  /**
   * This holds the singular, latest action response data to emulate browser
   * behavior of only allowing one navigation to be pending at a time. This will
   * always be the same value as the latest refActionData when apps are tracking
   * action data with refs.
   */
  actionData?: RouteData;

  /**
   * The next matches that are being fetched.
   */
  nextMatches?: ClientMatch[];

  /**
   * Tracks all the pending form submissions by Form and useSubmit refs.
   */
  pendingSubmissionRefs: Map<SubmissionRef, SubmissionState>;

  /**
   * The next location being loaded.
   */
  nextLocation?: Location;

  /**
   * Persists uncaught loader/action errors. TODO: should probably be an array
   * and keep track of them all and pass the array to ErrorBoundary.
   */
  error?: Error;

  /**
   * The id of the nested ErrorBoundary in which to render the error.
   *
   * - undefined: no error
   * - null: error, but no routes have a boundary, use a default
   * - string: actual id
   */
  errorBoundaryId: null | string;
}

export interface SubmissionState {
  isAction: true;
  action: string;
  method: string;
  body: string;
  encType: string;
  id: number;
}

/**
 * Used to associate a <Form> or submit() with a usePendingSubmission(ref) and
 * useActionData(ref);
 */
export type SubmissionRef = HTMLFormElement | Object;

/**
 * We distinguish GET from POST/PUT/PATCH/DELETE locations with location state.
 * This enables us to repost form on pop events, even across origin boundaries
 * in the history stack.
 */
type ActionLocation = Location<SubmissionState>;
type ActionRedirectLocation = Location<{
  id: number;
  isActionRedirect: true;
}>;

export class TransitionRedirect {
  location: string;
  constructor(location: Location | string) {
    this.location =
      typeof location === "string"
        ? location
        : location.pathname + location.search;
  }
}

/**
 * As it is named, it uh ... emulates browser location transitions with some
 * added progressive enhancement fun.
 *
 * - update actionData whenever an action lands
 * - update loaderData unless a later load has resolved already
 * - Ignore errors the same way the browser does w/o JS (new locations cancel
 *   everything about a previous location). This means only the latest
 *   location can trigger the error boundary, otherwise we'd have different
 *   results at the same location between documents and script navigation.
 *   One day I think I'd like to collect all of the errors and put them in the
 *   error boundary, any actions, any loaders, everything, but that day is not
 *   today.
 */

export function createTransitionManager(init: TransitionManagerInit) {
  let { routes } = init;

  // We know which loads to commit and which to ignore by incrementing this ID.
  let currentLoadId = 0;
  let currentActionId = 0;

  // Track them so we can abort/ignore them when fresher requests come in
  let pendingLoads = new Map<number, [Location, SubmissionRef?]>();
  let pendingSubmissions = new Map<number, [ActionLocation, SubmissionRef?]>();

  // When loads become stale, we can actually abort them instead of just ignoring
  let loadAbortControllers = new Map<number, AbortController>();
  let actionAbortControllers = new Map<number, AbortController>();

  // Persists all the action data that is assigned to a Form or useSubmit ref.
  // - Not part of state because we don't know their lifecycle. With
  //   pendingSubmissionRefs, we know how long we're pending and we know when to
  //   clean up, but actionDataRefs persist after the submission and any
  //   subsequent renders that the ref is still current. An app could get rid of a
  //   ref outside of navigation and there's just no way for us to know.
  // - Because it is a WeakMap, when the application loses a reference to the
  //   ActionRef, the browser will garbage collect it and it will automatically
  //   fall out of this map, so no need for us to clean it up anyway.
  // - Implementors won't be able to rely on `onChange` for information here,
  //   but instead use the imperative `getActionDataForRef` method. Good news is
  //   the only time these are mutated are on navigations, so it should be
  //   reliable for rendering
  let actionDataRefs = new WeakMap<SubmissionRef, RouteData>();

  let matches = matchClientRoutes(routes, init.location);
  invariant(matches, "No initial route matches!");

  let state: TransitionState = {
    location: init.location,
    loaderData: init.loaderData,
    actionData: init.actionData,
    error: init.error,
    errorBoundaryId: init.errorBoundaryId || null,
    matches,
    pendingSubmissionRefs: new Map(),
    nextMatches: undefined,
    nextLocation: undefined
  };

  function update(updates: Partial<TransitionState>) {
    state = Object.assign({}, state, updates);
    init.onChange(state);
  }

  async function get(
    location: Location,
    ref?: SubmissionRef,
    actionErrorResult?: RouteLoaderErrorResult
  ) {
    let matches = state.nextMatches;
    invariant(matches, "No matches on state");

    let id = ++currentLoadId;
    let controller = new AbortController();

    pendingLoads.set(id, [location, ref]);
    let isStale = () => !pendingLoads.has(id);

    loadAbortControllers.set(id, controller);

    abortStaleLoads(id, location);
    abortStaleSubmissions(Number.MAX_SAFE_INTEGER);

    let results = await callLoaders(
      state,
      location,
      matches,
      controller.signal,
      actionErrorResult
    );

    if (isStale()) {
      return;
    }

    let redirect = findRedirect(results);
    if (redirect) {
      handleRedirect(redirect);
      return;
    }

    let [error, errorBoundaryId] = findError(
      results,
      matches,
      actionErrorResult
    );

    if (ref) {
      // With refs it gets a little wild because we let earlier navigations
      // continue so we can update the state as everything lands along the way.
      // Particularly, we use the data from the *latest load to land*, but the
      // nextLocation/nextMatches of the *latest navigation*, and finally the
      // location/matches of the latest load when nothing is pending anymore
      // (even if it wasn't the last one to land!)
      abortStaleRefLoads(id);
      let isLatestNavigation = location === state.nextLocation;
      let isLastLoadStanding = pendingLoads.size === 1;
      let loaderData = makeLoaderData(results, matches);

      if (isLatestNavigation && isLastLoadStanding) {
        // A) POST /foo |------|-----O
        // B) POST /foo    |-------|----O
        //                              👆
        // A) POST /foo |------|-------------X
        // B) POST /foo    |-------|----O
        //                              👆
        update({
          location,
          matches,
          nextLocation: undefined,
          nextMatches: undefined,
          error,
          errorBoundaryId,
          loaderData
        });
      } else if (!isLatestNavigation && isLastLoadStanding) {
        //                            👇
        // A) POST /foo |----------|---O
        // B) POST /foo    |---|-----O
        //
        //                            👇
        // A) POST /foo |----------|---O
        // B) POST /foo    |---|----------X
        update({
          location: state.nextLocation,
          matches: state.nextMatches,
          nextLocation: undefined,
          nextMatches: undefined,
          error,
          errorBoundaryId,
          loaderData
        });
      } else if (isLatestNavigation && !isLastLoadStanding) {
        // A) POST /foo |----------|------O
        // B) POST /foo    |---|-------O
        //                             👆
        update({ loaderData });
      } else if (!isLatestNavigation && !isLastLoadStanding) {
        //                          👇
        // A) POST /foo |-----|------O
        // B) POST /foo    |------|-------O
        update({ loaderData });
      }

      // A) POST /foo |---------|---O
      // B) POST /foo    |---|---------X
      //      should have been aborted!👆

      //      should have been aborted!👇
      // A) POST /foo |---------|-------X
      // B) POST /foo    |---------|--O
    } else {
      // Without refs it's straightforward, every other pending load has already
      // been aborted, so the fact we're here means we're the latest all around
      let nextState: Partial<TransitionState> = {
        loaderData: makeLoaderData(results, matches),
        location,
        matches,
        error,
        errorBoundaryId,
        nextLocation: undefined,
        nextMatches: undefined
      };

      if (!isAction(location)) {
        nextState.actionData = undefined;
      }

      update(nextState);
    }
  }

  async function post(location: ActionLocation, ref?: SubmissionRef) {
    let matches = state.nextMatches;
    invariant(matches, "No matches on state.");

    let id = ++currentActionId;
    let controller = new AbortController();

    pendingSubmissions.set(id, [location, ref]);
    let isStale = () => !pendingSubmissions.has(id);

    let clearPendingSubmissionRef = () => {
      invariant(ref, "No pending ref but the code tried to clear it.");
      let nextSubmissions = new Map(state.pendingSubmissionRefs);
      nextSubmissions.delete(ref);
      return nextSubmissions;
    };

    actionAbortControllers.set(id, controller);

    abortStaleSubmissions(id);
    abortStaleLoads(Number.MAX_SAFE_INTEGER, location);

    let leafMatch = matches.slice(-1)[0];
    let result = await callAction(location, leafMatch, controller.signal);

    if (isStale()) {
      return;
    }

    if (isRedirectResult(result)) {
      if (ref) {
        update({
          pendingSubmissionRefs: clearPendingSubmissionRef()
        });
      }
      return handleRedirect(result.value, ref);
    }

    if (result.value instanceof Error) {
      if (ref) {
        update({
          pendingSubmissionRefs: clearPendingSubmissionRef()
        });
      }
      await get(location, ref, result);
      return;
    }

    if (ref) {
      actionDataRefs.set(ref, result.value);
      update({
        actionData: result.value,
        pendingSubmissionRefs: clearPendingSubmissionRef()
      });
    } else {
      update({ actionData: result.value });
    }

    await get(location, ref);
  }

  function makeLoaderData(
    results: RouteLoaderResult[],
    matches: ClientMatch[]
  ) {
    let newData: RouteData = {};
    for (let { match, value } of results) {
      newData[match.route.id] = value;
    }

    let loaderData: RouteData = {};
    for (let { route } of matches) {
      let value =
        newData[route.id] !== undefined
          ? newData[route.id]
          : state.loaderData[route.id];
      if (value !== undefined) {
        loaderData[route.id] = value;
      }
    }

    return loaderData;
  }

  function abortStaleLoad(id: number) {
    let controller = loadAbortControllers.get(id);
    invariant(controller, `No abortController for load: ${id}`);
    controller.abort();
    loadAbortControllers.delete(id);
    pendingLoads.delete(id);
  }

  /**
   * If a ref load started later and landed earlier, abort any earlier ref
   * loads.
   *
   * A) POST /foo |----|O----------X
   *                       v-- don't abort (A) because it might land sooner
   * B) POST /foo    |----|O----O
   *                            ^--abort (A) now cause we know it's stale
   */
  function abortStaleRefLoads(latestId: number) {
    for (let [id] of pendingLoads) {
      let isStale = id < latestId;
      if (isStale) {
        abortStaleLoad(id);
      }
    }
  }

  function abortStaleLoads(latestId: number, location: Location<any>) {
    for (let [id, [, ref]] of pendingLoads) {
      if (ref) {
        let url = location.pathname + location.search;
        let latestUrl = state.location.pathname + state.location.search;
        let isSamePageTheUserIsLookingAt = url === latestUrl;
        if (isSamePageTheUserIsLookingAt) {
          continue;
        }
      }
      let isStale = id < latestId;
      if (isStale) {
        abortStaleLoad(id);
      }
    }
  }

  function abortStaleSubmission(id: number) {
    let controller = actionAbortControllers.get(id);
    invariant(controller, `No abortController for submission: ${id}`);
    controller.abort();
    actionAbortControllers.delete(id);
    pendingSubmissions.delete(id);
  }

  function abortAllSubmissionRefs() {
    for (let [id] of pendingSubmissions) {
      abortStaleSubmission(id);
    }
  }

  function abortStaleSubmissions(latestId: number) {
    for (let [id, [, ref]] of pendingSubmissions) {
      if (ref) {
        continue;
      }

      let isStale = id < latestId;
      if (isStale) {
        abortStaleSubmission(id);
      }
    }
  }

  function handleRedirect(redirect: TransitionRedirect, ref?: SubmissionRef) {
    init.onRedirect(redirect.location, ref);
  }

  async function send(location: Location, ref?: SubmissionRef) {
    let matches = matchClientRoutes(routes, location);
    invariant(matches, "No matches found");

    let nextState: Partial<TransitionState> = {
      nextLocation: location,
      nextMatches: matches,
      error: undefined,
      errorBoundaryId: undefined
    };

    if (ref) {
      if (isAction(location)) {
        let nextSubmissions = new Map(state.pendingSubmissionRefs);
        nextSubmissions.set(ref, location.state);
        nextState.pendingSubmissionRefs = nextSubmissions;
      }
    } else {
      abortAllSubmissionRefs();
      nextState.pendingSubmissionRefs = new Map();
    }

    update(nextState);

    if (isAction(location)) {
      await post(location, ref);
    } else {
      await get(location, ref);
    }
  }

  function getState() {
    return state;
  }

  function dispose() {}

  function getRefActionData(ref: SubmissionRef) {
    return actionDataRefs.get(ref);
  }

  function getPendingRefSubmission(ref: SubmissionRef) {
    return state.pendingSubmissionRefs.get(ref);
  }

  return {
    send,
    getState,
    dispose,
    getRefActionData,
    getPendingRefSubmission
  };
}

export type RouteLoaderResult = {
  match: ClientMatch;
  value: TransitionRedirect | Error | any;
};

export type RouteLoaderRedirectResult = {
  match: ClientMatch;
  value: TransitionRedirect;
};

export type RouteLoaderErrorResult = {
  match: ClientMatch;
  value: Error;
};

async function callLoaders(
  state: TransitionState,
  location: Location,
  matches: ClientMatch[],
  signal: AbortSignal,
  actionErrorResult?: RouteLoaderErrorResult
): Promise<RouteLoaderResult[]> {
  let matchesToLoad = filterMatchesToLoad(
    state,
    location,
    matches,
    actionErrorResult
  );

  return Promise.all(
    matchesToLoad.map(async match => {
      invariant(
        match.route.loader,
        `Expected ${match.route.id} to have a loader`
      );

      try {
        let value = await match.route.loader({
          match,
          location,
          signal
        });
        return { match, value };
      } catch (error) {
        return { match, value: error };
      }
    })
  );
}

async function callAction(
  location: ActionLocation,
  match: ClientMatch,
  signal: AbortSignal
): Promise<RouteLoaderResult> {
  if (!match.route.action) {
    throw new Error(
      `Route "${match.route.id}" does not have an action, but you are trying ` +
        `to submit to it. To fix this, please add an \`action\` function to the route`
    );
  }

  try {
    let value = await match.route.action({
      match,
      location,
      signal
    });
    return { match, value };
  } catch (error) {
    return { match, value: error };
  }
}

function filterMatchesToLoad(
  state: TransitionState,
  location: Location,
  matches: ClientMatch[],
  actionErrorResult?: RouteLoaderErrorResult
): ClientMatch[] {
  let filterByRouteProps = (match: ClientMatch, index: number) => {
    return match.route.loader
      ? match.route.shouldReload
        ? match.route.shouldReload({
            nextLocation: location,
            prevLocation: state.location,
            nextMatch: match,
            prevMatch: state.matches[index]
          })
        : true
      : false;
  };

  if (
    // mutation, reload for fresh data
    isAction(location) ||
    isActionRedirect(location) ||
    // clicked the same link, resubmit a GET form, reload
    createHref(location) === createHref(state.location) ||
    // search affects all loaders
    location.search !== state.location.search
  ) {
    return matches.filter(filterByRouteProps);
  }

  return matches
    .filter((match, index, arr) => {
      // don't load errored action route
      if (actionErrorResult && arr.length - 1 === index) {
        return false;
      }

      return (
        // new route
        !state.matches[index] ||
        // existing route but params changed
        state.matches[index].pathname !== match.pathname ||
        // catchall param changed
        state.matches[index].params["*"] !== match.params["*"]
      );
    })
    .filter(filterByRouteProps);
}

function createHref(location: Location) {
  return location.pathname + location.search;
}

function findRedirect(results: RouteLoaderResult[]): TransitionRedirect | null {
  for (let result of results) {
    if (isRedirectResult(result)) {
      return result.value;
    }
  }
  return null;
}

// When moved to React Router maybe use the route objects instead of ids?
function findError(
  results: RouteLoaderResult[],
  matches: ClientMatch[],
  actionErrorResult?: RouteLoaderErrorResult
): [Error, string | null] | [undefined, undefined] {
  let loaderErrorResult;

  for (let result of results) {
    let isError = result.value instanceof Error;

    if (isError) {
      loaderErrorResult = result;
      break;
    }
  }

  // Weird case where action errored, and then a parent loader ALSO errored, we
  // use the action error but the loader's nearest boundary (cause we can't
  // render down to the boundary the action would prefer)
  if (actionErrorResult && loaderErrorResult) {
    let boundaryId = findNearestBoundary(loaderErrorResult.match, matches);
    return [actionErrorResult.value, boundaryId];
  }

  if (actionErrorResult) {
    let boundaryId = findNearestBoundary(actionErrorResult.match, matches);
    return [actionErrorResult.value, boundaryId];
  }

  if (loaderErrorResult) {
    let boundaryId = findNearestBoundary(loaderErrorResult.match, matches);
    return [loaderErrorResult.value, boundaryId];
  }

  return [undefined, undefined];
}

function findNearestBoundary(
  matchWithError: ClientMatch,
  matches: ClientMatch[]
): string | null {
  let nearestBoundaryId: null | string = null;
  for (let match of matches) {
    if (match.route.ErrorBoundary) {
      nearestBoundaryId = match.route.id;
    }

    // only search parents (stop at throwing match)
    if (match === matchWithError) {
      break;
    }
  }

  return nearestBoundaryId;
}

function isRedirectResult(
  result: RouteLoaderResult
): result is RouteLoaderRedirectResult {
  return result.value instanceof TransitionRedirect;
}

export function isAction(location: Location<any>): location is ActionLocation {
  return !!location.state?.isAction;
}

function isActionRedirect(
  location: Location<any>
): location is ActionRedirectLocation {
  return !!location.state?.isActionRedirect;
}
