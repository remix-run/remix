// TODO: try/catch get/post or the fetches or something!
import type { Location } from "history";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { ClientRoute } from "./routes";

import { matchClientRoutes } from "./routeMatching";
import invariant from "./invariant";

type ClientMatch = RouteMatch<ClientRoute>;

export interface TransitionManagerInit {
  routes: ClientRoute[];
  location: Location;
  loaderData: RouteData;
  actionData?: RouteData;
  keyedActionData?: RouteData;
  error?: Error;
  errorBoundaryId?: null | string;
  onChange: (state: TransitionState) => void;
  onRedirect: (location: Location<any>, referrer: Location<any>) => void;
}

export interface TransitionState {
  /**
   * The current location the user sees in the browser, during a transition this
   * is the "old page"
   */
  location: Location<any>;

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
  loaderData: { [routeId: string]: RouteData };

  /**
   * This holds the singular, latest action response data to emulate browser
   * behavior of only allowing one navigation to be pending at a time. This will
   * always be the same value as the latest keyedActionData when apps are tracking
   * action data with keys.
   * TODO: could store everything and "undefined" is a key for the latest
   */
  actionData?: RouteData;

  /**
   * Holds all the action data for submissions with keys.
   */
  keyedActionData: { [routeId: string]: RouteData };

  /**
   * The next matches that are being fetched.
   */
  nextMatches?: ClientMatch[];

  /**
   * Tracks all the pending submissions by submissionKey
   */
  pendingSubmissions: Map<string, SubmissionState>;

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
  // TODO: change to `isSubmission`
  isSubmission: true;
  action: string;
  method: string;
  body: string;
  encType: string;
  submissionKey?: string;
  id: number;
}

export interface KeyedSubmissionState extends SubmissionState {
  submissionKey: string;
}

/**
 * We distinguish GET from POST/PUT/PATCH/DELETE locations with location state.
 * This enables us to repost form on pop events, even across origin boundaries
 * in the history stack.
 */
interface ActionLocation extends Location<SubmissionState> {}

interface KeyedActionLocation extends Location<KeyedSubmissionState> {}

interface ActionRedirectLocation
  extends Location<{
    isActionRedirect: true;
  }> {}

interface KeyedActionRedirectLocation
  extends Location<{
    isActionRedirect: true;
  }> {}

export class TransitionRedirect {
  location: string;
  constructor(location: Location | string) {
    this.location =
      typeof location === "string"
        ? location
        : location.pathname + location.search;
  }
}

export function createTransitionManager(init: TransitionManagerInit) {
  let { routes } = init;

  // We know which loads to commit and which to ignore by incrementing this ID.
  let currentLoadId = 0;
  let currentActionId = 0;

  // Track them so we can abort/ignore them when fresher requests come in
  let pendingLoads = new Map<number, Location>();
  let pendingActions = new Map<number, ActionLocation>();

  // When loads become stale, we can actually abort them instead of just ignoring
  let loadAbortControllers = new Map<number, AbortController>();
  let actionAbortControllers = new Map<number, AbortController>();

  let matches = matchClientRoutes(routes, init.location);
  invariant(matches, "No initial route matches!");

  let state: TransitionState = {
    location: init.location,
    loaderData: init.loaderData || {},
    actionData: init.actionData,
    keyedActionData: init.keyedActionData || {},
    error: init.error,
    errorBoundaryId: init.errorBoundaryId || null,
    matches,
    pendingSubmissions: new Map(),
    nextMatches: undefined,
    nextLocation: undefined
  };

  function update(updates: Partial<TransitionState>) {
    state = Object.assign({}, state, updates);
    init.onChange(state);
  }

  async function get(
    location: Location,
    actionErrorResult?: RouteLoaderErrorResult
  ) {
    let id = ++currentLoadId;
    let matches = state.nextMatches;
    invariant(matches, "No matches on state");

    let controller = new AbortController();

    pendingLoads.set(id, location);
    let isStale = () => !pendingLoads.has(id);

    loadAbortControllers.set(id, controller);

    abortStaleLoads(id, location);
    abortStaleSubmissions(Number.MAX_SAFE_INTEGER, location);

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
      handleRedirect(redirect, location);
      return;
    }

    let [error, errorBoundaryId] = findError(
      results,
      matches,
      actionErrorResult
    );

    if (isKeyedSubmission(location) || isKeyedActionRedirect(location)) {
      // With keys it gets a little wild because we let earlier navigations
      // continue so we can update the state as everything lands along the way.
      // Particularly, we use the data from the *latest load to land*, but the
      // nextLocation/nextMatches of the *latest navigation*, and finally the
      // location/matches of the latest load when nothing is pending anymore
      // (even if it wasn't the last one to land!)
      abortStaleKeyedSubmissionLoads(id);
      let isLatestNavigation = location === state.nextLocation;
      let isLastLoadStanding =
        pendingActions.size === 0 && pendingLoads.size === 1;
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
        //
        //                      👇
        // A) POST /foo |-----|--O
        // B) POST /foo    |--------|---O
        update({ loaderData });
      } else {
        invariant(false, "Unexpected transition state");
      }

      // A) POST /foo |---------|---O
      // B) POST /foo    |---|---------X
      //      should have been aborted!👆

      //      should have been aborted!👇
      // A) POST /foo |---------|-------X
      // B) POST /foo    |---------|--O
    } else {
      // Without keys it's straightforward, every other pending load has already
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

      if (!isSubmission(location)) {
        nextState.actionData = undefined;
      }

      update(nextState);
    }
  }

  async function post(location: ActionLocation) {
    let id = ++currentActionId;
    let matches = state.nextMatches;
    invariant(matches, "No matches on state.");

    let controller = new AbortController();

    let isStale = () => !pendingActions.has(id);

    // TODO: double check how this works, might be better handled in `send`
    let clearPendingKeyedSubmission = () => {
      invariant(
        isKeyedSubmission(location),
        `This submission is has no submission key: ${location}`
      );
      let nextSubmissions = new Map(state.pendingSubmissions);
      nextSubmissions.delete(location.state.submissionKey);
      return nextSubmissions;
    };

    actionAbortControllers.set(id, controller);

    // TODO: double check if this could be better handled in `send`
    abortStaleSubmissions(id, location);
    abortStaleLoads(Number.MAX_SAFE_INTEGER, location);

    pendingActions.set(id, location);

    let leafMatch = matches.slice(-1)[0];
    let result = await callAction(location, leafMatch, controller.signal);

    if (isStale()) {
      return;
    }

    if (isRedirectResult(result)) {
      if (isKeyedSubmission(location)) {
        update({
          pendingSubmissions: clearPendingKeyedSubmission()
        });
      }
      abortStaleSubmission(id);
      return handleRedirect(result.value, location);
    }

    if (result.value instanceof Error) {
      if (isKeyedSubmission(location)) {
        update({
          pendingSubmissions: clearPendingKeyedSubmission()
        });
      }
      abortStaleSubmission(id);
      await get(location, result);
      return;
    }

    if (isKeyedSubmission(location)) {
      update({
        actionData: result.value,
        keyedActionData: {
          ...state.keyedActionData,
          [location.state.submissionKey]: result.value
        },
        pendingSubmissions: clearPendingKeyedSubmission()
      });
    } else {
      update({ actionData: result.value });
    }

    // TODO: don't call abort controller of this thing that just landed
    abortStaleSubmission(id);
    await get(location);
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
   * If a keyed load started later and landed earlier, abort any earlier keyed
   * loads.
   *
   * A) POST /foo |----|O----------X
   *                       v-- don't abort (A) because it might land sooner
   * B) POST /foo    |----|O----O
   *                            ^--abort (A) now cause we know it's stale
   */
  function abortStaleKeyedSubmissionLoads(latestId: number) {
    for (let [id] of pendingLoads) {
      let isStale = id < latestId;
      if (isStale) {
        abortStaleLoad(id);
      }
    }
  }

  function abortStaleLoads(latestId: number, location: Location<any>) {
    let isKeyed =
      isKeyedSubmission(location) || isKeyedActionRedirect(location);

    for (let [id, location] of pendingLoads) {
      if (isKeyed) {
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
    pendingActions.delete(id);
  }

  function abortAllSubmissions() {
    for (let [id] of pendingActions) {
      abortStaleSubmission(id);
    }
  }

  function abortStaleSubmissions(
    latestId: number,
    latestLocation: Location<any>
  ) {
    for (let [id, location] of pendingActions) {
      if (isKeyedSubmission(location)) {
        let isResubmission =
          location.state.submissionKey === latestLocation.state.submissionKey;
        if (isResubmission) abortStaleSubmission(id);
        continue;
      }

      let isStale = id < latestId;
      if (isStale) {
        abortStaleSubmission(id);
      }
    }
  }

  function handleRedirect(
    redirect: TransitionRedirect,
    referrer: Location<any>
  ) {
    let [pathname, search] = redirect.location.split("?");
    search ||= "";

    // hacks until this is in React Router proper because we probably won't even
    // need this `onRedirect` business anyway when it's all built-in
    let hash = "";
    let key = "";

    if (isKeyedSubmission(referrer)) {
      init.onRedirect(
        {
          pathname,
          search,
          hash: "",
          key: "",
          state: { isKeyedActionRedirect: true }
        },
        referrer
      );
    } else {
      init.onRedirect({ pathname, search, hash, key, state: null }, referrer);
    }
  }

  let dataKeyCounts: { [submissionKey: string]: number } = {};

  function registerKeyedActionDataRead(submissionKey: string) {
    if (dataKeyCounts[submissionKey]) {
      dataKeyCounts[submissionKey]++;
    } else {
      dataKeyCounts[submissionKey] = 1;
    }
    return () => {
      invariant(dataKeyCounts[submissionKey], `Key ${submissionKey} not found`);
      dataKeyCounts[submissionKey]--;
      if (dataKeyCounts[submissionKey] === 0) {
        delete dataKeyCounts[submissionKey];
        // don't call update, they removed the last thing reading this, so there's
        // no need to render (I think?)
        delete state.keyedActionData[submissionKey];
      }
    };
  }

  async function send(location: Location<any>) {
    let matches = matchClientRoutes(routes, location);
    invariant(matches, "No matches found");

    let nextState: Partial<TransitionState> = {
      nextLocation: location,
      nextMatches: matches,
      error: undefined,
      errorBoundaryId: undefined
    };

    if (isKeyedSubmission(location)) {
      let nextSubmissions = new Map(state.pendingSubmissions);
      nextSubmissions.set(location.state.submissionKey, location.state);
      nextState.pendingSubmissions = nextSubmissions;
    } else if (!isKeyedActionRedirect(location)) {
      abortAllSubmissions();
      nextState.pendingSubmissions = new Map();
      nextState.keyedActionData = {};
    }

    update(nextState);

    if (isSubmission(location)) {
      await post(location);
    } else {
      await get(location);
    }
  }

  function getState() {
    return state;
  }

  function dispose() {
    // TODO: just abort everything, doesn't matter in remix, but it will in
    // React Router if they unmount a <Routes>
  }

  return {
    send,
    getState,
    dispose,
    registerKeyedActionDataRead
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
    isSubmission(location) ||
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

export function isSubmission(
  location: Location<any>
): location is ActionLocation {
  return Boolean(location.state?.isSubmission);
}

export function isKeyedSubmission(
  location: Location<any>
): location is KeyedActionLocation {
  return Boolean(location.state?.isSubmission && location.state.submissionKey);
}

export function isKeyedActionRedirect(
  location: Location<any>
): location is KeyedActionRedirectLocation {
  return Boolean(location.state?.isKeyedActionRedirect);
}

function isActionRedirect(
  location: Location<any>
): location is ActionRedirectLocation {
  return !!location.state?.isActionRedirect;
}
