# Multiple pending submits

- new location comes in
  - isSubmit?
    - yes
      - Always use the last to be requested loaderData
        - Could come from an earlier post!
      - Always update actionData, even if a new navigation comes through
      - Posting the same submit replaces a pending submit
      - redirect
        - same url?
          - yes
    - no
      - forget everything, normal navigation

In other words, new navigations only replace pending loads, but actions will still complete.

```js
function useRemixTransition(initialLoaderData, initialActionData) {
  let loaderData = useState(initialActionData);
  let actionData = useState(actionData);
  let submits = useState([]);


  async function callAction() {
    let isCurrent = true;
    let data = await fetch();
    if ()
    return () => {
      isCurrent = false;
    };
  }

  async function loadNextPage() {
    let isCurrent = true;
    return () => {
      isCurrent = false;
    };
  }

  useEffect(() => {
    if (nextLocation !== location) {
      if (isFormSubmit(nextLocation)) {
        return callAction();
      } else {
        return loadNextPage();
      }
    }
  }, [nextLocation, location]);
}
```

- nextLocation changes

  - is form submit?
    - yes
      - action sequence
      - start load sequence
    - no
      - start load sequence

- action sequence

  - call action
  - are we loading?
    - a different pathname?
      - return
  - set action state
  - load sequence

- load sequence

  - fetch resources
  - handle exceptions
  - maybe redirect
  - !didRedirect
    - is latest load
      - setState

- setState if this load was requested after previously committed load
- could work like:

  - after action is done, set action data state
    - track as separate state so we don't mess w/ the locations
      - might be it's own useEffect completely?
        - this way you can have separate pendingForm vs. pendingLocation
    - this lets pending forms
      - finish up before the loaders start
      - still get into state even if their load is ignored
  - track load requests with incrementing ID
  - put that state into remix state
    - before setState
      - check if the load that landed is later than the one in state

- `useActionData(ref)` when JS fails to load (SSR) needs to work ... yikes

---

- What if we always use `last to be sent` in the big useEffect but `useActionData` and then PE just depends on the action returning the data for that pending form? Would greatly simplify this and make it easy to understand probably.

  - Oh, nope, can't do that because the sidebar in a master-detail will be out of date. GAH!

- Simple implementation
  - nobody leaves pending state until everybody leaves pending state
  - use last sent LOADERS (not last sent action) hooo boy.

"\*" denotes last to land loader data

- `POST(a)* -> POST(a)`

  - ignore first request

- `POST(a) -> POST(b)

## `usePendingFormSubmit(ref)`

- Need to track all pending submits, not just the one on location state
- [ ] Put them in a map by ref
  - [ ] get the ref when it is submit
  - [ ] put it in the map
- [ ] in the hook, check the map
  - [ ] return it?
- [ ] Clean it up (in the big transition hook?)
- [ ] think it needs to be in remix context state

## `useActionData(ref)`

- ???

# Actions Return Anything

```tsx
export function action({ request }) {
  let body = new URLSearchParams(await request.text());
  return { example: body.get("example") };
}

export default function Comp() {
  let actionData = useActionData();
  return (
    <>
      {actionData ? actionData.example : "Waiting..."}
      <Form method="post">
        <input type="text" name="example" />
      </Form>
    </>
  );
}
```

One of the most useful cases is form validation, you no longer need to funnel everything through sessions, simply return the errors from your action:

```tsx
export function action({ request }) {
  let body = Object.fromEntries(new URLSearchParams(await request.text()));
  let errors = {};

  // validate the fields
  if (!body.email.includes("@")) {
    errors.email = "That doesn't look like an email address";
  }

  if (body.password.length < 6) {
    errors.password = "Password must be > 6 characters";
  }

  // if we have validation errors, return them, no more messing around with
  // sessions and redirecting to this same page
  if (Object.keys(errors).length) {
    return json(errors, { status: 422 });
  }

  // otherwise create the user and redirect
  await createUser(body);
  return redirect("/dashboard");
}

export default function Comp() {
  let errors = useActionData();

  return (
    <>
      <h1>Login</h1>
      <Form method="post">
        <p>
          <input type="text" name="email" />
          {errors?.email && <span className="error">{errors.email}</span>}
        </p>
        <p>
          <input type="text" name="password" />
          {errors?.password && <span className="error">{errors.password}</span>}
        </p>
        <p>
          <button type="submit">Sign up</button>
        </p>
      </Form>
    </>
  );
}
```

---

# PE: How it works

- match
- setup redirect handling
- setup action error
- setup emulator
- check if form is pending
  - call action
  - if error
    - put on emulator
    - track action error
  - else
    - redirect
    - return
- figure out matches to load
  - form redirected
  - new route
  - params changed
  - catchall changed
- call route transition deps
  - data, route module in parallel
  - skip if won't render
    - redirect
    - error
    - no route module
  - maybe preload blocking links
- if action errored
  - add to emulator
- transition results loop
  - if action errored && is exception
    - break
  - if not response or is error
    - or emulator has error already
      - continue
  - track emulator loader boundary
  - if error
    - add to emulator
  - else if redirect
    - maybe handle redirect
- extract new route data
- create next route data
- if still current and no redirect
  - if form is redirect/pendingget/action errored
    - reset form state to idle
  - setState

# PE: How it will work

- match
- setup redirect handling
- setup action error
- setup emulator
- check if form is pending
  - call action
    - [x] put form data on location state
      - [x] use it in the fetch
    - [x] don't require redirect
    - [x] keep track of action result
  - if error
    - put on emulator
    - track action error
  - [x] else if redirect
    - redirect
    - return
- figure out matches to load
  - [x] is form navigation
  - [x] is redirected from form submit
    - [x] use more location.state to know it's a form redirect
  - new route
  - params changed
  - catchall changed
- call route transition deps
  - data, route module in parallel
  - skip if won't render
    - redirect
    - error
    - no route module
  - maybe preload blocking links
- if action errored
  - add to emulator
- transition results loop
  - if action errored && is exception
    - break
  - if not response or is error
    - or emulator has error already
      - continue
  - track emulator loader boundary
  - if error
    - add to emulator
  - else if is redirect
    - maybe handle redirect
- extract new route data
- [x] extract action data
- create next route data
- if still current and no redirect
  - if form is redirect/pending get/action errored
    - reset form state to idle
  - setState
    - [x] include action data
- [x] Fix multiple submits in a row
- [ ] Fix data diff for same url but different location.key
- [x] Refresh after a fetch post, repost it?

# Resubmit Cases/Behavior

1. submit, redirect

   ```
   GET push> (POST > 303 >) GET*
   GET push> GET*
   ```

   Reload because it was a redirect after a submit (how to know fersure? more location state holy crapz!)

1. submit, back, forward

   ```
   GET push> POST*
   GET* <pop POST
   GET pop> POST*
   ```

   Reload because we know we called an action

1. submit, push, back

   ```
   GET push> POST push> GET*
   GET push> POST* <pop GET
   ```

   Reload because we know we called an action

1. random pop, same as 2 really

   ```
   GET > POST* > GET > GET
   ```

   Reload because we know we called an action

1. refresh

   ```
   GET push> POST*
   GET push> POST* <refresh>
   ```

   - Server renders normal GET for the page
   - Submit and throw app into pending state I guess?

# Document: How it works

- match
  - no match, throw
- setup emulator
- track if errored
- if action request
  - get leaf
  - call action
    - if error?
      - put error on emulator
    - else
      - keep going...
- determine matches to load
- load matches' loaders
- exceptions loop
  - if action errored and this is exception
    - give up
  - already have error
    - continue
  - mutate loader boundary id
  - if error
    - put on emulator
  - else redirect
    - return redirect

# Document: how it needs to work

## handleDocumentRequest

- match
  - no match, throw
- setup emulator
- track if errored
- if action
  - get leaf
  - call action
    - [x] don't require redirect
    - if error?
      - put error on emulator
    - else
      - [x] put action data in server handoff
      - keep going...
- determine matches to load
- load matches' loaders
- exceptions loop
  - if action errored and this is exception
    - give up
  - already have error
    - continue
  - mutate loader boundary id
  - if error
    - put on emulator
  - else redirect
    - return redirect

## headers

- [x] pass it `{ actionHeaders }`

## useActionData

- [x] return the data from the entry context

---

- if an action redirects
  - and it was the last one called
    - redirect now
    - if it redirected "here", then all other pending things should be around
- when hook unmounts
  - forget about data/response, etc.
- when same action goes pending
  - forget about the old stuff for that hook

```tsx
function SomePage() {
  // always the latest action/loader's data
  // (what is latest? latest to land? latest sent?)
  let data = useRouteData();

  let refA = useRef();
  let refB = useRef();

  let [
    pendingA,
    // this specific request's data
    dataA,
    responseA
  ] = useFormSubmitResult(refA);
  let [pendingB, dataB, responseB] = useFormSubmitResult(refB);

  return (
    <>
      <Form ref={refA} method="post">
        <button>
          {pendingA
            ? "Following..."
            : responseA?.status !== 200
            ? dataA.error.message
            : "Follow"}
        </button>
      </Form>
      <Form ref={refB} method="post">
        <button>
          {pendingB
            ? "Following..."
            : responseB?.status !== 200
            ? dataB.error.message
            : "Follow"}
        </button>
      </Form>
    </>
  );
}
```

---

# Actions return anything

In the end I just want to

- use forms
- work w/o js
- with js know the result of each action
- have the loaders called again after any of them lands

## Create Blog Post

Characteristics:

- Single form
- post to self
- redirect to new page

Flow:

- Go to `/posts/new`
- POST to `/posts/new`
  - REMIX: call the action of the leaf route
  - Success?
    - action redirect to `/posts/123`
    - REMIX: reload all routes
  - Errors?
    - action returns `{ errors }`
    - REMIX: reload w/ data diff
    - REMIX: render action route `/posts/new`

## Update Blog Post

Characteristics:

- Single form
- post to self
- redirect to self

Flow:

- Go to `/posts/123`
- PUT to `/posts/123`
  - REMIX: call the action of the leaf route
  - Success?
    - action returns post
    - REMIX: reload all routes
  - Errors?
    - action returns `{ post, errors }`
    - REMIX: reload w/ data diff
    - REMIX: render action url `/posts/123`

## Checkboxes

Characteristics:

- many forms
- post to self
- redirect to self or return errors

Flow:

- Go to `/projects/123`
- PUT to `/projects/123` (w/ task id in formData)

  - Success?
    - action redirects to `/projects/123`
    - REMIX: reloads all routes
  - Error?
    - action returns `{ error }`
    - REMIX:
      - ??? has pending submit ref
        - return error to pendingSubmit
      - else
        - render action url `/projects/123/task/abc`

If two error?

## Checkboxes Flow 2

Characteristics:

- many forms
- post to self
- return posts or posts, errors

Flow:

- Go to `/projects/123`
- PUT to `/projects/123` (w/ task id in formData)

  - Success?
    - action returns `{ posts }`
    - REMIX: reloads all routes
  - Error?
    - action returns `{ posts, error }`
    - REMIX:
      - ??? has pending submit ref
        - return error to pendingSubmit
      - else
        - render action url `/projects/123/task/abc`

## Two random forms

Characteristics:

- two forms
- post to different places
- one errors, one succeeds and redirects

Cases:

- Go to `/random`
- PUT to `/one`
- PUT to `/two`
- `/one` lands
  - redirects
  - REMIX: ???
- `/two` lands

  - redirects
  - REMIX: ???

- Go to `/random`
- PUT to `/one`
- PUT to `/two`
- `/two` lands
  - redirects
  - REMIX: ???
- `/two` lands

  - redirects
  - REMIX: ???

- PUT to `/projects/123` (w/ task id in formData)

  - Success?
    - action redirects to `/projects/123`
    - REMIX: reloads all routes
  - Error?
    - action returns `{ error }`
    - REMIX:
      - ??? has pending submit ref
        - return error to pendingSubmit
      - else
        - render action url `/projects/123/task/abc`

---

- as the app the want to know what happened w/ each submit

- I want remix to automatically do it's data thing
  - data diff
  - reloading the parent layouts

```tsx
function SomePage() {
  let refA = useRef<HTMLFormElement>(null);
  let refB = useRef<HTMLFormElement>(null);

  let pendingA = usePendingFormSubmit();
  let pendingB = usePendingFormSubmit(refB);

  return (
    <>
      <Form ref={refA}>
        <button>{pendingA ? "Following..." : "Follow"}</button>
      </Form>
      <Form ref={refB}>
        <button>{pendingB ? "Following..." : "Follow"}</button>
      </Form>
    </>
  );
}
```

Browser

1. A -> inflight (/one)
2. B -> inflight (/two)

- ignore A completely
- redirect to B (keep browser behavior)

PE Happy path

1. A -> inflight (/one) <Spinner/>
2. B -> inflight (/two) <Spinner/>

- redirect to B (keep browser behavior)

1. B lands (success)

- redirect to "/two"
- spinner is gone on B
- wait for A (becase its still pending)

2. A lands (success)

- ignore

PE non-happy

1. A -> inflight (/one) <Spinner/>
2. B -> inflight (/two) <Spinner/>

- redirect to B (keep browser behavior)

1. B lands (success)

- spinner is gone on B
- wait for A (because its still pending)

2. A lands (error)

- show the error somehow
- don't redirect

PE non-happy #2

1. A -> inflight (/home) <Spinner/>
2. B -> inflight (/home) <Spinner/>

- redirect to B (keep browser behavior)

1. B lands (success)

- spinner is gone on B
- wait for A (becase its still pending)

2. A lands (error)

- show the error somehow
- don't redirect

---

# Action errors

# Clientside

## how it works today:

- match
- track redirected
- setup emulator
- if pending form navigation
  - call action
  - expect redirect
  - return out of effect
- get newMatches (layout diff)
- await transition results (modules + data per route)
  - load data/module in parallel
  - if redirect
    - return info, skip loading links
  - await blocking links
  - return info
- iterate transition results in order
  - continue if
    - not response
    - not error
    - emulator has an error already
  - if has error boundary, set on emulator
    - don't have to worry about "rendering" errors because they will use React's mechanisms
  - if error
    - set on emulator
  - else if redirect
    - call maybeRedirect (better name? requestRedirect?)
- extract all the new route data
- merge all the new route data into the existing data
- if we didn't redirect or unmount
  - was a form submit
    - reset form state
  - setState

## how it needs to work

- match
- track redirected
- setup emulator
- if pending form navigation
  - call action
  - [x] if error
    - [x] set actionErrored
    - [x] put error on emulator
  - else
    - expect redirect
    - return out of effect
- get newMatches
  - [x] don't include leaf cause it's the action
  - can't do the server optimzation of calling only loaders above the deepest error boundary
    - we don't have the modules yet!
- await transition results (modules + data per route)
  - load data/module in parallel
  - if redirect
    - return info, skip loading links
  - await blocking links
  - return info
- if action error
  - find deepest error boundary
    - assign to emulator
- iterate transition results in order
  - [x] if action error and is redirect or is error
    - [x] break, just forget about it, render action error here
  - continue if
    - not response
    - not error
    - emulator has an error already
  - if has error boundary, set on emulator
    - don't have to worry about "rendering" errors because they will use React's mechanisms
  - if error
    - set on emulator
  - else if redirect
    - call maybeRedirect (better name? requestRedirect?)
- extract all the new route data
- merge all the new route data into the existing data
- if we didn't redirect or unmount
  - was redirected or pending get
    - [x] add if errored
    - reset form state
  - [ ] only use renderable matches
  - setState

# server side

## How it works today:

- match

  - no 404 page
  - throw error

- is action?

  - call action
  - return response

- setup emulator
- call all loaders
- loop results
  - already found error?
    - continue
  - maybe assign loader boundary id
    - will be the deepest
  - error?
    - assign error
      - only assigned once for the highest one
  - is redirect?
    - return redirect
- set status
- figure out entry context/handoff

## how it will work

- [x] match

  - [x] no 404 page
  - [x] throw error

- [x] setup emulator

- [x] is action?

  - [x] call action
  - [x] error?
    - [x] attach to emulator

- [x] figure out loaders to call

  - [x] action errored?
    - [x] loaders above deepest error boundary

- [x] call loaders
- [x] loop results

  - [x] action errored and not action route

    - [x] has error
      - [x] give up, render root error boundary
    - [x] is redirect
      - [x] give up, render root error boundary
    - [x] break

  - [x] already found error?
    - [x] continue
  - [x] maybe assign loader boundary id
  - [x] error?
    - [x] assign error
  - [x] is redirect?
    - [x] return redirect

- [x] if error, wipe out matches below boundaryId
- [x] set status
- [x] figure out entry context/handoff

---

- GET
  - call loaders
  - attach errors to emulator
- POST
  - call action
    - error
      - attach to emulator
      - call loaders above deepest error boundary
- wipe out matches after deepest error boundary so Outlet does nothing
- render as usual
- if that blows up, just give up and do the root boundary

- /users/123/projects

  - POST /logout
  - logout has error boundary
    - call root loader
    - error is logout boundary

- deepest error boundary is root.tsx
- post to /users/123/projects/create
- we'll render root.tsx error boundary
  - it has an outlet, now what?
  - users
    - $id
      - projects
        - create

```tsx
function ErrorBoundary({ error }) {
  return (
    <html>
      <body>
        <header>
          <Error error={error} />
        </header>
        <Outlet /> {/* <- can't do this */}
      </body>
    </html>
  );
}
```

---

# Random thoughts

On the server we know all the modules all the time so we can do things like avoid calling loaders after an action error that won't render because they don't have error boundaries below them.

We can't do that on the client because we await the data/module at the same time.

We could switch back to awaiting all the module first, and then calling all the loaders, but this is the error case and avoiding those calls is an optimization. It's better to optimize the 99% case (await module+data per route in parallel like we do now).

However ... since the beginning I've had this idea of only making one request to the server for data on a transition:

- can delete a ton of logic from the `components.tsx` because the server does it every time
- would allow for the optimization mentioned above in both cases (document/script transitions)
- could even have route loaders "act as middleware" and could even make a way for child loaders to await parent data and run sequentially

This would get tricky w/ the forthcoming `Pending` export and browser only loaders, but we could still meet those use-cases if we streamed down the data. So, like, at first stream down a template:

```
{
  "root": null,
  "projects": null,
  "projects/$id": null,
}
```

Then when one of the loaders on the server finishes, we stream it down

```
{
  id: "projects/$id",
  data: ...
}
```

This gives us the same thing as 3 requests (can fill in data, partially render the next page as data comes in) but also lets us do all the logic on the server.

The client loaders kinda ruin this idea, or least complicate the heck out of it. Staying w/ the current approach makes client loaders way easier (just a different fetch endpoint).
