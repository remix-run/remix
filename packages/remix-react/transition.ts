import type { Location } from "history";
import type { RouteData } from "./routeData";
import type { AppData } from "./data";
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
   * Data from the loaders that user sees in the browser. During a transition
   * this is the "old" data, unless there are multiple pending forms, in which
   * case this may be updated as fresh data loads complete
   */
  loaderData: RouteData;

  /**
   * Holds the action data for the latest NormalPostSubmission
   */
  actionData: AppData;

  /**
   * Holds the action data for current KeyedPostSubmission
   */
  keyedActionData: { [key: string]: AppData };

  /**
   * The next matches that are being loaded.
   */
  nextMatches?: ClientMatch[];

  /**
   * Tracks current KeyedPostSubmission and KeyedGetSubmission
   */
  transitions: Map<string, SubmissionTransition>;

  /**
   * Tracks the latest, non-keyed pending submission
   */
  transition: Transition;

  /**
   * The next location being loaded.
   * TODO: might not need this now that we are always storing a Transition
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

export interface TransitionManagerInit {
  routes: ClientRoute[];
  location: Location;
  loaderData: RouteData;
  actionData?: RouteData;
  keyedActionData?: RouteData;
  error?: Error;
  errorBoundaryId?: null | string;
  onChange: (state: TransitionManagerState) => void;
  onRedirect: (location: Location<any>, referrer: Location<any>) => void;
}

export type TransitionStates = {
  Idle: {
    state: "idle";
    type: "idle";
    formData: undefined;
    method: undefined;
    nextLocation: undefined;
  };
  Submitting: {
    state: "submitting";
    type: "submission";
    formData: FormData;
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    nextLocation: Location<GenericPostSubmission>;
  };
  LoadingGetSubmission: {
    state: "loading";
    type: "getSubmission";
    formData: FormData;
    method: "GET";
    nextLocation: Location<GenericGetSubmission>;
  };
  LoadingGetSubmissionRedirect: {
    state: "loading";
    type: "getSubmissionRedirect";
    formData: FormData;
    method: "GET";
    nextLocation: Location<NormalGetSubmissionRedirect>;
  };
  LoadingAction: {
    state: "loading";
    type: "actionReload";
    formData: FormData;
    method: GenericPostSubmission["method"];
    nextLocation: Location<GenericPostSubmission>;
  };
  LoadingActionRedirect: {
    state: "loading";
    type: "actionRedirect";
    formData: FormData;
    method: GenericPostSubmission["method"];
    nextLocation: Location<KeyedActionRedirect | NormalActionRedirect>;
  };
  LoadingRedirect: {
    state: "loading";
    type: "redirect";
    nextLocation: Location<any>;
    formData: undefined;
    method: "GET";
  };
  Loading: {
    state: "loading";
    type: "load";
    nextLocation: Location<any>;
    formData: undefined;
    method: "GET";
  };
};

export type SubmissionTransition =
  | TransitionStates["Submitting"]
  | TransitionStates["LoadingAction"]
  | TransitionStates["LoadingActionRedirect"]
  | TransitionStates["LoadingGetSubmission"]
  | TransitionStates["LoadingGetSubmissionRedirect"];

export type Transition = TransitionStates[keyof TransitionStates];

export interface GenericSubmission {
  isSubmission: true;
  action: string;
  method: string;
  body: string;
  encType: string;
  submissionKey?: string;
}

export interface GenericPostSubmission extends GenericSubmission {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
}

export interface NormalPostSubmission
  extends Omit<GenericPostSubmission, "submissionKey"> {}

export interface KeyedPostSubmission extends GenericPostSubmission {
  submissionKey: string;
}

export interface GenericGetSubmission extends GenericSubmission {
  method: "GET";
}

export interface KeyedGetSubmission extends GenericGetSubmission {
  submissionKey: string;
}

export interface NormalGetSubmission
  extends Omit<GenericGetSubmission, "submissionKey"> {}

interface NormalActionRedirect
  extends Omit<NormalPostSubmission, "isSubmission"> {
  isActionRedirect: true;
}

interface KeyedActionRedirect
  extends Omit<KeyedPostSubmission, "isSubmission"> {
  isKeyedActionRedirect: true;
}

interface NormalRedirect {
  isRedirect: true;
}

interface NormalGetSubmissionRedirect
  extends Omit<GenericGetSubmission, "isSubmission"> {
  isRedirect: true;
}

interface KeyedGetSubmissionRedirect extends NormalGetSubmissionRedirect {
  submissionKey: string;
}

type ClientMatch = RouteMatch<ClientRoute>;

type RouteLoaderResult = {
  match: ClientMatch;
  value: TransitionRedirect | Error | any;
};

type RouteLoaderRedirectResult = {
  match: ClientMatch;
  value: TransitionRedirect;
};

type RouteLoaderErrorResult = {
  match: ClientMatch;
  value: Error;
};

////////////////////////////////////////////////////////////////////////////////
export function isSubmission(
  location: Location<any>
): location is Location<GenericSubmission> {
  return Boolean(location.state?.isSubmission);
}

export function isPostSubmission(
  location: Location<any>
): location is Location<GenericPostSubmission> {
  return (
    isSubmission(location) &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(location.state.method)
  );
}

export function isNormalPostSubmission(
  location: Location<any>
): location is Location<NormalPostSubmission> {
  return isPostSubmission(location) && !Boolean(location.state.submissionKey);
}

export function isKeyedPostSubmission(
  location: Location<any>
): location is Location<KeyedPostSubmission> {
  return isPostSubmission(location) && Boolean(location.state.submissionKey);
}

export function isGetSubmission(
  location: Location<any>
): location is Location<GenericGetSubmission> {
  return isSubmission(location) && location.state.method === "GET";
}

export function isKeyedGetSubmission(
  location: Location<any>
): location is Location<KeyedGetSubmission> {
  return isGetSubmission(location) && Boolean(location.state.submissionKey);
}

export function isNormalGetSubmission(
  location: Location<any>
): location is Location<NormalGetSubmission> {
  return isGetSubmission(location) && !Boolean(location.state.submissionKey);
}

export function isActionRedirect(
  location: Location<any>
): location is Location<NormalActionRedirect> {
  return isNormalActionRedirect(location) || isKeyedActionRedirect(location);
}

export function isNormalActionRedirect(
  location: Location<any>
): location is Location<NormalActionRedirect> {
  return Boolean(location.state?.isActionRedirect);
}

export function isKeyedActionRedirect(
  location: Location<any>
): location is Location<KeyedActionRedirect> {
  return Boolean(location.state?.isKeyedActionRedirect);
}

export function isNormalRedirect(
  location: Location<any>
): location is Location<NormalRedirect> {
  return (
    Boolean(location.state?.isRedirect) &&
    !Boolean(location.state?.submissionKey)
  );
}

export function isGetSubmissionRedirect(
  location: Location<any>
): location is Location<
  KeyedGetSubmissionRedirect | NormalGetSubmissionRedirect
> {
  return location.state?.isRedirect && location.state?.method === "GET";
}

export function isNormalGetSubmissionRedirect(
  location: Location<any>
): location is Location<NormalGetSubmissionRedirect> {
  return (
    isGetSubmissionRedirect(location) && !Boolean(location.state.submissionKey)
  );
}

export function isKeyedGetSubmissionRedirect(
  location: Location<any>
): location is Location<KeyedGetSubmissionRedirect> {
  return (
    isGetSubmissionRedirect(location) && Boolean(location.state.submissionKey)
  );
}

export let idleTransition: TransitionStates["Idle"] = {
  state: "idle",
  formData: undefined,
  method: undefined,
  nextLocation: undefined,
  type: "idle"
};

////////////////////////////////////////////////////////////////////////////////
export function createTransitionManager(init: TransitionManagerInit) {
  let { routes } = init;

  //// INTERNAL STATE

  // Used for non-keyed navigations, get/submissions/post, doesn't matter, it's
  // all one at a time anyway
  let pendingNavigationController: AbortController | undefined;

  // We know which loads to commit and which to ignore by incrementing this ID.
  let currentLoadId = 0;

  let transitions = new Map<string, SubmissionTransition>();
  let actionControllers = new Map<string, AbortController>();

  let pendingLoads = new Map<
    number,
    Location<
      | KeyedPostSubmission
      | KeyedGetSubmission
      | KeyedActionRedirect
      | KeyedGetSubmissionRedirect
    >
  >();
  let loadControllers = new Map<number, AbortController>();

  // count submission key data reads in the view to clean up when back to 0
  let dataKeyCounts: { [submissionKey: string]: number } = {};

  let interruptedSubmission = false;

  let matches = matchClientRoutes(routes, init.location);
  invariant(matches, "No initial route matches!");

  let state: TransitionManagerState = {
    location: init.location,
    loaderData: init.loaderData || {},
    actionData: init.actionData,
    keyedActionData: init.keyedActionData || {},
    error: init.error,
    errorBoundaryId: init.errorBoundaryId || null,
    matches,
    transitions: new Map(),
    transition: idleTransition,
    nextMatches: undefined,
    nextLocation: undefined
  };

  function update(updates: Partial<TransitionManagerState>) {
    state = Object.assign({}, state, updates);
    init.onChange(state);
  }

  function getState() {
    return state;
  }

  //// PUBLIC INTERFACE

  async function send(location: Location<any>) {
    let matches = matchClientRoutes(routes, location);
    invariant(matches, "No matches found");

    if (isHashChangeOnly(location)) {
      return;
    }

    // <Form id> -> useTransition(id), useActionData(id)
    if (isKeyedPostSubmission(location)) {
      await handleKeyedPostSubmission(location, matches);
    }

    // <Form id> action redirected -> useTransition(id)
    else if (isKeyedActionRedirect(location)) {
      await handleKeyedActionRedirect(location, matches);
    }

    // <Form id method="get"/> -> useTransition(id)
    else if (isKeyedGetSubmission(location)) {
      await handleKeyedGetSubmission(location, matches);
    }

    // <Form method="get" submissionKey /> loader redirected
    else if (isKeyedGetSubmissionRedirect(location)) {
      await handleKeyedGetSubmissionRedirect(location, matches);
    }

    // <Form>, submit() -> useTransition(), useActionData()
    else if (isNormalPostSubmission(location)) {
      await handleNormalPostSubmission(location, matches);
    }

    // <Form>, submit() action redirected -> useTransition()
    else if (isNormalActionRedirect(location)) {
      await handleNormalActionRedirect(location, matches);
    }

    // <Form method="get"/>, useTransition()
    else if (isNormalGetSubmission(location)) {
      await handleNormalGetSubmission(location, matches);
    }

    // <Form method="get" /> + loader redirect
    else if (isNormalGetSubmissionRedirect(location)) {
      await handleNormalGetSubmissionRedirect(location, matches);
    }

    // <Link/> + loader redirect()
    else if (isNormalRedirect(location)) {
      await handleNormalRedirect(location, matches);
    }

    // <Link/>, navigate()
    else {
      await handleNormalGet(location, matches);
    }
  }

  function dispose() {
    // TODO: just abort everything, doesn't matter in remix, but it will in
    // React Router if they unmount a <Routes>
  }

  // TODO: maybe just clean this up on location changes too in case we set one
  // and they never actually read it
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
        // no need to re-render (I think?)
        delete state.keyedActionData[submissionKey];
      }
    };
  }

  //// IMPLEMENTATION

  async function handleKeyedPostSubmission(
    location: Location<KeyedPostSubmission>,
    matches: ClientMatch[]
  ) {
    let key = location.state.submissionKey;

    abortNormalNavigation();
    if (actionControllers.has(key)) {
      abortAction(key);
    }
    if (transitions.has(key)) {
      clearKeyedTransition(key);
      abortKeyLoad(key);
    }

    let transition: TransitionStates["Submitting"] = {
      state: "submitting",
      type: "submission",
      formData: makeFormData(location.state.body),
      method: location.state.method,
      nextLocation: location
    };
    transitions.set(key, transition);

    update({
      nextLocation: location,
      nextMatches: matches,
      transition: idleTransition,
      transitions: new Map(transitions)
    });

    let controller = new AbortController();
    actionControllers.set(key, controller);

    let leafMatch = matches.slice(-1)[0];
    let result = await callAction(location, leafMatch, controller.signal);

    if (controller.signal.aborted) {
      return;
    }

    actionControllers.delete(key);

    if (isRedirectResult(result)) {
      let { submissionKey, method, body, encType, action } = location.state;
      let actionRedirect: KeyedActionRedirect = {
        isKeyedActionRedirect: true,
        submissionKey,
        method,
        body,
        encType,
        action
      };
      init.onRedirect(
        createRedirectLocation(result.value.location, actionRedirect),
        location
      );
      return;
    }

    let loadTransition: TransitionStates["LoadingAction"] = {
      state: "loading",
      type: "actionReload",
      formData: transition.formData,
      method: transition.method,
      nextLocation: location
    };
    transitions.set(key, loadTransition);

    update({
      transitions,
      keyedActionData: {
        ...state.keyedActionData,
        [key]: result.value
      }
    });

    await loadWithKey(location, matches, result);
  }

  async function handleKeyedActionRedirect(
    location: Location<KeyedActionRedirect>,
    matches: ClientMatch[]
  ) {
    let transition: TransitionStates["LoadingActionRedirect"] = {
      state: "loading",
      type: "actionRedirect",
      formData: makeFormData(location.state.body),
      method: location.state.method,
      nextLocation: location
    };
    transitions.set(location.state.submissionKey, transition);

    update({
      transitions: new Map(transitions),
      nextLocation: location,
      nextMatches: matches
    });

    await loadWithKey(location, matches);
  }

  async function handleKeyedGetSubmissionRedirect(
    location: Location<KeyedGetSubmissionRedirect>,
    matches: ClientMatch[]
  ) {
    let transition: TransitionStates["LoadingGetSubmissionRedirect"] = {
      state: "loading",
      type: "getSubmissionRedirect",
      formData: makeFormData(location.state.body),
      method: location.state.method,
      nextLocation: location
    };
    transitions.set(location.state.submissionKey, transition);

    update({
      transitions: new Map(transitions),
      nextLocation: location,
      nextMatches: matches
    });

    await loadWithKey(location, matches);
  }

  async function handleKeyedGetSubmission(
    location: Location<KeyedGetSubmission>,
    matches: ClientMatch[]
  ) {
    let key = location.state.submissionKey;

    abortNormalNavigation();
    if (transitions.has(key)) {
      transitions.delete(key);
    }

    let transition: TransitionStates["LoadingGetSubmission"] = {
      state: "loading",
      type: "getSubmission",
      formData: makeFormData(location.state.body),
      method: "GET",
      nextLocation: location
    };
    transitions.set(key, transition);

    update({
      nextLocation: location,
      nextMatches: matches,
      transition: idleTransition,
      transitions: new Map(transitions)
    });

    await loadWithKey(location, matches);
  }

  async function handleNormalPostSubmission(
    location: Location<NormalPostSubmission>,
    matches: ClientMatch[]
  ) {
    abortEverything();

    let transition: TransitionStates["Submitting"] = {
      state: "submitting",
      type: "submission",
      formData: makeFormData(location.state.body),
      method: location.state.method,
      nextLocation: location
    };
    update({
      nextLocation: location,
      nextMatches: matches,
      transition
    });

    let controller = new AbortController();
    pendingNavigationController = controller;

    let leafMatch = matches.slice(-1)[0];
    let result = await callAction(location, leafMatch, controller.signal);

    if (controller.signal.aborted) {
      return;
    }

    if (isRedirectResult(result)) {
      let { action, body, encType, method } = location.state;
      let actionRedirect: NormalActionRedirect = {
        isActionRedirect: true,
        action,
        body,
        encType,
        method
      };
      init.onRedirect(
        createRedirectLocation(result.value.location, actionRedirect),
        location
      );
      return;
    }

    let loadTransition: TransitionStates["LoadingAction"] = {
      state: "loading",
      type: "actionReload",
      formData: transition.formData,
      method: transition.method,
      nextLocation: location
    };

    update({
      transition: loadTransition,
      actionData: result.value
    });

    await loadNormally(location, matches, result);
  }

  async function handleNormalGetSubmission(
    location: Location<NormalGetSubmission>,
    matches: ClientMatch[]
  ) {
    abortEverything();

    let transition: TransitionStates["LoadingGetSubmission"] = {
      state: "loading",
      type: "getSubmission",
      formData: makeFormData(location.state.body),
      method: "GET",
      nextLocation: location
    };

    update({
      nextLocation: location,
      nextMatches: matches,
      transition
    });

    await loadNormally(location, matches);
  }

  async function handleNormalGet(location: Location, matches: ClientMatch[]) {
    abortEverything();

    let transition: TransitionStates["Loading"] = {
      state: "loading",
      type: "load",
      formData: undefined,
      method: "GET",
      nextLocation: location
    };

    update({
      transition,
      nextLocation: location,
      nextMatches: matches
    });

    await loadNormally(location, matches);
  }

  async function handleNormalRedirect(
    location: Location<NormalRedirect>,
    matches: ClientMatch[]
  ) {
    abortEverything();

    let transition: TransitionStates["LoadingRedirect"] = {
      state: "loading",
      type: "redirect",
      formData: undefined,
      method: "GET",
      nextLocation: location
    };

    update({
      nextLocation: location,
      nextMatches: matches,
      transition
    });

    await loadNormally(location, matches);
  }

  async function handleNormalGetSubmissionRedirect(
    location: Location<NormalGetSubmissionRedirect>,
    matches: ClientMatch[]
  ) {
    abortEverything();

    let transition: TransitionStates["LoadingGetSubmissionRedirect"] = {
      state: "loading",
      type: "getSubmissionRedirect",
      formData: makeFormData(location.state.body),
      method: "GET",
      nextLocation: location
    };

    update({
      nextLocation: location,
      nextMatches: matches,
      transition
    });

    await loadNormally(location, matches);
  }

  async function handleNormalActionRedirect(
    location: Location<NormalActionRedirect>,
    matches: ClientMatch[]
  ) {
    abortEverything();

    let transition: TransitionStates["LoadingActionRedirect"] = {
      state: "loading",
      type: "actionRedirect",
      formData: makeFormData(location.state.body),
      method: location.state.method,
      nextLocation: location
    };

    update({
      transition,
      nextLocation: location,
      nextMatches: matches
    });

    await loadNormally(location, matches);
  }

  function isHashChangeOnly(location: Location) {
    return (
      createHref(state.location) === createHref(location) &&
      state.location.hash !== location.hash
    );
  }

  function flagInterruptedSubmission() {
    if (state.transition?.state === "submitting") {
      interruptedSubmission = true;
      return;
    }

    for (let [, transition] of state.transitions) {
      if (transition.state === "submitting") {
        interruptedSubmission = true;
        return;
      }
    }
  }

  function resetInterruptedSubmission() {
    interruptedSubmission = false;
  }

  async function loadWithKey(
    location: Location<
      | KeyedPostSubmission
      | KeyedGetSubmission
      | KeyedActionRedirect
      | KeyedGetSubmissionRedirect
    >,
    matches: ClientMatch[],
    actionResult?: RouteLoaderResult
  ) {
    let id = ++currentLoadId;

    let maybeActionErrorResult =
      actionResult && actionResult.value instanceof Error
        ? actionResult
        : undefined;

    let controller = new AbortController();
    loadControllers.set(id, controller);
    pendingLoads.set(id, location);

    let results = await callLoaders(
      state,
      location,
      matches,
      controller.signal,
      interruptedSubmission,
      maybeActionErrorResult
    );

    if (controller.signal.aborted) {
      return;
    }

    let redirect = findRedirect(results);
    if (redirect) {
      if (isKeyedGetSubmission(location)) {
        let redirectState: KeyedGetSubmissionRedirect = {
          isRedirect: true,
          action: location.state.action,
          body: location.state.body,
          encType: location.state.encType,
          method: location.state.method,
          submissionKey: location.state.submissionKey
        };
        init.onRedirect(
          createRedirectLocation(redirect.location, redirectState),
          location
        );
      } else {
        init.onRedirect(
          createRedirectLocation(redirect.location, {
            isRedirect: true
          }),
          location
        );
      }
      return;
    }

    let [error, errorBoundaryId] = findErrorAndBoundaryId(
      results,
      matches,
      maybeActionErrorResult
    );

    abortStaleKeyLoads(id);
    clearKeyedTransition(location.state.submissionKey);
    clearPendingLoad(id);

    let loaderData = makeLoaderData(results, matches);

    let isLatestNavigation = location === state.nextLocation;
    let isOnlyPendingLoad =
      actionControllers.size === 0 && pendingLoads.size === 0;

    if (isLatestNavigation && isOnlyPendingLoad) {
      // A) POST /foo |------|-----O
      // B) POST /foo    |-------|----O
      //                              ^
      //
      // A) POST /foo |------|--------X
      // B) POST /foo    |-------|----O
      //                              ^
      update({
        location,
        matches,
        nextLocation: undefined,
        nextMatches: undefined,
        transition: idleTransition,
        transitions: new Map(),
        error,
        errorBoundaryId,
        loaderData
      });
    } else if (!isLatestNavigation && isOnlyPendingLoad) {
      //                             v
      // A) POST /foo |----------|---O
      // B) POST /foo    |---|-----O
      //
      //                             v
      // A) POST /foo |----------|---O
      // B) POST /foo    |---|-------X
      update({
        location: state.nextLocation,
        matches: state.nextMatches,
        nextLocation: undefined,
        nextMatches: undefined,
        transition: idleTransition,
        transitions: new Map(),
        error,
        errorBoundaryId,
        loaderData
      });
    } else if (!isOnlyPendingLoad) {
      // A) POST /foo |----------|------O
      // B) POST /foo    |---|-------O
      //                             ^
      //                           v
      // A) POST /foo |-----|------O
      // B) POST /foo    |------|--X
      //
      //                       v
      // A) POST /foo |-----|--O
      // B) POST /foo    |-----X
      update({
        loaderData,
        transitions: new Map(transitions)
      });
    } else {
      invariant(false, "Impossible `loadWithKey` case");
    }
  }

  async function loadNormally(
    location: Location,
    matches: ClientMatch[],
    actionResult?: RouteLoaderResult
  ) {
    let maybeActionErrorResult =
      actionResult && actionResult.value instanceof Error
        ? actionResult
        : undefined;

    let controller = new AbortController();
    pendingNavigationController = controller;

    let results = await callLoaders(
      state,
      location,
      matches,
      controller.signal,
      interruptedSubmission,
      maybeActionErrorResult
    );

    resetInterruptedSubmission();

    if (controller.signal.aborted) {
      return;
    }

    let redirect = findRedirect(results);
    if (redirect) {
      if (isGetSubmission(location)) {
        let { action, body, encType, method } = location.state;
        let redirectState: NormalGetSubmissionRedirect = {
          isRedirect: true,
          action,
          body,
          encType,
          method
        };
        init.onRedirect(
          createRedirectLocation(redirect.location, redirectState),
          location
        );
      } else {
        let redirectState: NormalRedirect = { isRedirect: true };
        init.onRedirect(
          createRedirectLocation(redirect.location, redirectState),
          location
        );
      }
      return;
    }

    let [error, errorBoundaryId] = findErrorAndBoundaryId(
      results,
      matches,
      maybeActionErrorResult
    );

    update({
      location,
      matches,
      error,
      errorBoundaryId,
      loaderData: makeLoaderData(results, matches),
      actionData: actionResult ? actionResult.value : undefined,
      nextLocation: undefined,
      nextMatches: undefined,
      transition: idleTransition,
      transitions: new Map()
    });
  }

  //// ABORT HANDLING

  function abortEverything() {
    flagInterruptedSubmission();
    abortNormalNavigation();
    for (let [key] of actionControllers) {
      abortAction(key);
    }
    for (let [key] of transitions) {
      clearKeyedTransition(key);
    }
    for (let [id] of pendingLoads) {
      abortLoad(id);
    }
  }

  function abortNormalNavigation() {
    pendingNavigationController?.abort();
  }

  function abortLoad(id: number) {
    let controller = loadControllers.get(id);
    invariant(controller, `Expected keyedLoadAbortController: ${id}`);
    controller.abort();
    clearPendingLoad(id);
  }

  function abortAction(key: string) {
    let controller = actionControllers.get(key);
    invariant(controller, `Expected actionController for ${key}`);
    controller.abort();
    actionControllers.delete(key);
  }

  function abortKeyLoad(key: string) {
    for (let [id, location] of pendingLoads) {
      if (location.state.submissionKey === key) {
        abortLoad(id);
      }
    }
  }

  function clearKeyedTransition(key: string) {
    transitions.delete(key);
  }

  function clearPendingLoad(id: number) {
    loadControllers.delete(id);
    pendingLoads.delete(id);
  }

  /**
   * When a later key load resolves before an earlier one, abort the earlier
   * load because it's data is unlikely to be as fresh.
   *
   * ```txt
   *          started later v   v landed first
   * A) POST /foo |---------|---O
   * B) POST /foo    |---|------X
   *                            ^ so abort this
   *
   * A) POST /foo |---------|-----X
   * B) POST /foo    |---------|--O
   * ```
   */
  function abortStaleKeyLoads(latestId: number) {
    for (let [id] of pendingLoads) {
      if (id < latestId) abortLoad(id);
    }
  }

  //// WHATEVER

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

  return {
    send,
    getState,
    dispose,
    registerKeyedActionDataRead
  };
}

async function callLoaders(
  state: TransitionManagerState,
  location: Location,
  matches: ClientMatch[],
  signal: AbortSignal,
  interruptedSubmission: boolean,
  actionErrorResult?: RouteLoaderErrorResult
): Promise<RouteLoaderResult[]> {
  let matchesToLoad = filterMatchesToLoad(
    state,
    location,
    matches,
    interruptedSubmission,
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
  location: Location<GenericPostSubmission>,
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
  state: TransitionManagerState,
  location: Location,
  matches: ClientMatch[],
  interruptedSubmission: boolean,
  actionErrorResult?: RouteLoaderErrorResult
): ClientMatch[] {
  let filterByRouteProps = (match: ClientMatch, index: number) => {
    if (!match.route.loader) {
      return false;
    }

    let alreadyMatching = state.matches[index]?.route.id === match.route.id;
    if (alreadyMatching && match.route.shouldReload) {
      return match.route.shouldReload({
        nextLocation: location,
        prevLocation: state.location,
        nextParams: match.params,
        prevParams: state.matches[index].params
      });
    }

    return true;
  };

  if (
    // hopefully catch that data update from the submission
    interruptedSubmission ||
    // mutation, reload for fresh data
    isPostSubmission(location) ||
    isNormalActionRedirect(location) ||
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
function findErrorAndBoundaryId(
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

export class TransitionRedirect {
  location: string;
  constructor(location: Location | string) {
    this.location =
      typeof location === "string"
        ? location
        : location.pathname + location.search;
  }
}

function createRedirectLocation(href: string, state: any = null) {
  let [pathname, search] = href.split("?");
  search = search ? `?${search}` : "";
  return { pathname, search, hash: "", key: "", state };
}

export function makeFormData(urlSearchString: string): FormData {
  let formData = new FormData();
  let params = new URLSearchParams(urlSearchString);
  for (let [key, value] of params) formData.append(key, value);
  return formData;
}

function isRedirectResult(
  result: RouteLoaderResult
): result is RouteLoaderRedirectResult {
  return result.value instanceof TransitionRedirect;
}
