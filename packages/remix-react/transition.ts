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
  actionData: RouteData;
  onChange: (state: TransitionState) => void;
  onRedirect: (pathname: string) => void;
}

interface TransitionState {
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
  actionData: RouteData;

  /**
   * The next matches that are being fetched.
   */
  nextMatches?: ClientMatch[];

  /**
   * Tracks all the pending form submissions by Form and useSubmit refs.
   */
  pendingSubmissionRefs: Map<ActionRef, SubmissionState>;

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
  errorBoundaryId?: null | string;
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
type ActionRef = HTMLFormElement | Object;

/**
 * We distinguish GET from POST/PUT/PATCH/DELETE locations with location state.
 * This enables us to repost form on pop events, even across origin boundaries
 * in the history stack.
 */
type ActionLocation = Location<SubmissionState>;
type ActionRedirectLocation = Location<{ id: number; isActionRedirect: true }>;

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
  let pendingLoads = new Map<number, Location>();

  // When loads become stale, we can actually abort them instead of just ignoring
  let abortControllers = new Map<number, AbortController>();

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
  let actionDataRefs = new WeakMap<ActionRef, RouteData>();

  let matches = matchClientRoutes(routes, init.location);
  invariant(matches, "No initial route matches!");

  let state: TransitionState = {
    location: init.location,
    loaderData: init.loaderData,
    actionData: init.actionData,
    matches,
    pendingSubmissionRefs: new Map(),
    nextMatches: undefined,
    nextLocation: undefined,
    error: undefined,
    errorBoundaryId: undefined
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
    let controller = new AbortController();
    let matches = state.nextMatches;
    invariant(matches, "No matches on state");
    let isStale = () => !pendingLoads.has(id);

    pendingLoads.set(id, location);
    abortControllers.set(id, controller);

    // if (isAction(location)) {
    //   // ???
    //   // abortResubmits(location)
    // } else if (isActionRedirect(location)) {
    //   abortStaleLoad(id);
    // } else {
    //   abortStaleLoads(id);
    // }
    abortStaleLoads(id);

    let results = await loadRouteData(
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

  async function post(location: ActionLocation, ref?: ActionRef) {
    let controller = new AbortController();

    let isStale = () => {
      if (ref) {
        if (state.pendingSubmissionRefs.has(ref)) {
          let existingRef = state.pendingSubmissionRefs.get(ref);
          invariant(existingRef, `No pendingSubmission for ${ref}`);
          let refResubmitted = existingRef.id !== location.state.id;
          return refResubmitted;
        }
      }
      return location !== state.nextLocation;
    };

    let clearPendingSubmission = () => {
      invariant(ref, "No pending ref but the code tried to clear it.");
      let nextSubmissions = new Map(state.pendingSubmissionRefs);
      nextSubmissions.delete(ref);
      return nextSubmissions;
    };

    let matches = state.nextMatches;
    invariant(matches, "No matches on state.");

    if (ref) {
      let nextSubmissions = new Map(state.pendingSubmissionRefs);
      nextSubmissions.set(ref, location.state);
      update({ pendingSubmissionRefs: nextSubmissions });
    }

    let leafMatch = matches.slice(-1)[0];
    let result = await fetchAction(location, leafMatch, controller.signal);

    if (isStale()) {
      return;
    }

    if (isRedirectResult(result)) {
      if (ref) {
        update({ pendingSubmissionRefs: clearPendingSubmission() });
      }
      return handleRedirect(result.value);
    }

    if (result.value instanceof Error) {
      if (ref) {
        update({ pendingSubmissionRefs: clearPendingSubmission() });
      }
      await get(location, result);
      return;
    }

    if (ref) {
      actionDataRefs.set(ref, result.value);
      update({
        actionData: result.value,
        pendingSubmissionRefs: clearPendingSubmission()
      });
    } else {
      update({ actionData: result.value });
    }

    await get(location);
  }

  ///////////////////
  // Helpers
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
      // TODO: need to allow null here
      let value = newData[route.id] ?? state.loaderData[route.id];
      if (value) {
        loaderData[route.id] = value;
      }
    }

    return loaderData;
  }

  function abortStaleLoad(id: number) {
    let controller = abortControllers.get(id);
    invariant(controller, `No abortController for ${id}`);
    controller.abort();
    abortControllers.delete(id);
    pendingLoads.delete(id);
  }

  // When multiple loads are in flight and a load with a higher ID takes off, we
  // can abort any loads with a lower ID because their data is going to be stale
  // when it lands.
  function abortStaleLoads(latestId: number) {
    for (let [id] of pendingLoads) {
      let isStale = id < latestId;
      if (isStale) {
        abortStaleLoad(id);
      }
    }
  }

  function handleRedirect(redirect: TransitionRedirect) {
    init.onRedirect(redirect.location);
  }

  ///////////////////
  // Public Interface
  async function send(location: Location, submitRef?: ActionRef) {
    let matches = matchClientRoutes(routes, location);
    invariant(matches, "No matches found");
    update({ nextLocation: location, nextMatches: matches });

    if (isAction(location)) {
      await post(location, submitRef);
    } else {
      await get(location);
    }
  }

  function getState() {
    return state;
  }

  function dispose() {}

  function getActionDataForRef(ref: ActionRef) {
    return actionDataRefs.get(ref);
  }

  return { send, getState, dispose, getActionDataForRef };
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

async function loadRouteData(
  state: TransitionState,
  pendingLocation: Location,
  matches: ClientMatch[],
  signal: AbortSignal,
  actionErrorResult?: RouteLoaderErrorResult
): Promise<RouteLoaderResult[]> {
  let matchesToLoad = filterMatchesToLoad(
    state,
    pendingLocation,
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
        let value = await match.route.loader({ signal });
        return { match, value };
      } catch (error) {
        return { match, value: error };
      }
    })
  );
}

function filterMatchesToLoad(
  state: TransitionState,
  location: Location,
  matches: ClientMatch[],
  actionErrorResult?: RouteLoaderErrorResult
): ClientMatch[] {
  if (
    // mutation, reload for fresh data
    isAction(location) ||
    isActionRedirect(location) ||
    // clicked the same link, resubmit a GET form, reload
    createHref(location) === createHref(state.location) ||
    // search affects all loaders
    location.search !== state.location.search
  ) {
    return matches.filter(match => match.route.loader);
  }

  return matches.filter((match, index, arr) => {
    if (actionErrorResult && arr.length - 1 === index) {
      return false;
    }

    if (!match.route.loader) {
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
  });
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

async function fetchAction(
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
    let value = await match.route.action({ signal });
    return { match, value };
  } catch (error) {
    return { match, value: error };
  }
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

function isAction(
  // FIXME: how do you make location state optional?
  location: Location<any>
): location is ActionLocation {
  return !!location.state?.isAction;
}

function isActionRedirect(
  location: Location<any>
): location is ActionRedirectLocation {
  return !!location.state?.isActionRedirect;
}
