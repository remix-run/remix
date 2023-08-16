---
title: Simple App (30m)
order: 1
---

# Simple App Tutorial

We'll be building a small, but feature-rich app that lets you keep track of your contacts. There's no database or other "production ready" things so we can stay focused on Remix. We expect it to take about 30m if you're following along, otherwise it's a quick read. Check the other tutorials for more in-depth examples.

<img class="tutorial" src="/docs-images/contacts/01.webp" />

👉 **Every time you see this it means you need to do something in the app!**

The rest is just there for your information and deeper understanding. Let's get to it.

## Setup

👉 **Generate a basic template**

```shellscript nonumber
npx create-remix@latest --template ryanflorence/remix-tutorial-template
```

This uses a pretty bare-bones template but includes our css and data model so we can focus on Remix. The [Quick Start][quickstart] can familiarize you with the basic setup of a Remix project if you'd like to learn more.

👉 **Start the app**

```shellscript nonumber
# cd into the app directory
cd {wherever you put the app}

# install dependencies if you haven't already
npm install

# start the server
npm run dev
```

You should now see an unstyled screen that looks like this:

<img class="tutorial" src="/docs-images/contacts/03.webp" />

## The Root Route

Note the file at `app/root.tsx`. This is what we call the "Root Route". It's the first component in the UI that renders, so it typically contains the global layout for the page.

<details>

<summary>Expand here to see the root component code</summary>

```jsx filename=src/routes/root.jsx
import {
  Links,
  LiveReload,
  Meta,
  Scripts,
  ScrollRestoration,
  Form,
} from "@remix-run/react";

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <div id="sidebar">
          <h1>Remix Contacts</h1>
          <div>
            <Form id="search-form" role="search">
              <input
                id="q"
                aria-label="Search contacts"
                placeholder="Search"
                type="search"
                name="q"
              />
              <div
                id="search-spinner"
                aria-hidden
                hidden={true}
              />
            </Form>
            <Form method="post">
              <button type="submit">New</button>
            </Form>
          </div>
          <nav>
            <ul>
              <li>
                <a href={`/contacts/1`}>Your Name</a>
              </li>
              <li>
                <a href={`/contacts/2`}>Your Friend</a>
              </li>
            </ul>
          </nav>
        </div>

        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
```

</details>

## Adding Stylesheets with `links`

While there are multiple ways to style your Remix app, we're going to use a plain stylesheet that's already been written to keep things focused on Remix.

You can import CSS files directly into JavaScript modules. The compiler will fingerprint the asset, save it to your [`assetsBuildDirectory`][assetbuilddir], and provide your module with the publicly accessible href.

👉 **Import the app styles**

```jsx filename=app/root.tsx
// existing imports
import appStylesHref from "./app.css";

export function links() {
  return [{ rel: "stylesheet", href: appStylesHref }];
}
```

Every route can export [`links`][links]. They will be collected and rendered into the `<Links />` component we rendered in `app/root.tsx`.

The app should look something like this now. It sure is nice having a designer who can also write the CSS, isn't it? (Thank you [Jim][jim] 🙏).

<img class="tutorial" loading="lazy" src="/docs-images/contacts/04.webp" />

## The Contact Route UI

If you click on one of the sidebar items you'll get the default 404 page. Let's create a route that matches the url `/contacts/1`.

👉 **Create the contact route module**

```shellscript nonumber
touch app/routes/contacts.$contactId.tsx
# you might have to escape the $
touch app/routes/contacts.\$contactId.tsx
```

In the Remix [route file convention][routeconvention], `.` will create a `/` in the URL and `$` makes a segment dynamic. We just created a route that will match URLs that look like this:

- `/contacts/123`
- `/contacts/abc`

👉 **Add the contact component UI**

It's just a bunch of elements, feel free to copy/paste.

```tsx filename=app/routes/contacts.$contactId.tsx
import { Form } from "@remix-run/react";

import type { ContactRecord } from "../data";

export default function Contact() {
  const contact = {
    first: "Your",
    last: "Name",
    avatar: "https://placekitten.com/g/200/200",
    twitter: "your_handle",
    notes: "Some notes",
    favorite: true,
  };

  return (
    <div id="contact">
      <div>
        <img
          alt={`${contact.first} ${contact.last} avatar`}
          key={contact.avatar}
          src={contact.avatar}
        />
      </div>

      <div>
        <h1>
          {contact.first || contact.last ? (
            <>
              {contact.first} {contact.last}
            </>
          ) : (
            <i>No Name</i>
          )}{" "}
          <Favorite contact={contact} />
        </h1>

        {contact.twitter ? <p>
            <a
              href={`https://twitter.com/${contact.twitter}`}
            >
              {contact.twitter}
            </a>
          </p> : null}

        {contact.notes ? <p>{contact.notes}</p> : null}

        <div>
          <Form action="edit">
            <button type="submit">Edit</button>
          </Form>
          <Form
            method="post"
            action="destroy"
            onSubmit={(event) => {
              const response = confirm(
                "Please confirm you want to delete this record."
              );
              if (response === false) {
                event.preventDefault();
              }
            }}
          >
            <button type="submit">Delete</button>
          </Form>
        </div>
      </div>
    </div>
  );
}

function Favorite({ contact }: { contact: ContactRecord }) {
  // yes, this is a `let` for later
  const favorite = contact.favorite;
  return (
    <Form method="post">
      <button
        name="favorite"
        value={favorite ? "false" : "true"}
        aria-label={
          favorite
            ? "Remove from favorites"
            : "Add to favorites"
        }
      >
        {favorite ? "★" : "☆"}
      </button>
    </Form>
  );
}
```

Now if we click one of the links or visit `/contacts/1` we get ... nothing new?

<img class="tutorial" loading="lazy" alt="contact route with blank main content" src="/docs-images/contacts/05.webp" />

## Nested Routes and Outlets

Since Remix is built on top of React Router, it supports nested routing. In order for child routes to render inside of parent layouts, we need to render an [outlet][outlet] in the parent. Let's fix it, open up `app/root.tsx` and render an outlet inside.

👉 **Render an [`<Outlet>`][outlet]**

```jsx filename=app/root.jsx lines=[1,8-10]
import { Outlet } from "@remix-run/react";
/* existing imports */

export default function Root() {
  return (
    <html>
      {/* all the other elements */}
      <div id="detail">
        <Outlet />
      </div>
      {/* all the other elements */}
    </html>
  );
}
```

Now the child route should be rendering through the outlet.

<img class="tutorial" loading="lazy" alt="contact route with the main content" src="/docs-images/contacts/06.webp" />

## Client Side Routing

You may or may not have noticed, but when we click the links in the sidebar, the browser is doing a full document request for the next URL instead of client side routing.

Client side routing allows our app to update the URL without requesting another document from the server. Instead, the app can immediately render new UI. Let's make it happen with [`<Link>`][link].

👉 **Change the sidebar `<a href>` to `<Link to>`**

```jsx filename=app/root.jsx lines=[2,13,16]
/* existing imports */
import { Link } from "@remix-run/react";

export default function Root() {
  return (
    <>
      <div id="sidebar">
        {/* other elements */}

        <nav>
          <ul>
            <li>
              <Link to={`contacts/1`}>Your Name</Link>
            </li>
            <li>
              <Link to={`contacts/2`}>Your Friend</Link>
            </li>
          </ul>
        </nav>

        {/* other elements */}
      </div>
    </>
  );
}
```

You can open the network tab in the browser devtools to see that it's not requesting documents anymore.

## Loading Data

URL segments, layouts, and data are more often than not coupled (tripled?) together. We can see it in this app already:

| URL Segment         | Component   | Data               |
| ------------------- | ----------- | ------------------ |
| /                   | `<Root>`    | list of contacts   |
| contacts/:contactId | `<Contact>` | individual contact |

Because of this natural coupling, Remix has data conventions to get data into your route components easily.

There are two APIs we'll be using to load data, [`loader`][loader] and [`useLoaderData`][useloaderdata]. First we'll create and export a loader function in the root route and then render the data.

👉 **Export a loader from `root.jsx` and render the data**

```jsx filename=app/root.tsx lines=[2,4,6-9,14,25-46]
/* existing imports */
import { useLoaderData } from "@remix-run/react";

import { getContacts } from "./data";

export async function loader() {
  const contacts = await getContacts();
  return { contacts };
}

/* other code */

export default function Root() {
  const { contacts } = useLoaderData();

  return (
    <html>
      {/* other code */}
      <div id="sidebar">
        <h1>Remix Contacts</h1>

        <div id="sidebar">{/* other code */}</div>

        <nav>
          {contacts.length ? (
            <ul>
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <Link to={`contacts/${contact.id}`}>
                    {contact.first || contact.last ? (
                      <>
                        {contact.first} {contact.last}
                      </>
                    ) : (
                      <i>No Name</i>
                    )}{" "}
                    {contact.favorite ? <span>★</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <i>No contacts</i>
            </p>
          )}
        </nav>
      </div>

      {/* other code */}
    </html>
  );
}
```

That's it! Remix will now automatically keep that data in sync with your UI. The sidebar should now look like this:

<img class="tutorial" loading="lazy" src="/docs-images/contacts/07.webp" />

## Type Inference

You may have noticed TypeScript complaining about the `contact` type inside the map. We can add a quick annotation to get type inference about our data with `typeof loader`:

```tsx filename=app/root.tsx
export default function Root() {
  const { contacts } = useLoaderData<typeof loader>();
  // ...
}
```

## URL Params in Loaders

👉 **Click on one of the sidebar links**

We should be seeing our old static contact page again, with one difference: the URL now has a real ID for the record.

<img class="tutorial" loading="lazy" src="/docs-images/contacts/08.webp" />

Remember the `$contactId` part of the file name at `routes/contacts.$contactId.tsx`? These dynamic segments will match dynamic (changing) values in that position of the URL. We call these values in the URL "URL Params", or just "params" for short.

These [`params`][params] are passed to the loader with keys that match the dynamic segment. For example, our segment is named `$contactId` so the value will be passed as `params.contactId`.

These params are most often used to find a record by ID. Let's try it out.

👉 **Add a loader to the contact page and access data with `useLoaderData`**

```tsx filename=app/routes/contacts.$contactId.tsx lines=[1,3,5-7,11]
import { Form, useLoaderData } from "@remix-run/react";

import { getContact } from "../data";

export async function loader({ params }) {
  const contact = await getContact(params.contactId);
  return contact;
}

export default function Contact() {
  const contact = useLoaderData();
  // existing code
}
```

<img class="tutorial" loading="lazy" src="/docs-images/contacts/10.webp" />

## Validating Params and Throwing Responses

TypeScript is very upset with us, let's make it happy and see what that forces us to consider:

```tsx filename=app/routes/contacts.$contactId.tsx lines=[2,3,7-8,14]
import type { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { getContact } from "../data";

export async function loader({ params }: LoaderArgs) {
  invariant(params.contactId, "Missing contactId param");
  const contact = await getContact(params.contactId);
  return contact;
}

export default function Contact() {
  const contact = useLoaderData<typeof loader>();
  // existing code
}
```

First problem this highlights is we might have gotten the param's name wrong between the file name and the code (maybe you changed the name of the file!). Invariant is a handy function for throwing an error with a custom message when you anticipated a potential issue with your code.

Next, the `useLoaderData<typeof loader>()` now knows that we got a contact or `null` (maybe there is no contact with that ID). This potential `null` is cumbersome for our component code and the TS errors are flying around still.

We could account for the possibility of the contact being not found in component code, but the webby thing to do is send a proper 404. We can do that in the loader and solve all of our problems at once.

```tsx filename=app/routes/contacts.$contactId.tsx lines=[4-6]
export async function loader({ params }: LoaderArgs) {
  invariant(params.contactId, "Missing contactId param");
  const contact = await getContact(params.contactId);
  if (!contact) {
    throw new Response("Not Found", { status: 404 });
  }
  return contact;
}
```

Now, if the user isn't found, code execution down this path stops and Remix renders the error path instead. Components in Remix can focus only on the happy path 😁

## Data Mutations

We'll create our first contact in a second, but first let's talk about HTML.

Remix emulates HTML Form navigation as the data mutation primitive, which used to be the only way prior to the JavaScript cambrian explosion. Don't be fooled by the simplicity! Forms in Remix give you the UX capabilities of client rendered apps with the simplicity of the "old school" web model.

While unfamiliar to some web developers, HTML forms actually cause a navigation in the browser, just like clicking a link. The only difference is in the request: links can only change the URL while forms can also change the request method (GET vs POST) and the request body (POST form data).

Without client side routing, the browser will serialize the form's data automatically and send it to the server as the request body for POST, and as URLSearchParams for GET. Remix does the same thing, except instead of sending the request to the server, it uses client side routing and sends it to a route [`action`][action].

We can test this out by clicking the "New" button in our app.

<img class="tutorial" loading="lazy" src="/docs-images/contacts/09.webp" />

Remix sends a 405 because there is no code on the server to handle this form navigation.

## Creating Contacts

We'll create new contacts by exporting an `action` in our root route. When the user clicks the "new" button, the form will POST to the root route action.

👉 **Create the `action`**

```jsx filename=src/routes/root.jsx lines=[2,4-7]
// existing code
import { getContacts, createEmptyContact } from "../data";

export async function action() {
  const contact = await createEmptyContact();
  return { contact };
}

/* other code */
```

That's it! Go ahead and click the "New" button and you should see a new record pop into the list 🥳

<img class="tutorial" loading="lazy" src="/docs-images/contacts/11.webp" />

The `createEmptyContact` method just creates an empty contact with no name or data or anything. But it does still create a record, promise!

> 🧐 Wait a sec ... How did the sidebar update? Where did we call the `action`? Where's the code to refetch the data? Where are `useState`, `onSubmit` and `useEffect`?!

This is where the "old school web" programming model shows up. [`<Form>`][form] prevents the browser from sending the request to the server and sends it to your route `action` instead with `fetch`.

In web semantics, a POST usually means some data is changing. By convention, Remix uses this as a hint to automatically revalidate the data on the page after the action finishes.

In fact, since it's all just HTML and HTTP, you could disable JavaScript and the whole thing will still work. Instead of Remix serializing the form and making a `fetch` to your server, the browser will serialize the form and make a document request. From there Remix will render the page server side and send it down. It's the same UI in the end either way.

We'll keep JavaScript around though because we're gonna make a better user experience than spinning favicons and static documents.

## Updating Data

Let's add a way to fill the information for our new record.

Just like creating data, you update data with [`<Form>`][form]. Let's make a new route at `routes/contacts.$contactId_.edit.tsx`.

👉 **Create the edit component**

```shellscript nonumber
touch app/routes/contacts.\$contactId_.edit.tsx
```

Note the weird `_` in `$contactId_`. By default, routes will automatically nest inside routes with the same prefixed name. Adding a trialing `_` tells the route to **not** nest inside `routes/contacts.$contactId.tsx`. Read more in the [Route File Naming][routeconvention] guide.

👉 **Add the edit page UI**

Nothing we haven't seen before, feel free to copy/paste:

```tsx filename=app/routes/contacts.$contactId.edit.tsx
import type { LoaderArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { getContact } from "../data";

export async function loader({ params }: LoaderArgs) {
  invariant(params.contactId, "Missing contactId param");
  const contact = await getContact(params.contactId);
  if (!contact) {
    throw new Response("Not found", { status: 404 });
  }
  return contact;
}

export default function EditContact() {
  const contact = useLoaderData();

  return (
    <Form method="post" id="contact-form">
      <p>
        <span>Name</span>
        <input
          placeholder="First"
          aria-label="First name"
          type="text"
          name="first"
          defaultValue={contact.first}
        />
        <input
          placeholder="Last"
          aria-label="Last name"
          type="text"
          name="last"
          defaultValue={contact.last}
        />
      </p>
      <label>
        <span>Twitter</span>
        <input
          type="text"
          name="twitter"
          placeholder="@jack"
          defaultValue={contact.twitter}
        />
      </label>
      <label>
        <span>Avatar URL</span>
        <input
          placeholder="https://example.com/avatar.jpg"
          aria-label="Avatar URL"
          type="text"
          name="avatar"
          defaultValue={contact.avatar}
        />
      </label>
      <label>
        <span>Notes</span>
        <textarea
          name="notes"
          defaultValue={contact.notes}
          rows={6}
        />
      </label>
      <p>
        <button type="submit">Save</button>
        <button type="button">Cancel</button>
      </p>
    </Form>
  );
}
```

Now click on your new record, then click the "Edit" button. We should see the new route.

<img class="tutorial" loading="lazy" src="/docs-images/contacts/12.webp" />

## Updating Contacts with FormData

The edit route we just created already renders a form. All we need to do is add the action. Remix will serialize the form, POST it with `fetch`, and automatically revalidate all the data.

👉 **Add an action to the edit route**

```tsx filename=app/routes/contacts.$contactId_.edit.tsx
import { redirect } from "@remix-run/node";
import type {
  LoaderArgs,
  ActionArgs,
} from "@remix-run/node";

import { getContact, updateContact } from "../data";

export async function action({
  request,
  params,
}: ActionArgs) {
  const formData = await request.formData();
  const updates = Object.fromEntries(formData);
  invariant(params.contactId, "Missing contactId param");
  await updateContact(params.contactId, updates);
  return redirect(`/contacts/${params.contactId}`);
}

/* existing code */
```

Fill out the form, hit save, and you should see something like this! <small>(Except easier on the eyes and maybe less hairy.)</small>

<img class="tutorial" loading="lazy" src="/docs-images/contacts/13.webp" />

## Mutation Discussion

> 😑 It worked, but I have no idea what is going on here...

Let's dig in a bit...

Open up `contacts.$contactId_.edit.tsx` and look at the form elements. Notice how they each have a name:

```jsx lines=[5] filename=app/routes/contacts.$contactId_.edit.tsx
<input
  placeholder="First"
  aria-label="First name"
  type="text"
  name="first"
  defaultValue={contact.first}
/>
```

Without JavaScript, when a form is submitted, the browser will create [`FormData`][formdata] and set it as the body of the request when it sends it to the server. As mentioned before, Remix prevents that and emulates the browser by sending the request to your action with `fetch` instead, including the [`FormData`][formdata].

Each field in the form is accessible with `formData.get(name)`. For example, given the input field from above, you could access the first and last names like this:

```jsx lines=[3,4]
export async function action({ request, params }) {
  const formData = await request.formData();
  const firstName = formData.get("first");
  const lastName = formData.get("last");
  // ...
}
```

Since we have a handful of form fields, we used [`Object.fromEntries`][fromentries] to collect them all into an object, which is exactly what our `updateContact` function wants.

```jsx
const updates = Object.fromEntries(formData);
updates.first; // "Some"
updates.last; // "Name"
```

Aside from `action`, none of these APIs we're discussing are provided by Remix: [`request`][request], [`request.formData`][requestformdata], [`Object.fromEntries`][fromentries] are all provided by the web platform.

After we finished the action, note the [`redirect`][redirect] at the end:

```tsx filename=src/routes/edit.jsx lines=[6]
export async function action({
  request,
  params,
}: ActionArgs) {
  const formData = await request.formData();
  const updates = Object.fromEntries(formData);
  invariant(params.contactId, "Missing contactId param");
  await updateContact(params.contactId, updates);
  return redirect(`/contacts/${params.contactId}`);
}
```

Loaders and actions can both [return a `Response`][returningresponses] (makes sense, since they received a [`Request`][request]!). The [`redirect`][redirect] helper just makes it easier to return a [response][response] that tells the app to change locations.

Without client side routing, if a server redirected after a POST request, the new page would fetch the latest data and render. As we learned before, REmix emulates this model and automatically revalidates the data on the page after the action. That's why the sidebar automatically updates when we save the form. The extra revalidation code doesn't exist without client side routing, so it doesn't need to exist with client side routing in Remix either!

One last thing. Without JavaScript, the `redirect` would be a normal redirect. However, with JavaScript it's a clientside redirect, so the user doesn't lose client state like scroll positions or component state.

## Redirecting new records to the edit page

Now that we know how to redirect, let's update the action that creates new contacts to redirect to the edit page:

👉 **Redirect to the new record's edit page**

```tsx filename=app/routes/root.tsx lines=[2,6]
/* existing imports */
import { redirect } from "@remix-run/node";

export async function action() {
  const contact = await createEmptyContact();
  return redirect(`/contacts/${contact.id}/edit`);
}
```

Now when we click "New", we should end up on the edit page:

<img class="tutorial" loading="lazy" src="/docs-images/contacts/14.webp" />

## Active Link Styling

Now that we have a bunch of records, it's not clear which one we're looking at in the sidebar. We can use [`NavLink`][navlink] to fix this.

👉 **Replace `<Link>` with `<NavLink>` in the sidebar**

```tsx filename=app/routes/root.tsx lines=[2,6-13]
/* existing imports */
import { NavLink } from "@remix-run/react";

// inside of the `contacts.map` change `Link` to `NavLink`
<li key={contact.id}>
  <NavLink
    to={`contacts/${contact.id}`}
    className={({ isActive, isPending }) =>
      isActive ? "active" : isPending ? "pending" : ""
    }
  >
    {/* other code */}
  </NavLink>
</li>;
```

Note that we are passing a function to `className`. When the user is at the URL that matches `<NavLink to>`, then `isActive` will be true. When it's _about_ to be active (the data is still loading) then `isPending` will be true. This allows us to easily indicate where the user is and also provide immediate feedback when links are clicked but data needs to be loaded.

<img class="tutorial" loading="lazy" src="/docs-images/contacts/15.webp"/>

## Global Pending UI

As the user navigates the app, Remix will _leave the old page up_ as data is loading for the next page. You may have noticed the app feels a little unresponsive as you click between the list. Let's provide the user with some feedback so the app doesn't feel unresponsive.

Remix is managing all of the state behind the scenes and reveals the pieces of it you need to build dynamic web apps. In this case, we'll use the [`useNavigation`][usenavigation] hook.

👉 **Add `useNavigation` to add global pending UI**

```jsx filename=src/routes/root.jsx lines=[3,10,17]
import {
  // existing code
  useNavigation,
} from "@remix-run/react";

// existing code

export default function Root() {
  const { contacts } = useLoaderData();
  const navigation = useNavigation();

  return (
    <>
      <div id="sidebar">{/* existing code */}</div>
      <div
        id="detail"
        className={
          navigation.state === "loading" ? "loading" : ""
        }
      >
        <Outlet />
      </div>
    </>
  );
}
```

[`useNavigation`][usenavigation] returns the current navigation state: it can be one of `"idle" | "submitting" | "loading"`.

In our case, we add a `"loading"` class to the main part of the app if we're not idle. The CSS then adds a nice fade after a short delay (to avoid flickering the UI for fast loads). You could do anything you want though, like show a spinner or loading bar across the top.

<img class="tutorial" loading="lazy" src="/docs-images/contacts/16.webp" />

## Deleting Records

If we review code in the contact route, we can find the delete button looks like this:

```jsx filename=src/routes/contact.jsx lines=[3]
<Form
  method="post"
  action="destroy"
  onSubmit={(event) => {
    if (
      !confirm(
        "Please confirm you want to delete this record."
      )
    ) {
      event.preventDefault();
    }
  }}
>
  <button type="submit">Delete</button>
</Form>
```

Note the `action` points to `"destroy"`. Like `<Link to>`, `<Form action>` can take a _relative_ value. Since the form is rendered in `contact.$contactId.tsx`, then a relative action with `destroy` will submit the form to `contact.$contactId.destroy` when clicked.

At this point you should know everything you need to know to make the delete button work. Maybe give it a shot before moving on? You'll need:

1. A new route
2. An `action` at that route
3. `deleteContact` from `app/data.ts`
4. `redirect` to somewhere after

👉 **Create the "destroy" route module**

```shellscript nonumber
touch app/routes/contacts.\$contactId.destroy.tsx
```

👉 **Add the destroy action**

```tsx filename=app/routes/contacts.$contactId.destroy.tsx
import { type ActionArgs, redirect } from "@remix-run/node";
import invariant from "tiny-invariant";

import { deleteContact } from "../data";

export async function action({ params }: ActionArgs) {
  invariant(params.contactId, "Missing contactId param");
  await deleteContact(params.contactId);
  return redirect("/");
}
```

Alright, navigate to a record and click the "Delete" button. It works!

> 😅 I'm still confused why this all works

When the user clicks the submit button:

1. `<Form>` prevents the default browser behavior of sending a new document POST request to the server, but instead emulates the browser by creating a POST request with client side routing and `fetch`
2. The `<Form action="destroy">` matches the new route at `"contacts.$contactId.destroy"` and sends it the request
3. After the action redirects, Remix calls all of the loaders for the data on the page to get the latest values (this is "revalidation"). `useLoaderData` returns new values and causes the components to update!

Add a form, add an action, Remix does the rest.

## Index Routes

When we load up the app, you'll notice a big blank page on the right side of our list.

<img class="tutorial" loading="lazy" src="/docs-images/contacts/17.webp" />

When a route has children, and you're at the parent route's path, the `<Outlet>` has nothing to render because no children match. You can think of index routes as the default child route to fill in that space.

👉 **Create an index route for the root route**

```
touch app/routes/_index.tsx
```

👉 **Fill in the index component's elements**

Feel free to copy paste, nothing special here.

```jsx filename=app/routes/_index.tsx
export default function Index() {
  return (
    <p id="index-page">
      This is a demo for Remix.
      <br />
      Check out{" "}
      <a href="https://remix.run">the docs at remix.run</a>.
    </p>
  );
}
```

The route name `_index` is special. It tells Remix to match and render this route when the user is at the parent route's exact path, so there are no other child routes to render in the `<Outlet />`.

<img class="tutorial" loading="lazy" src="/docs-images/contacts/18.webp" />

Voila! No more blank space. It's common to put dashboards, stats, feeds, etc. at index routes. They can participate in data loading as well.

## Cancel Button

On the edit page we've got a cancel button that doesn't do anything yet. We'd like it to do the same thing as the browser's back button.

We'll need a click handler on the button as well as [`useNavigate`][usenavigate].

👉 **Add the cancel button click handler with `useNavigate`**

```jsx filename=app/routes/contacts.$contactId.edit.tsx lines=[1,7,17-19]
import {
  Form,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";

/* existing code*/

export default function Edit() {
  const contact = useLoaderData();
  const navigate = useNavigate();

  return (
    <Form method="post" id="contact-form">
      {/* existing code */}

      <p>
        <button type="submit">Save</button>
        <button
          type="button"
          onClick={() => {
            navigate(-1);
          }}
        >
          Cancel
        </button>
      </p>
    </Form>
  );
}
```

Now when the user clicks "Cancel", they'll be sent back one entry in the browser's history.

> 🧐 Why is there no `event.preventDefault()` on the button?

A `<button type="button">`, while seemingly redundant, is the HTML way of preventing a button from submitting its form.

Two more features to go. We're on the home stretch!

## URL Search Params and GET Submissions

All of our interactive UI so far have been either links that change the URL or forms that post data to actions. The search field is interesting because it's a mix of both: it's a form but it only changes the URL, it doesn't change data.

Let's see what happens when we submit the search form:

👉 **Type a name into the search field and hit the enter key**

Note the browser's URL now contains your query in the URL as [URLSearchParams][urlsearchparams]:

```
http://localhost:3000/?q=ryan
```

Since it's not `<Form method="post">`, Remix emulates the browser by serializing the [`FormData`][formdata] into the [`URLSearchParams`][urlsearchparams] instead of the request body.

Loaders have access to the search params from the `request`. Let's use it to filter the list:

👉 **Filter the list if there are URLSearchParams**

```tsx filename=app/routes/root.tsx
/* existing imports */
import { type LoaderArgs, redirect } from "@remix-run/node";

export async function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const contacts = await getContacts(q);
  return { contacts };
}
```

<img class="tutorial" loading="lazy" src="/docs-images/contacts/19.webp" />

Because this is a GET, not a POST, Remix _does not_ call the `action`. Submitting a GET form is the same as clicking a link: only the URL changes.

This also means it's a normal page navigation. You can click the back button to get back to where you were.

## Synchronizing URLs to Form State

There are a couple of UX issues here that we can take care of quickly.

1. If you click back after a search, the form field still has the value you entered even though the list is no longer filtered.
2. If you refresh the page after searching, the form field no longer has the value in it, even though the list is filtered

In other words, the URL and our input's state are out of sync.

Let's solve (2) first and start the input with the value from the URL.

👉 **Return `q` from your loader, set it as the input's default value**

```tsx filename=app/routes/root.tsx lines=[7,11,26]
// existing code

export async function loader({ request }: LoaderArg) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const contacts = await getContacts(q);
  return { contacts, q };
}

export default function Root() {
  const { contacts, q } = useLoaderData();
  const navigation = useNavigation();

  return (
    <>
      <div id="sidebar">
        <h1>Remix Contacts</h1>
        <div>
          <Form id="search-form" role="search">
            <input
              id="q"
              aria-label="Search contacts"
              placeholder="Search"
              type="search"
              name="q"
              defaultValue={q || ""}
            />
            {/* existing code */}
          </Form>
          {/* existing code */}
        </div>
        {/* existing code */}
      </div>
      {/* existing code */}
    </>
  );
}
```

The input field will show the query if you refresh the page after a search now.

Now for problem (1), clicking the back button and updating the input. We can bring in `useEffect` from React to manipulate the input's value in the DOM directly.

👉 **Synchronize input value with the URL Search Params**

```tsx filename=app/routes/root.tsx lines=[1,9-14]
import { useEffect } from "react";

// existing code

export default function Root() {
  const navigation = useNavigation();
  const { contacts, q } = useLoaderData();

  useEffect(() => {
    const searchField = document.getElementById("q");
    if (searchField instanceof HTMLInputElement) {
      searchField.value = q || "";
    }
  }, [q]);

  // existing code
}
```

> 🤔 Shouldn't you use a controlled component and React State for this?

You could certainly do this as a controlled component. You will have more synchronization points but it's up to you.

<details>
<summary>Expand this to see what it would look like</summary>

```jsx filename=app/routes/root.tsx lines=[9,13-15,30,32-34]
import { useEffect, useState } from "react";
// existing code

export default function Root() {
  const navigation = useNavigation();
  const { contacts, q } = useLoaderData();

  // the query now needs to be kept in state
  const [query, setQuery] = useState(q);

  // we still have a `useEffect` to synchronize the query
  // to the component state on back/forward button clicks
  useEffect(() => {
    setQuery(q);
  }, [q]);

  return (
    <>
      <div id="sidebar">
        <h1>Remix Contacts</h1>
        <div>
          <Form id="search-form" role="search">
            <input
              id="q"
              aria-label="Search contacts"
              placeholder="Search"
              type="search"
              name="q"
              // switched to `value` from `defaultValue`
              value={query}
              // synchronize user's input to component state
              onChange={(e) => {
                setQuery(e.target.value);
              }}
            />
            {/* existing code */}
          </Form>
          {/* existing code */}
        </div>
        {/* existing code */}
      </div>
    </>
  );
}
```

</details>

Alright, you should now be able to click the back/forward/refresh buttons and the input's value should be in sync with the URL and results.

## Submitting Forms `onChange`

We've got a product decision to make here. Sometimes you want the user to submit the form to filter some results, other times you want to filter as the user types. We've already implemented the first, so let's see what it's like for the second.

We've seen `useNavigate` already, we'll use its cousin, [`useSubmit`][usesubmit], for this.

```tsx filename=src/routes/root.tsx lines=[4,10,25-27]
// existing code
import {
  // existing code
  useSubmit,
} from "@remix-run/react";

export default function Root() {
  const navigation = useNavigation();
  const { contacts, q } = useLoaderData();
  const submit = useSubmit();

  return (
    <>
      <div id="sidebar">
        <h1>Remix Contacts</h1>
        <div>
          <Form id="search-form" role="search">
            <input
              id="q"
              aria-label="Search contacts"
              placeholder="Search"
              type="search"
              name="q"
              defaultValue={q}
              onChange={(event) => {
                submit(event.currentTarget.form);
              }}
            />
            {/* existing code */}
          </Form>
          {/* existing code */}
        </div>
        {/* existing code */}
      </div>
      {/* existing code */}
    </>
  );
}
```

As you type, the form is automatically submitted now!

Note the argument to [`submit`][usesubmit]. The `submit` function will serialize and submit any form you pass to it. We're passing in `event.currentTarget.form`. The `currentTarget` is the DOM node the event is attached to (the input), and the `currentTarget.form` is the form the input belongs to.

## Adding Search Spinner

In a production app, it's likely this search will be looking for records in a database that is too large to send all at once and filter client side. That's why this demo has some faked network latency.

Without any loading indicator, the search feels kinda sluggish. Even if we could make our database faster, we'll always have the user's network latency in the way and out of our control.

For a better user experience, let's add some immediate UI feedback for the search. We'll use [`useNavigation`][usenavigation] again.

👉 **Add a variable to know if we're searching**

```tsx filename=app/routes/root.tsx lines=[8-10,27]
// existing code

export default function Root() {
  const navigation = useNavigation();
  const { contacts, q } = useLoaderData();
  const submit = useSubmit();

  const searching =
    navigation.location &&
    new URLSearchParams(navigation.location.search).has(
      "q"
    );

  // existing code
}
```

When nothing is happening, `navigation.location` will be `undefined`, but when the user navigates it will be populated with the next location while data loads. Then we check if they're searching with `location.search`.

👉 **Add classes to search form elements using the state**

```tsx filename=app/routes/root.tsx lines=[3,14]
<Form id="search-form" role="search">
  <input
    className={searching ? "loading" : ""}
    id="q"
    aria-label="Search contacts"
    placeholder="Search"
    type="search"
    name="q"
    defaultValue={q || ""}
    onChange={(event) => {
      submit(event.currentTarget.form);
    }}
  />
  <div
    id="search-spinner"
    aria-hidden
    hidden={!searching}
  />
</Form>
```

Bonus points, avoid fading out the main screen when searching:

```tsx filename=app/routes/root.tsx
<div
  id="detail"
  className={
    navigation.state === "loading" && !searching
      ? "loading"
      : ""
  }
>
  <Outlet />
</div>
```

You should now have a nice spinner on the left side of the search input.

<img class="tutorial" loading="lazy" src="/docs-images/contacts/20.webp" />

## Managing the History Stack

Since the form is submitted for every key stroke, typing the characters "alex" and then deleting them with backspace results in a huge history stack 😂. We definitely don't want this:

<img class="tutorial" loading="lazy" src="/docs-images/contacts/21.webp" />

We can avoid this by _replacing_ the current entry in the history stack with the next page, instead of pushing into it.

👉 **Use `replace` in `submit`**

```tsx filename=app/routes/root.tsx lines=[6-9]
<Form id="search-form" role="search">
  <input
    id="q"
    // existing code
    onChange={(event) => {
      const isFirstSearch = q == null;
      submit(event.currentTarget.form, {
        replace: !isFirstSearch,
      });
    }}
  />
  {/* existing code */}
</Form>
```

After a quick check if this is the first search or not, we decide to replace. Now the first search will add a new entry, but every keystroke after that will replace the current entry. Instead of clicking back 7 times to remove the search, users only have to click back once.

## Forms Without Navigation

So far all of our forms have changed the URL. While these user flows are common, it's equally as common to want to submit a form _without_ causing a navigation.

For these cases, we have [`useFetcher`][usefetcher]. It allows us to communicate with loaders and actions without causing a navigation.

The ★ button on the contact page makes sense for this. We aren't creating or deleting a new record and we don't want to change pages. We simply want to change the data on the page we're looking at.

👉 **Change the `<Favorite>` form to a fetcher form**

```tsx filename=app/routes/contacts.$contactId.edit.tsx lines=[1,6,10,20]
import {
  useLoaderData,
  Form,
  useFetcher,
} from "@remix-run/react";

// existing code

function Favorite({ contact }: { contact: ContactRecord }) {
  const fetcher = useFetcher();
  const favorite = contact.favorite;

  return (
    <fetcher.Form method="post">
      <button
        name="favorite"
        value={favorite ? "false" : "true"}
        aria-label={
          favorite
            ? "Remove from favorites"
            : "Add to favorites"
        }
      >
        {favorite ? "★" : "☆"}
      </button>
    </fetcher.Form>
  );
}
```

This form will no longer cause a navigation, but simply fetch to the our action. Speaking of which ... this won't work until we create the action.

👉 **Create the action**

```tsx filename=app/routes/contacts.$contactId.tsx
// existing code
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node";

import { getContact, updateContact } from "../data";

export async function action({
  request,
  params,
}: ActionArgs) {
  invariant(params.contactId, "Missing contactId param");
  const formData = await request.formData();
  return updateContact(params.contactId, {
    favorite: formData.get("favorite") === "true",
  });
}
```

Alright, we're ready to click the star next to the user's name!

<img class="tutorial" loading="lazy" src="/docs-images/contacts/22.webp" />

Check that out, both stars automatically update. Our new `<fetcher.Form method="post">` works almost exactly like a the `<Form>` we've been using: it calls the action and then all data is revalidated automatically--even your errors will be caught the same way.

There is one key difference though, it's not a navigation, so the URL doesn't change and the history stack is unaffected.

## Optimistic UI

You probably noticed the app felt kind of unresponsive when we clicked the the favorite button from the last section. Once again, we added some network latency because you're going to have it in the real world.

To give the user some feedback, we could put the star into a loading state with [`fetcher.state`][fetcherstate] (a lot like `navigation.state` from before), but we can do something even better this time. We can use a strategy called "Optimistic UI"

The fetcher knows the form data being submitted to the action, so it's available to you on `fetcher.formData`. We'll use that to immediately update the star's state, even though the network hasn't finished. If the update eventually fails, the UI will revert to the real data.

👉 **Read the optimistic value from `fetcher.formData`**

```tsx filename=app/routes/contacts.$contactId.tsx lines=[7-9]
// existing code

function Favorite({ contact }: { contact: ContactRecord }) {
  const fetcher = useFetcher();

  let favorite = contact.favorite;
  if (fetcher.formData) {
    favorite = fetcher.formData.get("favorite") === "true";
  }

  return (
    <fetcher.Form method="post">
      <button
        name="favorite"
        value={favorite ? "false" : "true"}
        aria-label={
          favorite
            ? "Remove from favorites"
            : "Add to favorites"
        }
      >
        {favorite ? "★" : "☆"}
      </button>
    </fetcher.Form>
  );
}
```

Now the star _immediately_ changes to the new state when you click it.

---

That's it! Thanks for giving Remix a shot. We hope this tutorial gives you a solid start to build great user experiences. There's a lot more you can do, so make sure to check out all the APIs 😀

[vite]: https://vitejs.dev/guide/
[node]: https://nodejs.org
[createbrowserrouter]: ../routers/create-browser-router
[route]: ../route/route
[tutorial-css]: https://gist.githubusercontent.com/ryanflorence/ba20d473ef59e1965543fa013ae4163f/raw/499707f25a5690d490c7b3d54c65c65eb895930c/react-router-6.4-tutorial-css.css
[tutorial-data]: https://gist.githubusercontent.com/ryanflorence/1e7f5d3344c0db4a8394292c157cd305/raw/f7ff21e9ae7ffd55bfaaaf320e09c6a08a8a6611/contacts.js
[routeelement]: ../route/route#element
[jim]: https://blog.jim-nielsen.com/
[errorelement]: ../route/error-element
[userouteerror]: ../hooks/use-route-error
[isrouteerrorresponse]: ../utils/is-route-error-response
[outlet]: ../components/outlet
[link]: ../components/link
[setup]: #setup
[loader]: ../route/loader
[useloaderdata]: ../hooks/use-loader-data
[action]: ../route/action
[params]: ../route/loader#params
[form]: ../components/form
[request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[formdata]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
[fromentries]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
[requestformdata]: https://developer.mozilla.org/en-US/docs/Web/API/Request/formData
[response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[redirect]: ../fetch/redirect
[returningresponses]: ../route/loader#returning-responses
[usenavigation]: ../hooks/use-navigation
[index]: ../route/route#index
[path]: ../route/route#path
[usenavigate]: ../hooks/use-navigate
[uselocation]: ../hooks/use-location
[urlsearchparams]: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
[usesubmit]: ../hooks/use-submit
[navlink]: ../components/nav-link
[usefetcher]: ../hooks/use-fetcher
[fetcherstate]: ../hooks/use-fetcher#fetcherstate
[assetbuilddir]: ../file-conventions/remix-config#assetsbuilddirectory
[links]: ../route/links
[notfound]: ../guides/not-found
[routeconvention]: ../file-conventions/route-files-v2
[quickstart]: ./quickstart
