import type { Location } from "history";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { ClientRoute } from "./routes";

import { matchClientRoutes } from "./routeMatching";
import invariant from "./invariant";

type ClientMatch = RouteMatch<ClientRoute>;
type LoadResult = Response | Error;

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
   * This persists all the action data that is assigned to a Form or useSubmit ref.
   */
  refActionData: Map<ActionRef, RouteData>;

  /**
   * The next matches that are being fetched.
   */
  nextMatches?: ClientMatch[];

  /**
   * Tracks all the pending form submissions by Form and useSubmit refs.
   * TODO: there is no code that deals with this at all!
   */
  pendingSubmissions?: Map<ActionRef, URLSearchParams>;

  /**
   * The next location being loaded.
   */
  nextLocation?: null | Location;

  /**
   * Persists uncaught loader/action errors. TODO: should probably be an array
   * and keep track of them all and pass the array to ErrorBoundary.
   */
  error?: Error;

  /**
   * The id of the nested ErrorBoundary in which to render the error.
   */
  errorBoundaryId?: null | number;
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
type ActionLocation = Location<{ id: number; isAction: true }>;
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
 * - Items on state need to change identity when they are updated so that
 *   React.useEffect will work with them.
 */

export function createTransitionManager(init: TransitionManagerInit) {
  let { routes } = init;

  // We know which loads to commit and which to ignore by incrementing this ID.
  let currentLoadId = 0;
  let pendingLoads = new Map<number, Location>();

  // When loads become stale, we can actually abort them instead of just ignoring
  let abortControllers = new Map<number, AbortController>();

  // So we can track if the same form has been submit again while already pending.
  let submitRefs = new WeakMap();

  let matches = matchClientRoutes(routes, init.location);
  invariant(matches, "No initial route matches!");

  let state: TransitionState = {
    location: init.location,
    loaderData: init.loaderData,
    actionData: init.actionData,
    matches,
    refActionData: new Map(),
    pendingSubmissions: new Map(),
    nextMatches: undefined,
    nextLocation: undefined,
    error: undefined,
    errorBoundaryId: undefined
  };

  function update(updates: Partial<TransitionState>) {
    state = Object.assign({}, state, updates);
    init.onChange(state);
  }

  async function get(location: Location, actionError?: Error) {
    let matches = state.nextMatches;
    invariant(matches, "No matches on state");

    let id = ++currentLoadId;
    let controller = new AbortController();

    pendingLoads.set(id, location);
    abortControllers.set(id, controller);

    let isStale = () => !pendingLoads.has(id);

    let results = await loadRouteData(state, location, matches, actionError);

    if (isStale()) {
      return;
    }

    let redirect = findRedirect(results);
    if (redirect) {
      return handleRedirect(redirect);
    }

    let [error, errorBoundaryId] = findError(results, matches);

    let url = location.pathname + location.search;
    let isNextLocation = location === state.nextLocation;
    let latestUrl = state.location.pathname + state.location.search;
    let onSamePage = url === latestUrl;
    let showError = error && location === state.nextLocation;

    if (showError) {
      clearAllPendingLoads();
    } else {
      clearStalePendingLoads(id, url);
    }

    if (isNextLocation || (onSamePage && isActionRedirect(location))) {
      update({
        loaderData: makeLoaderData(results, matches),
        location: location === state.nextLocation ? location : state.location,
        error,
        errorBoundaryId
      });
    }
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
      loaderData[route.id] = newData[route.id] || state.loaderData[route.id];
    }

    return loaderData;
  }

  async function post(location: ActionLocation, ref?: ActionRef) {
    let isStale = () => {
      if (ref) {
        let refResubmitted = submitRefs.get(ref) !== location.state.id;
        return refResubmitted;
      }
      return location !== state.nextLocation;
    };

    let matches = state.nextMatches;
    invariant(matches, "No matches on state.");

    if (ref) {
      submitRefs.set(ref, location.state.id);
    }

    let leafMatch = matches.slice(-1)[0];
    let result = await fetchAction(location, leafMatch);

    if (isStale()) {
      return;
    }

    if (isRedirectResult(result)) {
      return handleRedirect(result.value);
    }

    let [actionData, error] = await extractActionData(result, matches);
    if (isStale()) return;

    if (error) {
      await get(location, error);
      return;
    }

    if (ref) {
      let refActionData = new Map(state.refActionData);
      refActionData.set(ref, actionData);
      update({ actionData, refActionData });
    } else {
      update({ actionData });
    }

    await get(location);
  }

  function clearPendingLoad(id: number) {
    let controller = abortControllers.get(id);
    invariant(controller, `No abortController for ${id}`);
    controller.abort();
    abortControllers.delete(id);
    pendingLoads.delete(id);
  }

  // When multiple loads are in flight and a load with a higher ID lands, we
  // know we can abort any loads with a lower ID because their data is going to
  // be stale anyway. We don't clear out any loads at different URLs though, we
  // might end up back at that URL by the time it lands and would like to
  // capture the new values it has
  function clearStalePendingLoads(latestId: number, landedUrl: string) {
    for (let [id, location] of pendingLoads) {
      let url = location.pathname + location.search;
      let isStale = url === landedUrl && id <= latestId;
      if (isStale) {
        clearPendingLoad(id);
      }
    }
  }

  // When the latest location throws an exception, we abort everything because
  // we're going to the error boundary.
  function clearAllPendingLoads() {
    for (let [id] of pendingLoads) {
      clearPendingLoad(id);
    }
  }

  function handleRedirect(redirect: TransitionRedirect) {
    init.onRedirect(redirect.location);
  }

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

  return { send, getState, dispose };
}

export type RouteLoaderResult = {
  match: ClientMatch;
  value: TransitionRedirect | Error | any;
};

export type RouteLoaderRedirectResult = {
  match: ClientMatch;
  value: TransitionRedirect;
};

async function loadRouteData(
  state: TransitionState,
  pendingLocation: Location,
  matches: ClientMatch[],
  actionError?: Error
): Promise<RouteLoaderResult[]> {
  let matchesToLoad = filterMatchesToLoad(
    state,
    pendingLocation,
    matches,
    actionError
  );
  return Promise.all(
    matchesToLoad.map(async match => {
      invariant(
        match.route.loader,
        `Expected ${match.route.id} to have a loader`
      );
      let value = await match.route.loader();
      return { match, value };
    })
  );
}

function filterMatchesToLoad(
  state: TransitionState,
  location: Location,
  matches: ClientMatch[],
  actionError?: Error
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
    return matches;
  }

  return matches.filter((match, index, arr) => {
    if (
      !match.route.loader ||
      // don't load action route w/ error
      (actionError && arr.length - 1 === index)
    ) {
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
  match: ClientMatch
): Promise<any> {
  if (!match.route.action) {
    console.warn(
      `Route "${match.route.id}" does not have an action, but you are trying ` +
        `to submit to it. To fix this, please add an \`action\` function to the route`
    );
    return new TransitionRedirect(location);
  }

  return match.route.action();
}

function findError(results: any[], matches: ClientMatch[]): [Error?, number?] {
  // TODO:
  return [undefined, undefined];
}

async function extractActionData(
  result: LoadResult,
  matches: ClientMatch[]
): Promise<[RouteData, Error?]> {
  // TODO:
  return [{}];
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
