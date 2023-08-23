---
title: State Management
---

# State Management

State management in React typically involves maintaining a synchronized cache of server data on the client side. However, with Remix, most of the traditional caching solutions become redundant because of how it inherently handles data synchronization.

## Understanding State Management in React

In a typical React context, when we refer to "state management", we're primarily discussing how we synchronize server state with the client. A more apt term could be "cache management" because the server is the source of truth and the client state is mostly functioning as a cache.

Popular caching solutions in React include:

- **Redux:** A predictable state container for JavaScript apps.
- **React Query:** Hooks for fetching, caching, and updating asynchronous data in React.
- **Apollo:** A comprehensive state management library for JavaScript that integrates with GraphQL.

In certain scenarios, using these libraries may be warranted. However, with Remix's unique server-focused approach, their utility becomes less prevalent. In fact, most Remix applications forgo them entirely.

## How Remix Simplifies State

As discussed in [Fullstack Data Flow][fullstack-data-flow] Remix seamlessly bridges the gap between the backend and frontend via mechanisms like loaders, actions, and forms with automatic synchronization through revalidation. This offers developers the ability to directly use server state within components without managing a cache, the network communication, or data revalidation, making most client-side caching redundant.

Here's why using typical React state patterns might be an anti-pattern in Remix:

1. **Network-related State:** If your React state is managing anything related to the network—such as data from loaders, pending form submissions, or navigational states—it's likely that you're managing state that Remix already manages:

   - **`useNavigation`**: This hook gives you access to `navigation.state`, `navigation.formData`, `navigation.location`, etc.
   - **`useFetcher`**: This facilitates interaction with `fetcher.state`, `fetcher.formData`, `fetcher.data` etc.
   - **`useLoaderData`**: Access the data for a route.
   - **`useActionData`**: Access the data from the latest action.

2. **Storing Data in Remix:** A lot of data that developers might be tempted to store in React state has a more natural home in Remix, such as:

   - **URL Search Params:** Parameters within the URL that hold state.
   - **Cookies:** Small pieces of data stored on the user's device.
   - **Server Sessions:** Server-managed user sessions.
   - **Server Caches:** Cached data on the server side for quicker retrieval.

3. **Performance Considerations:** At times, client state is leveraged to avoid redundant data fetching. With Remix, you can use the `Cache-Control` headers within loaders, allowing you to tap into the browser's native cache. However, this approach has its limitations and should be used judiciously. It's usually more beneficial to optimize backend queries or implement a server cache. This is because such changes benefit all users and do away with the need for individual browser caches.

As a developer transitioning to Remix, it's essential to recognize and embrace its inherent efficiencies rather than applying traditional React patterns. Remix offers a streamlined solution to state management leading to less code, fresh data, and no state synchronization bugs.

## Examples

### Network Related State

For examples on using Remix's internal state to manage network related state, refer to [Pending UI][pending-ui].

### URL Search Params

Consider a UI that lets the user customize between list view or detail view. Your instinct might be to reach for React state:

```tsx bad lines=[2,6,9]
export function List() {
  const [view, setView] = React.useState("list");
  return (
    <div>
      <div>
        <button onClick={() => setView("list")}>
          View as List
        </button>
        <button onClick={() => setView("details")}>
          View with Details
        </button>
      </div>
      {view === "list" ? <ListView /> : <DetailView />}
    </div>
  );
}
```

Now consider you want the URL to update when the user changes the view. Note the state synchronization:

```tsx bad lines=[10,19,27]
import {
  useNavigate,
  useSearchParams,
} from "@remix-run/react";

export function List() {
  const navigate = useNavigate();
  const params = useSearchParams();
  const [view, setView] = React.useState(
    params.get("view") || "list"
  );

  return (
    <div>
      <div>
        <button
          onClick={() => {
            setView("list");
            navigate(`?view=list`);
          }}
        >
          View as List
        </button>
        <button
          onClick={() => {
            setView("details");
            navigate(`?view=details`);
          }}
        >
          View with Details
        </button>
      </div>
      {view === "list" ? <ListView /> : <DetailView />}
    </div>
  );
}
```

Instead of synchronizing state, you can simply read and set the state in the URL directly with boring ol' HTML forms.

```tsx lines=[5,9-16]
import { Form } from "@remix-run/react";

export function List() {
  const params = useSearchParams();
  const view = params.get("view") || "list";

  return (
    <div>
      <Form>
        <button name="view" value="list">
          View as List
        </button>
        <button name="view" value="details">
          View with Details
        </button>
      </Form>
      {view === "list" ? <ListView /> : <DetailView />}
    </div>
  );
}
```

### Form Validation and Action Data

While client side validation is a great way to enhance the user experience, you can get similar UX by skipping the client side states and letting the server handle it.

This example is a doozy, it's certainly got bugs, and there are libraries that can help, but it illustrates the complexity and touch points of managing your own network state, synchronizing state from the server, and doubling up on form validation between the client and server.

```tsx bad lines=[2,14,30,41,66]
export function Signup() {
  // managing a lot of React State
  const [isSubmitting, setIsSubmitting] =
    React.useState(false);

  const [userName, setUserName] = React.useState("");
  const [userNameError, setUserNameError] =
    React.useState(null);

  const [password, setPassword] = React.useState(null);
  const [passwordError, setPasswordError] =
    React.useState("");

  // Duplicating some server logic in the browser
  function validateForm() {
    setUserNameError(null);
    setPasswordError(null);
    const errors = validateSignupForm(userName, password);
    if (errors) {
      if (errors.userName) {
        setUserNameError(errors.userName);
      }
      if (errors.password) {
        setPasswordError(errors.password);
      }
    }
    return Boolean(errors);
  }

  // managing the network yourself
  async function handleSubmit() {
    if (validateForm()) {
      setSubmitting(true);
      const res = await postJSON("/api/signup", {
        userName,
        password,
      });
      const json = await res.json();
      setIsSubmitting(false);

      // synchronizing server state to the client
      if (json.errors) {
        if (json.errors.userName) {
          setUserNameError(json.errors.userName);
        }
        if (json.errors.password) {
          setPasswordError(json.errors.password);
        }
      }
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <p>
        <input
          type="text"
          name="username"
          value={userName}
          onChange={() => {
            // synchronizing form state for the fetch
            setUserName(event.target.value);
          }}
        />
        {userNameError ? <i>{userNameError}</i> : null}
      </p>

      <p>
        <input
          type="password"
          name="password"
          onChange={(event) => {
            // synchronizing form state for the fetch
            setPassword(event.target.value);
          }}
        />
        {passwordError ? <i>{passwordError}</i> : null}
      </p>

      <button disabled={isSubmitting} type="submit">
        Sign Up
      </button>

      {isSubmitting ? <BusyIndicator /> : null}
    </form>
  );
}
```

And the backend API at `/api/signup` that also validates and returns errors. It needs to run server side to check things like duplicate user names, etc. Stuff the client can't know.

```tsx
export function signupHandler(request) {
  const errors = await validateSignupRequest(request);
  if (errors) {
    return { ok: false, errors: errors };
  }
  await signupUser(request);
  return { ok: true, errors: null };
}
```

Now consider the same example with Remix. The action is identical, but the component is much simpler since you can use the server state directly from `useActionData` and read the network state Remix is already managing.

```tsx filename=app/routes/signup.tsx lines=[19-21]
import {
  useNavigation,
  useActionData,
} from "@remix-run/react";

export function action({ request }) {
  const errors = await validateSignupRequest(request);
  if (errors) {
    return { ok: false, errors: errors };
  }
  await signupUser(request);
  return { ok: true, errors: null };
}

export function Signup() {
  const navigation = useNavigation();
  const actionData = useActionData();

  const userNameError = actionData?.errors?.userName;
  const passwordError = actionData?.errors?.password;
  const isSubmitting = navigation.formAction === "/signup";

  return (
    <Form method="post">
      <p>
        <input type="text" name="username" />
        {userNameError ? <i>{userNameError}</i> : null}
      </p>

      <p>
        <input type="password" name="password" />
        {passwordError ? <i>{passwordError}</i> : null}
      </p>

      <button disabled={isSubmitting} type="submit">
        Sign Up
      </button>

      {isSubmitting ? <BusyIndicator /> : null}
    </Form>
  );
}
```

All of the previous state management gets collapsed into three lines of code. There is no need for React state, change event listeners, submit handlers, or state management libraries for a network interaction like this.

The server state is available directly from `useActionData` and the network state is available from `useNavigation`. If you find yourself managing and synchronizing state for network interactions, there's probably a simpler way to do it in Remix.

As bonus a party trick, the form will still work if JavaScript fails to load. Instead of Remix managing the network, the browser will manage it.

[fullstack-data-flow]: ./03-data-flow
[pending-ui]: ./07-pending-ui
