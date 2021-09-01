import type { Location } from "history";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { ClientRoute } from "./routes";

import { matchClientRoutes } from "./routeMatching";
import invariant from "./invariant";

export interface TransitionManagerState {
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
   * Only used When both navigation and fetch loads are pending, the fetch loads
   * may need to use the next matches to load data.
   */
  nextMatches?: ClientMatch[];

  /**
   * Data from the loaders that user sees in the browser. During a transition
   * this is the "old" data, unless there are multiple pending forms, in which
   * case this may be updated as fresh data loads complete
   */
  loaderData: RouteData;

  /**
   * Holds the action data for the latest NormalPostSubmission
   */
  actionData?: RouteData;

  /**
   * Tracks the latest, non-keyed pending submission
   */
  transition: Transition;

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

  fetchers: Map<string, Fetcher>;
}

export interface TransitionManagerInit {
  routes: ClientRoute[];
  location: Location;
  loaderData: RouteData;
  actionData?: RouteData;
  error?: Error;
  errorBoundaryId?: null | string;
  onChange: (state: TransitionManagerState) => void;
  onRedirect: (to: string, state?: any) => void;
}

export interface Submission {
  action: string;
  method: string;
  formData: FormData;
  encType: string;
  key: string;
}

export interface ActionSubmission extends Submission {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
}

export interface LoaderSubmission extends Submission {
  method: "GET";
}

export type TransitionStates = {
  Idle: {
    state: "idle";
    type: "idle";
    submission: undefined;
    location: undefined;
  };
  SubmittingAction: {
    state: "submitting";
    type: "actionSubmission";
    submission: ActionSubmission;
    location: Location;
  };
  SubmittingLoader: {
    state: "submitting";
    type: "loaderSubmission";
    submission: LoaderSubmission;
    location: Location;
  };
  LoadingLoaderSubmissionRedirect: {
    state: "loading";
    type: "loaderSubmissionRedirect";
    submission: LoaderSubmission;
    location: Location<Redirects["LoaderSubmission"]>;
  };
  LoadingAction: {
    state: "loading";
    type: "actionReload";
    submission: ActionSubmission;
    location: Location;
  };
  LoadingActionRedirect: {
    state: "loading";
    type: "actionRedirect";
    submission: ActionSubmission;
    location: Location<Redirects["Action"]>;
  };
  LoadingFetchActionRedirect: {
    state: "loading";
    type: "fetchActionRedirect";
    submission: undefined;
    location: Location<any>;
  };
  LoadingRedirect: {
    state: "loading";
    type: "normalRedirect";
    submission: undefined;
    location: Location<any>;
  };
  Loading: {
    state: "loading";
    type: "normalLoad";
    location: Location<any>;
    submission: undefined;
  };
};

export type SubmissionTransition =
  | TransitionStates["SubmittingAction"]
  | TransitionStates["LoadingAction"]
  | TransitionStates["LoadingActionRedirect"]
  | TransitionStates["SubmittingLoader"]
  | TransitionStates["LoadingLoaderSubmissionRedirect"];

export type Transition = TransitionStates[keyof TransitionStates];

export type Redirects = {
  Loader: {
    isRedirect: true;
    type: "loader";
  };
  Action: {
    isRedirect: true;
    type: "action";
  };
  LoaderSubmission: {
    isRedirect: true;
    type: "loaderSubmission";
  };
  FetchAction: {
    isRedirect: true;
    type: "fetchAction";
  };
};

// TODO: keep data around on resubmission?
type FetcherStates = {
  Idle: {
    state: "idle";
    type: "init";
    submission: undefined;
    data: undefined;
  };
  SubmittingAction: {
    state: "submitting";
    type: "actionSubmission";
    submission: ActionSubmission;
    data: undefined;
  };
  SubmittingLoader: {
    state: "submitting";
    type: "loaderSubmission";
    submission: LoaderSubmission;
    data: undefined;
  };
  ReloadingAction: {
    state: "loading";
    type: "actionReload";
    submission: ActionSubmission;
    data: any;
  };
  Loading: {
    state: "loading";
    type: "normalLoad";
    submission: undefined;
    data: undefined;
  };
  Done: {
    state: "idle";
    type: "done";
    submission: undefined;
    data: any;
  };
};

export type Fetcher = FetcherStates[keyof FetcherStates];

type ClientMatch = RouteMatch<ClientRoute>;

type DataResult = {
  match: ClientMatch;
  value: TransitionRedirect | Error | any;
};

type DataRedirectResult = {
  match: ClientMatch;
  value: TransitionRedirect;
};

type DataErrorResult = {
  match: ClientMatch;
  value: Error;
};

export type NavigationEvent = {
  type: "navigation";
  location: Location<any>;
  submission?: Submission;
};

export type FetcherEvent = {
  type: "fetcher";
  key: string;
  submission?: Submission;
  href: string;
};

export type DataEvent = NavigationEvent | FetcherEvent;

////////////////////////////////////////////////////////////////////////////////
function isActionSubmission(
  submission: Submission
): submission is ActionSubmission {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(submission.method);
}

function isLoaderSubmission(
  submission: Submission
): submission is LoaderSubmission {
  return submission.method === "GET";
}

function isRedirectLocation(
  location: Location<any>
): location is Location<Redirects[keyof Redirects]> {
  return Boolean(location.state) && location.state.isRedirect;
}

function isLoaderRedirectLocation(
  location: Location<any>
): location is Location<Redirects["Loader"]> {
  return isRedirectLocation(location) && location.state.type === "loader";
}

function isActionRedirectLocation(
  location: Location<any>
): location is Location<Redirects["Action"]> {
  return isRedirectLocation(location) && location.state.type === "action";
}

function isFetchActionRedirect(
  location: Location<any>
): location is Location<Redirects["FetchAction"]> {
  return isRedirectLocation(location) && location.state.type === "fetchAction";
}

function isLoaderSubmissionRedirectLocation(
  location: Location<any>
): location is Location<Redirects["LoaderSubmission"]> {
  return (
    isRedirectLocation(location) && location.state.type === "loaderSubmission"
  );
}

export class TransitionRedirect {
  location: string;
  constructor(location: Location | string) {
    this.location =
      typeof location === "string"
        ? location
        : location.pathname + location.search;
  }
}

export const IDLE_TRANSITION: TransitionStates["Idle"] = {
  state: "idle",
  submission: undefined,
  location: undefined,
  type: "idle"
};

export const IDLE_FETCHER: FetcherStates["Idle"] = {
  state: "idle",
  type: "init",
  data: undefined,
  submission: undefined
};

export function createTransitionManager(init: TransitionManagerInit) {
  let { routes } = init;

  let pendingNavigationController: AbortController | undefined;
  let fetchControllers = new Map<string, AbortController>();
  let incrementingLoadId = 0;
  let navigationLoadId = -1;
  let fetchReloadIds = new Map<string, number>();

  let matches = matchClientRoutes(routes, init.location);
  invariant(matches, "No initial route matches!");

  let state: TransitionManagerState = {
    location: init.location,
    loaderData: init.loaderData || {},
    actionData: init.actionData,
    error: init.error,
    errorBoundaryId: init.errorBoundaryId || null,
    matches,
    nextMatches: undefined,
    transition: IDLE_TRANSITION,
    fetchers: new Map()
  };

  function update(updates: Partial<TransitionManagerState>) {
    state = Object.assign({}, state, updates);
    init.onChange(state);
  }

  function getState(): TransitionManagerState {
    return state;
  }

  function getFetcher(key: string): Fetcher {
    return state.fetchers.get(key) || IDLE_FETCHER;
  }

  function deleteFetcher(key: string): void {
    if (fetchControllers.has(key)) abortFetcher(key);
    fetchReloadIds.delete(key);
    state.fetchers.delete(key);
  }

  async function send(event: DataEvent): Promise<void> {
    switch (event.type) {
      case "navigation": {
        let { location, submission } = event;
        if (isHashChangeOnly(location)) return;

        let matches = matchClientRoutes(routes, location);
        invariant(matches, "No matches found");

        // <Form method="post | put | delete | patch">
        if (submission && isActionSubmission(submission)) {
          await handleActionSubmissionNavigation(location, submission, matches);
        }
        // <Form method="get"/>
        else if (submission && isLoaderSubmission(submission)) {
          await handleLoaderSubmissionNavigation(location, submission, matches);
        }
        // action=>redirect
        else if (isActionRedirectLocation(location)) {
          await handleActionRedirect(location, matches);
        }
        // <Form method="get"> --> loader=>redirect
        else if (isLoaderSubmissionRedirectLocation(location)) {
          await handleLoaderSubmissionRedirect(location, matches);
        }
        // loader=>redirect
        else if (isLoaderRedirectLocation(location)) {
          await handleLoaderRedirect(location, matches);
        }
        // useSubmission()=>redirect
        else if (isFetchActionRedirect(location)) {
          await handleFetchActionRedirect(location, matches);
        }
        // <Link>, navigate()
        else {
          await handleLoad(location, matches);
        }

        navigationLoadId = -1;
        break;
      }

      case "fetcher": {
        let { key, submission, href } = event;

        let matches = matchClientRoutes(routes, href);
        invariant(matches, "No matches found");
        let match = matches.slice(-1)[0];

        if (fetchControllers.has(key)) abortFetcher(key);

        if (submission && isActionSubmission(submission)) {
          await handleActionFetchSubmission(href, key, submission, match);
        } else if (submission && isLoaderSubmission(submission)) {
          await handleLoaderFetchSubmission(href, key, submission, match);
        } else {
          await handleLoaderFetch(href, key, match);
        }

        break;
      }

      default: {
        // @ts-ignore
        throw new Error(`Unknown data event type: ${event.type}`);
      }
    }
  }

  function dispose() {
    abortNormalNavigation();
    for (let [, controller] of fetchControllers) {
      controller.abort();
    }
  }

  async function handleActionFetchSubmission(
    href: string,
    key: string,
    submission: ActionSubmission,
    match: ClientMatch
  ) {
    let fetcher: FetcherStates["SubmittingAction"] = {
      state: "submitting",
      type: "actionSubmission",
      submission,
      data: undefined
    };
    state.fetchers.set(key, fetcher);

    update({ fetchers: new Map(state.fetchers) });

    let controller = new AbortController();
    fetchControllers.set(key, controller);

    let result = await callAction(submission, match, controller.signal);
    if (controller.signal.aborted) {
      return;
    }

    if (isRedirectResult(result)) {
      let locationState: Redirects["FetchAction"] = {
        isRedirect: true,
        type: "fetchAction"
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }

    if (maybeBailOnError(match, key, result)) {
      return;
    }

    let loadFetcher: FetcherStates["ReloadingAction"] = {
      state: "loading",
      type: "actionReload",
      data: result.value,
      submission
    };
    state.fetchers.set(key, loadFetcher);

    update({ fetchers: new Map(state.fetchers) });

    let maybeActionErrorResult = isErrorResult(result) ? result : undefined;

    let loadId = ++incrementingLoadId;
    fetchReloadIds.set(key, loadId);

    let matchesToLoad = state.matches;
    let hrefToLoad = href;
    if (state.transition.state !== "idle") {
      invariant(state.nextMatches);
      matchesToLoad = state.nextMatches;
      hrefToLoad = createHref(state.transition.location);
    }

    let results = await callLoaders(
      state,
      createUrl(hrefToLoad),
      matchesToLoad,
      controller.signal,
      maybeActionErrorResult,
      submission,
      loadFetcher
    );

    if (controller.signal.aborted) {
      return;
    }

    fetchReloadIds.delete(key);
    fetchControllers.delete(key);

    let redirect = findRedirect(results);
    if (redirect) {
      let locationState: Redirects["Loader"] = {
        isRedirect: true,
        type: "loader"
      };
      init.onRedirect(redirect.location, locationState);
      return;
    }

    let [error, errorBoundaryId] = findErrorAndBoundaryId(
      results,
      state.matches,
      maybeActionErrorResult
    );

    let doneFetcher: FetcherStates["Done"] = {
      state: "idle",
      type: "done",
      data: result.value,
      submission: undefined
    };
    state.fetchers.set(key, doneFetcher);

    let abortedKeys = abortStaleFetchLoads(loadId);
    if (abortedKeys) {
      markFetchersDone(abortedKeys);
    }

    let yeetedNavigation = yeetStaleNavigationLoad(loadId);

    // need to do what we would have done when the navigation load completed
    if (yeetedNavigation) {
      let { transition } = state;
      invariant(transition.state === "loading", "Expected loading transition");

      update({
        location: transition.location,
        matches: state.nextMatches,
        error,
        errorBoundaryId,
        loaderData: makeLoaderData(state, results, matchesToLoad),
        actionData:
          transition.type === "actionReload" ? state.actionData : undefined,
        transition: IDLE_TRANSITION,
        fetchers: new Map(state.fetchers)
      });
    }

    // otherwise just update the info for the data
    else {
      update({
        fetchers: new Map(state.fetchers),
        error,
        errorBoundaryId,
        loaderData: makeLoaderData(state, results, matchesToLoad)
      });
    }
  }

  function yeetStaleNavigationLoad(landedId: number): boolean {
    let isLoadingNavigation = state.transition.state === "loading";
    if (isLoadingNavigation && navigationLoadId < landedId) {
      abortNormalNavigation();
      return true;
    }
    return false;
  }

  function markFetchersDone(keys: string[]) {
    for (let key of keys) {
      let fetcher = getFetcher(key);
      let doneFetcher: FetcherStates["Done"] = {
        state: "idle",
        type: "done",
        data: fetcher.data,
        submission: undefined
      };
      state.fetchers.set(key, doneFetcher);
    }
  }

  function abortStaleFetchLoads(landedId: number): false | string[] {
    let yeetedKeys = [];
    for (let [key, id] of fetchReloadIds) {
      if (id < landedId) {
        let fetcher = state.fetchers.get(key);
        invariant(fetcher, `Expected fetcher: ${key}`);
        if (fetcher.state === "loading") {
          abortFetcher(key);
          fetchReloadIds.delete(key);
          yeetedKeys.push(key);
        }
      }
    }
    return yeetedKeys.length ? yeetedKeys : false;
  }

  async function handleLoaderFetchSubmission(
    href: string,
    key: string,
    submission: LoaderSubmission,
    match: ClientMatch
  ) {
    let fetcher: FetcherStates["SubmittingLoader"] = {
      state: "submitting",
      type: "loaderSubmission",
      submission,
      data: undefined
    };
    state.fetchers.set(key, fetcher);
    update({ fetchers: new Map(state.fetchers) });

    let controller = new AbortController();
    fetchControllers.set(key, controller);
    let result = await callLoader(match, createUrl(href), controller.signal);
    fetchControllers.delete(key);

    if (controller.signal.aborted) {
      return;
    }

    if (isRedirectResult(result)) {
      let locationState: Redirects["Loader"] = {
        isRedirect: true,
        type: "loader"
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }

    if (maybeBailOnError(match, key, result)) {
      return;
    }

    let doneFetcher: FetcherStates["Done"] = {
      state: "idle",
      type: "done",
      data: result.value,
      submission: undefined
    };
    state.fetchers.set(key, doneFetcher);

    update({ fetchers: new Map(state.fetchers) });
  }

  async function handleLoaderFetch(
    href: string,
    key: string,
    match: ClientMatch
  ) {
    let fetcher: FetcherStates["Loading"] = {
      state: "loading",
      type: "normalLoad",
      submission: undefined,
      data: undefined
    };

    state.fetchers.set(key, fetcher);
    update({ fetchers: new Map(state.fetchers) });

    let controller = new AbortController();
    fetchControllers.set(key, controller);
    let result = await callLoader(match, createUrl(href), controller.signal);
    fetchControllers.delete(key);

    if (controller.signal.aborted) return;

    if (isRedirectResult(result)) {
      let locationState: Redirects["Loader"] = {
        isRedirect: true,
        type: "loader"
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }

    if (maybeBailOnError(match, key, result)) {
      return;
    }

    let doneFetcher: FetcherStates["Done"] = {
      state: "idle",
      type: "done",
      data: result.value,
      submission: undefined
    };
    state.fetchers.set(key, doneFetcher);

    update({ fetchers: new Map(state.fetchers) });
  }

  function maybeBailOnError(
    match: ClientMatch,
    key: string,
    result: DataResult
  ) {
    if (isErrorResult(result)) {
      let errorBoundaryId = findNearestBoundary(match, state.matches);
      state.fetchers.delete(key);
      update({
        fetchers: new Map(state.fetchers),
        error: result.value,
        errorBoundaryId
      });
      return true;
    }
    return false;
  }

  async function handleActionSubmissionNavigation(
    location: Location,
    submission: ActionSubmission,
    matches: ClientMatch[]
  ) {
    abortNormalNavigation();

    let transition: TransitionStates["SubmittingAction"] = {
      state: "submitting",
      type: "actionSubmission",
      submission,
      location
    };

    update({ transition, nextMatches: matches });

    let controller = new AbortController();
    pendingNavigationController = controller;

    let leafMatch = matches.slice(-1)[0];
    let result = await callAction(submission, leafMatch, controller.signal);

    if (controller.signal.aborted) {
      return;
    }

    if (isRedirectResult(result)) {
      let locationState: Redirects["Action"] = {
        isRedirect: true,
        type: "action"
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }

    let loadTransition: TransitionStates["LoadingAction"] = {
      state: "loading",
      type: "actionReload",
      submission,
      location
    };

    update({
      transition: loadTransition,
      actionData: { [leafMatch.route.id]: result.value }
    });

    await loadPageData(location, matches, submission, result);
  }

  async function handleLoaderSubmissionNavigation(
    location: Location,
    submission: LoaderSubmission,
    matches: ClientMatch[]
  ) {
    abortNormalNavigation();
    let transition: TransitionStates["SubmittingLoader"] = {
      state: "submitting",
      type: "loaderSubmission",
      submission,
      location
    };
    update({ transition, nextMatches: matches });
    await loadPageData(location, matches, submission);
  }

  async function handleLoad(location: Location, matches: ClientMatch[]) {
    abortNormalNavigation();
    let transition: TransitionStates["Loading"] = {
      state: "loading",
      type: "normalLoad",
      submission: undefined,
      location
    };
    update({ transition, nextMatches: matches });
    await loadPageData(location, matches);
  }

  async function handleLoaderRedirect(
    location: Location<Redirects["Loader"]>,
    matches: ClientMatch[]
  ) {
    abortNormalNavigation();
    let transition: TransitionStates["LoadingRedirect"] = {
      state: "loading",
      type: "normalRedirect",
      submission: undefined,
      location
    };
    update({ transition, nextMatches: matches });
    await loadPageData(location, matches);
  }

  async function handleLoaderSubmissionRedirect(
    location: Location<Redirects["LoaderSubmission"]>,
    matches: ClientMatch[]
  ) {
    abortNormalNavigation();
    invariant(
      state.transition.type === "loaderSubmission",
      `Unexpected transition: ${state.transition}`
    );
    let { submission } = state.transition;
    let transition: TransitionStates["LoadingLoaderSubmissionRedirect"] = {
      state: "loading",
      type: "loaderSubmissionRedirect",
      submission,
      location: location
    };
    update({ transition, nextMatches: matches });
    await loadPageData(location, matches, submission);
  }

  async function handleFetchActionRedirect(
    location: Location<Redirects["FetchAction"]>,
    matches: ClientMatch[]
  ) {
    abortNormalNavigation();
    let transition: TransitionStates["LoadingFetchActionRedirect"] = {
      state: "loading",
      type: "fetchActionRedirect",
      submission: undefined,
      location
    };
    update({ transition, nextMatches: matches });
    await loadPageData(location, matches);
  }

  async function handleActionRedirect(
    location: Location<Redirects["Action"]>,
    matches: ClientMatch[]
  ) {
    abortNormalNavigation();
    invariant(
      state.transition.type === "actionSubmission",
      `Unexpected transition: ${state.transition}`
    );
    let { submission } = state.transition;
    let transition: TransitionStates["LoadingActionRedirect"] = {
      state: "loading",
      type: "actionRedirect",
      submission,
      location
    };
    update({ transition, nextMatches: matches });
    await loadPageData(location, matches, submission);
  }

  function isHashChangeOnly(location: Location) {
    return (
      createHref(state.location) === createHref(location) &&
      state.location.hash !== location.hash
    );
  }

  async function loadPageData(
    location: Location,
    matches: ClientMatch[],
    submission?: Submission,
    actionResult?: DataResult
  ) {
    let maybeActionErrorResult =
      actionResult && isErrorResult(actionResult) ? actionResult : undefined;

    let controller = new AbortController();
    pendingNavigationController = controller;
    navigationLoadId = ++incrementingLoadId;

    let results = await callLoaders(
      state,
      createUrl(createHref(location)),
      matches,
      controller.signal,
      maybeActionErrorResult,
      submission
    );

    if (controller.signal.aborted) {
      return;
    }

    let redirect = findRedirect(results);
    if (redirect) {
      if (state.transition.type === "loaderSubmission") {
        let locationState: Redirects["LoaderSubmission"] = {
          isRedirect: true,
          type: "loaderSubmission"
        };
        init.onRedirect(redirect.location, locationState);
      } else {
        let locationState: Redirects["Loader"] = {
          isRedirect: true,
          type: "loader"
        };
        init.onRedirect(redirect.location, locationState);
      }
      return;
    }

    let [error, errorBoundaryId] = findErrorAndBoundaryId(
      results,
      matches,
      maybeActionErrorResult
    );

    let abortedIds = abortStaleFetchLoads(navigationLoadId);
    if (abortedIds) {
      markFetchersDone(abortedIds);
    }

    update({
      location,
      matches,
      error,
      errorBoundaryId,
      loaderData: makeLoaderData(state, results, matches),
      actionData:
        state.transition.type === "actionReload" ? state.actionData : undefined,
      transition: IDLE_TRANSITION,
      fetchers: abortedIds ? new Map(state.fetchers) : state.fetchers
    });
  }

  function abortNormalNavigation() {
    pendingNavigationController?.abort();
  }

  function abortFetcher(key: string) {
    let controller = fetchControllers.get(key);
    invariant(controller, `Expected fetch controller: ${key}`);
    controller.abort();
    fetchControllers.delete(key);
  }

  return {
    send,
    getState,
    getFetcher,
    deleteFetcher,
    dispose,
    get _internalFetchControllers() {
      return fetchControllers;
    }
  };
}

////////////////////////////////////////////////////////////////////////////////
async function callLoaders(
  state: TransitionManagerState,
  url: URL,
  matches: ClientMatch[],
  signal: AbortSignal,
  actionErrorResult?: DataErrorResult,
  submission?: Submission,
  fetcher?: Fetcher
): Promise<DataResult[]> {
  let matchesToLoad = filterMatchesToLoad(
    state,
    url,
    matches,
    actionErrorResult,
    submission,
    fetcher
  );

  return Promise.all(
    matchesToLoad.map(match => callLoader(match, url, signal))
  );
}

async function callLoader(match: ClientMatch, url: URL, signal: AbortSignal) {
  invariant(match.route.loader, `Expected loader for ${match.route.id}`);
  try {
    let { params } = match;
    let value = await match.route.loader({ params, url, signal });
    return { match, value };
  } catch (error) {
    return { match, value: error };
  }
}

async function callAction(
  submission: ActionSubmission,
  match: ClientMatch,
  signal: AbortSignal
): Promise<DataResult> {
  if (!match.route.action) {
    throw new Error(
      `Route "${match.route.id}" does not have an action, but you are trying ` +
        `to submit to it. To fix this, please add an \`action\` function to the route`
    );
  }

  try {
    let value = await match.route.action({
      url: createUrl(submission.action),
      params: match.params,
      submission,
      signal
    });
    return { match, value };
  } catch (error) {
    return { match, value: error };
  }
}

function filterMatchesToLoad(
  state: TransitionManagerState,
  url: URL,
  matches: ClientMatch[],
  actionErrorResult?: DataErrorResult,
  submission?: Submission,
  fetcher?: Fetcher
): ClientMatch[] {
  let isNew = (match: ClientMatch, index: number) => {
    if (!state.matches[index]) return true;
    return match.route.id !== state.matches[index].route.id;
  };

  let pathChanged = (match: ClientMatch, index: number) => {
    return (
      state.matches[index].pathname !== match.pathname ||
      state.matches[index].params["*"] !== match.params["*"]
    );
  };

  let filterByRouteProps = (match: ClientMatch, index: number) => {
    if (!match.route.loader) {
      return false;
    }

    if (isNew(match, index) || pathChanged(match, index)) {
      return true;
    }

    if (match.route.shouldReload) {
      let prevUrl = createUrl(createHref(state.location));
      return match.route.shouldReload({
        prevUrl,
        url,
        submission,
        params: match.params
      });
    }

    return true;
  };

  if (fetcher?.type === "actionReload") {
    return matches.filter(filterByRouteProps);
  } else if (
    // mutation, reload for fresh data
    state.transition.type === "actionReload" ||
    state.transition.type === "actionRedirect" ||
    // clicked the same link, resubmitted a GET form
    createHref(url) === createHref(state.location) ||
    // search affects all loaders
    url.searchParams.toString() !== state.location.search
  ) {
    return matches.filter(filterByRouteProps);
  }

  return matches
    .filter((match, index, arr) => {
      // don't load errored action route
      if (actionErrorResult && arr.length - 1 === index) {
        return false;
      }

      let doIt = isNew(match, index) || pathChanged(match, index);
      return doIt;
    })
    .filter(filterByRouteProps);
}

function isRedirectResult(result: DataResult): result is DataRedirectResult {
  return result.value instanceof TransitionRedirect;
}

function createHref(location: Location | URL) {
  return location.pathname + location.search;
}

function findRedirect(results: DataResult[]): TransitionRedirect | null {
  for (let result of results) {
    if (isRedirectResult(result)) {
      return result.value;
    }
  }
  return null;
}

function findErrorAndBoundaryId(
  results: DataResult[],
  matches: ClientMatch[],
  actionErrorResult?: DataErrorResult
): [Error, string | null] | [undefined, undefined] {
  let loaderErrorResult;

  for (let result of results) {
    if (isErrorResult(result)) {
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

function makeLoaderData(
  state: TransitionManagerState,
  results: DataResult[],
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

function isErrorResult(result: DataResult) {
  return result.value instanceof Error;
}

function createUrl(href: string) {
  return new URL(href, window.location.origin);
}
