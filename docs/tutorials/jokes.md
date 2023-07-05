---
title: App Tutorial (long)
order: 4
---

# Jokes App Tutorial

You want to learn Remix? You're in the right place. Let's build [Remix Jokes][remix-jokes]!

<docs-info><a target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/watch?v=hsIWJpuxNj0">Work through this tutorial with Kent in this live stream</a></docs-info>

<a href="https://remix-jokes.lol"><img src="https://remix-jokes.lol/social.png" style="aspect-ratio: 300 / 157; width: 100%"/></a>

This tutorial is the comprehensive way to getting an overview of the primary APIs available in Remix. By the end, you'll have a full application you can show your mom, significant other, or dog, and I'm sure they'll be just as excited about Remix as you are (though I make no guarantees).

We're going to be laser focused on Remix. This means that we're going to skip over a few things that are a distraction from the core ideas we want you to learn about Remix. For example, we'll show you how to get a CSS stylesheet on the page, but we're not going to make you write the styles by yourself. So we'll just give you stuff you can copy/paste for that kind of thing. However, if you'd prefer to write it all out yourself, you totally can (it'll just take you much longer). So we'll put it in little `<details>` elements you have to click to expand to not spoil anything if you'd prefer to code it out yourself.

<details>

<summary>Click me</summary>

There are several areas in the tutorial where we stick code behind one of these `<details>` elements. This is so you can choose how much copy/paste you want to do without us spoiling it for you. We don't recommend struggling with concepts unrelated to Remix though, like guessing what class names to use. Feel free to reference these sections to check your work once you get the main point of the tutorial. Or if you want to run through things quickly then you can just copy/paste stuff as you go as well. We won't judge you!

</details>

We'll be linking to various docs (Remix docs as well as web docs on [MDN][mdn]) throughout the tutorial (if you don't already use MDN, you'll find yourself using it a _lot_ with Remix, and getting better at the web while you're at it). If you're ever stuck, make sure you check into any docs links you may have skipped. Part of the goal of this tutorial is to get you acclimated to the Remix and web API documentation, so if something's explained in the docs, then you'll be linked to those instead of rehashing it all out in here.

This tutorial will be using TypeScript. Feel free to follow along and skip/remove the TypeScript bits. We find that Remix is made even better when you're using TypeScript, especially since we'll also be using [Prisma][prisma] to access our data models from the SQLite database.

<docs-info>💿 Hello, I'm Rachel the Remix Disc. I'll show up whenever you have to actually _do_ something.</docs-info>

<docs-warning>Feel free to explore as you go, but if you deviate from the tutorial too much (like trying to deploy before getting to that step for example), you may find it doesn't work like you expected because you missed something important.</docs-warning>

<docs-error>We won't add JavaScript to the browser until toward the end of the tutorial. This is to show you how well your application will work when JavaScript takes a long time to load (or fails to load at all). So until we actually add JavaScript to the page, you won't be able to use things like `useState` until we get to that step.</docs-error>

## Outline

Here are the topics we'll be covering in this tutorial:

- Generating a new Remix project
- Conventional files
- Routes (including the nested variety ✨)
- Styling
- Database interactions (via `sqlite` and `prisma`)
- Mutations
- Validation
- Authentication
- Error handling: Both unexpected (the dev made a whoopsies) and expected (the end-user made a whoopsies) errors
- SEO with Meta Tags
- JavaScript...
- Resource Routes
- Deployment

You'll find links to the sections of the tutorial in the navbar (top of the page for mobile and to the right for desktop).

## Prerequisites

You can follow along with this tutorial on [CodeSandbox][code-sandbox] (a fantastic in-browser editor) or locally on your own computer. If you use the CodeSandbox approach then all you need is a good internet connection and a modern browser. If you run things locally then you're going to need some things installed:

- [Node.js][node-js] version (^14.17.0, or >=16.0.0)
- [npm][npm] 7 or greater
- A code editor ([VSCode][vs-code] is a nice one)

If you'd like to follow along with the deploy step at the end, you'll also want an account on [Fly.io][fly-io].

We'll also be executing commands in your system command line/terminal interface. So you'll want to be familiar with that.

Some experience with React and TypeScript/JavaScript is assumed. If you'd like to review your knowledge, check out these resources:

- [JavaScript to know for React][java-script-to-know-for-react]
- [The Beginner's Guide to React][the-beginner-s-guide-to-react]

And having a good understanding of [the HTTP API][the-http-api] is also helpful, but not totally required.

With that, I think we're ready to get started!

## Generating a new Remix project

<docs-info>

If you're planning on using CodeSandbox, you can use [the Basic example][the-basic-example] to get started.

</docs-info>

💿 Open your terminal and run this command:

```sh
npx create-remix@latest
```

<docs-info>

This may ask you whether you want to install `create-remix@latest`. Enter `y`. It will only be installed the first time to run the setup script.

</docs-info>

Once the setup script has run, it'll ask you a few questions. We'll call our app "remix-jokes", choose "Just the basics", then the "Remix App Server" deploy target, use TypeScript, and have it run the installation for us:

```
? Where would you like to create your app? remix-jokes
? What type of app do you want to create? Just the basics
? Where do you want to deploy? Choose Remix App Server if you're unsure; it's easy to change deployment targets. Remix App Server
? TypeScript or JavaScript? TypeScript
? Do you want me to run `npm install`? Yes
```

Remix can be deployed in a large and growing list of JavaScript environments. The "Remix App Server" is a full-featured [Node.js][node-js] server based on [Express][express]. It's the simplest option, and it satisfies most people's needs, so that's what we're going with for this tutorial. Feel free to experiment in the future!

Once the `npm install` has completed, we'll change into the `remix-jokes` directory:

💿 Run this command

```sh
cd remix-jokes
```

Now you're in the `remix-jokes` directory. All other commands you run from here on out will be in that directory.

💿 Great, now open that up in your favorite editor and let's explore the project structure a bit.

## Explore the project structure

Here's the tree structure. Hopefully what you've got looks a bit like this:

```
remix-jokes
├── README.md
├── app
│   ├── entry.client.tsx
│   ├── entry.server.tsx
│   ├── root.tsx
│   └── routes
│       └── _index.tsx
├── package-lock.json
├── package.json
├── public
│   └── favicon.ico
├── remix.config.js
├── remix.env.d.ts
└── tsconfig.json
```

Let's talk briefly about a few of these files:

- `app/` - This is where all your Remix app code goes
- `app/entry.client.tsx` - This is the first bit of your JavaScript that will run when the app loads in the browser. We use this file to [hydrate][hydrate] our React components.
- `app/entry.server.tsx` - This is the first bit of your JavaScript that will run when a request hits your server. Remix handles loading all the necessary data, and you're responsible for sending back the response. We'll use this file to render our React app to a string/stream and send that as our response to the client.
- `app/root.tsx` - This is where we put the root component for our application. You render the `<html>` element here.
- `app/routes/` - This is where all your "route modules" will go. Remix uses the files in this directory to create the URL routes for your app based on the name of the files.
- `public/` - This is where your static assets go (images/fonts/etc)
- `remix.config.js` - Remix has a handful of configuration options you can set in this file.

💿 Let's go ahead and run the build:

```sh
npm run build
```

That should output something like this:

```
Building Remix app in production mode...
Built in 132ms
```

Now you should also have a `.cache/` directory (something used internally by Remix), a `build/` directory, and a `public/build` directory. The `build/` directory is our server-side code. The `public/build/` holds all our client-side code. These three directories are listed in your `.gitignore` file, so you don't commit the generated files to source control.

💿 Let's run the built app now:

```sh
npm start
```

This will start the server and output this:

```
Remix App Server started at http://localhost:3000
```

Open up that URL and you should be presented with a minimal page pointing to some docs.

💿 Now stop the server and delete this directory:

- `app/routes`

We're going to trim this down the bare bones and introduce things incrementally.

💿 Replace the contents of `app/root.tsx` with this:

```tsx filename=app/root.tsx
import { LiveReload } from "@remix-run/react";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <title>Remix: So great, it's funny!</title>
      </head>
      <body>
        Hello world
        <LiveReload />
      </body>
    </html>
  );
}
```

<docs-info>

The `<LiveReload />` component is useful during development to auto-refresh our browser whenever we make a change. Because our build server is so fast, the reload will often happen before you even notice ⚡

</docs-info>

Your `app/` directory should now look like this:

```
app
├── entry.client.tsx
├── entry.server.tsx
└── root.tsx
```

💿 With that set up, go ahead and start the dev server up with this command:

```sh
npm run dev
```

Open [http://localhost:3000][http-localhost-3000] and the app should greet the world:

![Bare bones hello world app][bare-bones-hello-world-app]

Great, now we're ready to start adding stuff back.

## Routes

The first thing we want to do is get our routing structure set up. Here are all the routes our app is going to have:

```
/
/jokes
/jokes/:jokeId
/jokes/new
/login
```

You can programmatically create routes via the [`remix.config.js`][remix-config-js], but the more common way to create the routes is through the file system. This is called "file-based routing."

Each file we put in the `app/routes` directory is called a Route Module and by following [the route filename convention][the-route-filename-convention], we can create the routing URL structure we're looking for. Remix uses [React Router][react-router] under the hood to handle this routing.

💿 Let's start with the index route (`/`). To do that, create a file at `app/routes/_index.tsx` and `export default` a component from that route module. For now, you can have it just say "Hello Index Route" or something.

<details>

<summary>app/routes/_index.tsx</summary>

```tsx filename=app/routes/_index.tsx
export default function IndexRoute() {
  return <div>Hello Index Route</div>;
}
```

</details>

React Router supports "nested routing" which means we have parent-child relationships in our routes. The `app/routes/_index.tsx` is a child of the `app/root.tsx` route. In nested routing, parents are responsible for laying out their children.

💿 Update the `app/root.tsx` to position children. You'll do this with the `<Outlet />` component from `@remix-run/react`:

<details>

<summary>app/root.tsx</summary>

```tsx filename=app/root.tsx lines=[1,15]
import { LiveReload, Outlet } from "@remix-run/react";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <title>Remix: So great, it's funny!</title>
      </head>
      <body>
        <Outlet />
        <LiveReload />
      </body>
    </html>
  );
}
```

</details>

<docs-info>Remember to have the dev server running with `npm run dev`</docs-info>

That will watch your filesystem for changes, rebuild the site, and thanks to the `<LiveReload />` component your browser will refresh.

💿 Go ahead and open up the site again, and you should be presented with the greeting from the index route.

![A greeting from the index route][a-greeting-from-the-index-route]

Great! Next let's handle the `/jokes` route.

💿 Create a new route at `app/routes/jokes.tsx` (keep in mind that this will be a parent route, so you'll want to use `<Outlet />` again).

<details>

<summary>app/routes/jokes.tsx</summary>

```tsx filename=app/routes/jokes.tsx
import { Outlet } from "@remix-run/react";

export default function JokesRoute() {
  return (
    <div>
      <h1>J🤪KES</h1>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

</details>

You should be presented with that component when you go to [`/jokes`][jokes]. Now, in that `<Outlet />` we want to render out some random jokes in the "index route".

💿 Create a route at `app/routes/jokes._index.tsx`

<details>

<summary>app/routes/jokes._index.tsx</summary>

```tsx filename=app/routes/jokes._index.tsx
export default function JokesIndexRoute() {
  return (
    <div>
      <p>Here's a random joke:</p>
      <p>
        I was wondering why the frisbee was getting bigger,
        then it hit me.
      </p>
    </div>
  );
}
```

</details>

Now if you refresh [`/jokes`][jokes], you'll get the content in the `app/routes/jokes.tsx` as well as the `app/routes/jokes._index.tsx`. Here's what mine looks like:

![A random joke on the jokes page: "I was wondering why the frisbee was getting bigger, then it hit me"][a-random-joke-on-the-jokes-page-i-was-wondering-why-the-frisbee-was-getting-bigger-then-it-hit-me]

And notice that each of those route modules is only concerned with their part of the URL. Neat right!? Nested routing is pretty nice, and we're only just getting started. Let's keep going.

💿 Next, let's handle the `/jokes/new` route. I'll bet you can figure out how to do that 😄. Remember we're going to allow people to create jokes on this page, so you'll want to render a `form` with `name` and `content` fields.

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx
export default function NewJokeRoute() {
  return (
    <div>
      <p>Add your own hilarious joke</p>
      <form method="post">
        <div>
          <label>
            Name: <input type="text" name="name" />
          </label>
        </div>
        <div>
          <label>
            Content: <textarea name="content" />
          </label>
        </div>
        <div>
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
```

</details>

Great, so now going to [`/jokes/new`][jokes-new] should display your form:

![A new joke form][a-new-joke-form]

### Parameterized Routes

Soon we'll add a database that stores our jokes by an ID, so let's add one more route that's a little more unique, a parameterized route:

`/jokes/$jokeId`

Here the parameter `$jokeId` can be anything, and we can look up that part of the URL in the database to display the right joke. To make a parameterized route, we use the `$` character in the filename. ([Read more about the convention here][the-route-filename-convention]).

💿 Create a new route at `app/routes/jokes.$jokeId.tsx`. Don't worry too much about what it displays for now (we don't have a database set up yet!):

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx
export default function JokeRoute() {
  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>
        Why don't you find hippopotamuses hiding in trees?
        They're really good at it.
      </p>
    </div>
  );
}
```

</details>

Great, so now going to [`/jokes/anything-you-want`][jokes-anything-you-want] should display what you just created (in addition to the parent routes):

![A new joke form][a-new-joke-form-2]

Great! We've got our primary routes all set up!

## Styling

From the beginning of styling on the web, to get CSS on the page, we've used `<link rel="stylesheet" href="/path-to-file.css" />`. This is how you style your Remix applications as well, but Remix makes it much easier than just throwing `link` tags all over the place. Remix brings the power of its Nested Routing support to CSS and allows you to associate `link` tags to routes. When the route is active, the `link` tag is on the page and the CSS applies. When the route is not active (the user navigates away), the `link` tag is removed and the CSS no longer applies.

You do this by exporting a [`links`][links] function in your route module. Let's get the homepage styled. You can put your CSS files anywhere you like within the `app` directory. We'll put ours in `app/styles/`.

We'll start off by just styling the home page (the index route `/`).

💿 Create `app/styles/index.css` and stick this CSS in it:

```css
body {
  color: hsl(0, 0%, 100%);
  background-image: radial-gradient(
    circle,
    rgba(152, 11, 238, 1) 0%,
    rgba(118, 15, 181, 1) 35%,
    rgba(58, 13, 85, 1) 100%
  );
}
```

💿 Now update `app/routes/_index.tsx` to import that css file. Then add a `links` export (as described in [the documentation][links]) to add that link to the page.

<details>

<summary>app/routes/_index.tsx</summary>

```tsx filename=app/routes/_index.tsx lines=[1,3,5-7]
import type { LinksFunction } from "@remix-run/node";

import stylesUrl from "~/styles/index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function IndexRoute() {
  return <div>Hello Index Route</div>;
}
```

</details>

Now if you go to [`/`][http-localhost-3000] you may be a bit disappointed. Our beautiful styles aren't applied! Well, you may recall that in the `app/root.tsx` we're the ones rendering _everything_ about our app. From the `<html>` to the `</html>`. That means if something doesn't show up in there, it's not going to show up at all!

So we need some way to get the `link` exports from all active routes and add `<link />` tags for all of them. Luckily, Remix makes this easy for us by providing a convenience [`<Links />`][links-2] component.

💿 Go ahead and add the Remix `<Links />` component to `app/root.tsx` within the `<head>`.

<details>

<summary>app/root.tsx</summary>

```tsx filename=app/root.tsx lines=[2,17]
import {
  Links,
  LiveReload,
  Outlet,
} from "@remix-run/react";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <title>Remix: So great, it's funny!</title>
        <Links />
      </head>
      <body>
        <Outlet />
        <LiveReload />
      </body>
    </html>
  );
}
```

</details>

Great, now check [`/`][http-localhost-3000] again, and it should be nice and styled for you:

![The homepage with a purple gradient background and white text with the words "Hello Index Route"][the-homepage-with-a-purple-gradient-background-and-white-text-with-the-words-hello-index-route]

Hooray! But I want to call out something important and exciting. You know how the CSS we wrote styles the `body` element? What would you expect to happen on the [`/jokes`][jokes] route? Go ahead and check it out.

![The jokes page with no background gradient][the-jokes-page-with-no-background-gradient]

🤯 What is this? Why aren't the CSS rules applied? Did the `body` get removed or something?! Nope. If you open the Elements tab of the dev tools you'll notice that the link tag isn't there at all!

<docs-info>

This means that you don't have to worry about unexpected CSS clashes when you're writing your CSS. You can write whatever you like and so long as you check each route your file is linked on you'll know that you haven't impacted other pages! 🔥

This also means your CSS files can be cached long-term and your CSS is naturally code-split. Performance FTW ⚡

</docs-info>

That's pretty much all there is to it for styling with the tutorial. The rest is just writing the CSS which you're welcome to do if you want, or simply copy the styles from below.

<details>

<summary>💿 Copy this to `app/styles/global.css`</summary>

```css filename=app/styles/global.css
@font-face {
  font-family: "baloo";
  src: url("/fonts/baloo/baloo.woff") format("woff");
  font-weight: normal;
  font-style: normal;
}

:root {
  --hs-links: 48 100%;
  --color-foreground: hsl(0, 0%, 100%);
  --color-background: hsl(278, 73%, 19%);
  --color-links: hsl(var(--hs-links) 50%);
  --color-links-hover: hsl(var(--hs-links) 45%);
  --color-border: hsl(277, 85%, 38%);
  --color-invalid: hsl(356, 100%, 71%);
  --gradient-background: radial-gradient(
    circle,
    rgba(152, 11, 238, 1) 0%,
    rgba(118, 15, 181, 1) 35%,
    rgba(58, 13, 85, 1) 100%
  );
  --font-body: -apple-system, "Segoe UI", Helvetica Neue, Helvetica,
    Roboto, Arial, sans-serif, system-ui, "Apple Color Emoji",
    "Segoe UI Emoji";
  --font-display: baloo, var(--font-body);
}

html {
  box-sizing: border-box;
}

*,
*::before,
*::after {
  box-sizing: inherit;
}

:-moz-focusring {
  outline: auto;
}

:focus {
  outline: var(--color-links) solid 2px;
  outline-offset: 2px;
}

html,
body {
  padding: 0;
  margin: 0;
  color: var(--color-foreground);
  background-color: var(--color-background);
}

[data-light] {
  --color-invalid: hsl(356, 70%, 39%);
  color: var(--color-background);
  background-color: var(--color-foreground);
}

body {
  font-family: var(--font-body);
  line-height: 1.5;
  background-repeat: no-repeat;
  min-height: 100vh;
  min-height: calc(100vh - env(safe-area-inset-bottom));
}

a {
  color: var(--color-links);
  text-decoration: none;
}

a:hover {
  color: var(--color-links-hover);
  text-decoration: underline;
}

hr {
  display: block;
  height: 1px;
  border: 0;
  background-color: var(--color-border);
  margin-top: 2rem;
  margin-bottom: 2rem;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(--font-display);
  margin: 0;
}

h1 {
  font-size: 2.25rem;
  line-height: 2.5rem;
}

h2 {
  font-size: 1.5rem;
  line-height: 2rem;
}

h3 {
  font-size: 1.25rem;
  line-height: 1.75rem;
}

h4 {
  font-size: 1.125rem;
  line-height: 1.75rem;
}

h5,
h6 {
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.container {
  --gutter: 16px;
  width: 1024px;
  max-width: calc(100% - var(--gutter) * 2);
  margin-right: auto;
  margin-left: auto;
}

/* buttons */

.button {
  --shadow-color: hsl(var(--hs-links) 30%);
  --shadow-size: 3px;
  -webkit-appearance: none;
  -moz-appearance: none;
  cursor: pointer;
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-links);
  color: var(--color-background);
  font-family: var(--font-display);
  font-weight: bold;
  line-height: 1;
  font-size: 1.125rem;
  margin: 0;
  padding: 0.625em 1em;
  border: 0;
  border-radius: 4px;
  box-shadow: 0 var(--shadow-size) 0 0 var(--shadow-color);
  outline-offset: 2px;
  transform: translateY(0);
  transition: background-color 50ms ease-out, box-shadow
      50ms ease-out,
    transform 100ms cubic-bezier(0.3, 0.6, 0.8, 1.25);
}

.button:hover {
  --raise: 1px;
  color: var(--color-background);
  text-decoration: none;
  box-shadow: 0 calc(var(--shadow-size) + var(--raise)) 0 0 var(
      --shadow-color
    );
  transform: translateY(calc(var(--raise) * -1));
}

.button:active {
  --press: 1px;
  box-shadow: 0 calc(var(--shadow-size) - var(--press)) 0 0 var(
      --shadow-color
    );
  transform: translateY(var(--press));
  background-color: var(--color-links-hover);
}

.button[disabled],
.button[aria-disabled="true"] {
  transform: translateY(0);
  pointer-events: none;
  opacity: 0.7;
}

.button:focus:not(:focus-visible) {
  outline: none;
}

/* forms */

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  display: block;
  max-width: 100%;
  margin-bottom: 0.5rem;
  color: inherit;
  white-space: normal;
}

[type="text"],
[type="password"],
[type="date"],
[type="datetime"],
[type="datetime-local"],
[type="month"],
[type="week"],
[type="email"],
[type="number"],
[type="search"],
[type="tel"],
[type="time"],
[type="url"],
[type="color"],
textarea {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  display: block;
  display: flex;
  align-items: center;
  width: 100%;
  height: 2.5rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: hsl(0 0% 100% / 10%);
  background-blend-mode: luminosity;
  box-shadow: none;
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: normal;
  line-height: 1.5;
  color: var(--color-foreground);
  transition: box-shadow 200ms, border-color 50ms ease-out,
    background-color 50ms ease-out, color 50ms ease-out;
}

[data-light] [type="text"],
[data-light] [type="password"],
[data-light] [type="date"],
[data-light] [type="datetime"],
[data-light] [type="datetime-local"],
[data-light] [type="month"],
[data-light] [type="week"],
[data-light] [type="email"],
[data-light] [type="number"],
[data-light] [type="search"],
[data-light] [type="tel"],
[data-light] [type="time"],
[data-light] [type="url"],
[data-light] [type="color"],
[data-light] textarea {
  color: var(--color-background);
  background-color: hsl(0 0% 0% / 10%);
}

[type="text"][aria-invalid="true"],
[type="password"][aria-invalid="true"],
[type="date"][aria-invalid="true"],
[type="datetime"][aria-invalid="true"],
[type="datetime-local"][aria-invalid="true"],
[type="month"][aria-invalid="true"],
[type="week"][aria-invalid="true"],
[type="email"][aria-invalid="true"],
[type="number"][aria-invalid="true"],
[type="search"][aria-invalid="true"],
[type="tel"][aria-invalid="true"],
[type="time"][aria-invalid="true"],
[type="url"][aria-invalid="true"],
[type="color"][aria-invalid="true"],
textarea[aria-invalid="true"] {
  border-color: var(--color-invalid);
}

textarea {
  display: block;
  min-height: 50px;
  max-width: 100%;
}

textarea[rows] {
  height: auto;
}

input:disabled,
input[readonly],
textarea:disabled,
textarea[readonly] {
  opacity: 0.7;
  cursor: not-allowed;
}

[type="file"],
[type="checkbox"],
[type="radio"] {
  margin: 0;
}

[type="file"] {
  width: 100%;
}

label {
  margin: 0;
}

[type="checkbox"] + label,
[type="radio"] + label {
  margin-left: 0.5rem;
}

label > [type="checkbox"],
label > [type="radio"] {
  margin-right: 0.5rem;
}

::placeholder {
  color: hsl(0 0% 100% / 65%);
}

.form-validation-error {
  margin: 0;
  margin-top: 0.25em;
  color: var(--color-invalid);
  font-size: 0.8rem;
}

.error-container {
  background-color: hsla(356, 77%, 59%, 0.747);
  border-radius: 0.25rem;
  padding: 0.5rem 1rem;
}
```

</details>

<details>

<summary>💿 Copy this to `app/styles/global-large.css`</summary>

```css filename=app/styles/global-large.css
h1 {
  font-size: 3.75rem;
  line-height: 1;
}

h2 {
  font-size: 1.875rem;
  line-height: 2.25rem;
}

h3 {
  font-size: 1.5rem;
  line-height: 2rem;
}

h4 {
  font-size: 1.25rem;
  line-height: 1.75rem;
}

h5 {
  font-size: 1.125rem;
  line-height: 1.75rem;
}
```

</details>

<details>

<summary>💿 Copy this to `app/styles/global-medium.css`</summary>

```css filename=app/styles/global-medium.css
h1 {
  font-size: 3rem;
  line-height: 1;
}

h2 {
  font-size: 2.25rem;
  line-height: 2.5rem;
}

h3 {
  font-size: 1.25rem;
  line-height: 1.75rem;
}

h4 {
  font-size: 1.125rem;
  line-height: 1.75rem;
}

h5,
h6 {
  font-size: 1rem;
  line-height: 1.5rem;
}

.container {
  --gutter: 40px;
}
```

</details>

<details>

<summary>💿 Copy this to `app/styles/index.css`</summary>

```css filename=app/styles/index.css
/*
 * when the user visits this page, this style will apply, when they leave, it
 * will get unloaded, so don't worry so much about conflicting styles between
 * pages!
 */

body {
  background-image: var(--gradient-background);
}

.container {
  min-height: inherit;
}

.container,
.content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.content {
  padding-top: 3rem;
  padding-bottom: 3rem;
}

h1 {
  margin: 0;
  text-shadow: 0 3px 0 rgba(0, 0, 0, 0.75);
  text-align: center;
  line-height: 0.5;
}

h1 span {
  display: block;
  font-size: 4.5rem;
  line-height: 1;
  text-transform: uppercase;
  text-shadow: 0 0.2em 0.5em rgba(0, 0, 0, 0.5), 0 5px 0
      rgba(0, 0, 0, 0.75);
}

nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 1rem;
  font-family: var(--font-display);
  font-size: 1.125rem;
  line-height: 1;
}

nav ul a:hover {
  text-decoration-style: wavy;
  text-decoration-thickness: 1px;
}

@media print, (min-width: 640px) {
  h1 span {
    font-size: 6rem;
  }

  nav ul {
    font-size: 1.25rem;
    gap: 1.5rem;
  }
}

@media screen and (min-width: 1024px) {
  h1 span {
    font-size: 8rem;
  }
}
```

</details>

<details>

<summary>💿 Copy this to `app/styles/jokes.css`</summary>

```css filename=app/styles/jokes.css
.jokes-layout {
  display: flex;
  flex-direction: column;
  min-height: inherit;
}

.jokes-header {
  padding-top: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.jokes-header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.jokes-header .home-link {
  font-family: var(--font-display);
  font-size: 3rem;
}

.jokes-header .home-link a {
  color: var(--color-foreground);
}

.jokes-header .home-link a:hover {
  text-decoration: none;
}

.jokes-header .logo-medium {
  display: none;
}

.jokes-header a:hover {
  text-decoration-style: wavy;
  text-decoration-thickness: 1px;
}

.jokes-header .user-info {
  display: flex;
  gap: 1rem;
  align-items: center;
  white-space: nowrap;
}

.jokes-main {
  padding-top: 2rem;
  padding-bottom: 2rem;
  flex: 1 1 100%;
}

.jokes-main .container {
  display: flex;
  gap: 1rem;
}

.jokes-list {
  max-width: 12rem;
}

.jokes-outlet {
  flex: 1;
}

.jokes-footer {
  padding-top: 2rem;
  padding-bottom: 1rem;
  border-top: 1px solid var(--color-border);
}

@media print, (min-width: 640px) {
  .jokes-header .logo {
    display: none;
  }

  .jokes-header .logo-medium {
    display: block;
  }

  .jokes-main {
    padding-top: 3rem;
    padding-bottom: 3rem;
  }
}

@media (max-width: 639px) {
  .jokes-main .container {
    flex-direction: column;
  }
}
```

</details>

💿 Also, download <a href="/jokes-tutorial/baloo/baloo.woff" data-noprefetch target="_blank">the font</a> and <a href="/jokes-tutorial/baloo/License.txt" data-noprefetch target="_blank">its license</a> and put them in `public/fonts/baloo`.

💿 While you're downloading assets, you may as well download <a href="/jokes-tutorial/social.png" data-noprefetch target="_blank">the social image</a> and put that at `public/social.png`. You'll need that later.

💿 Add the `links` export to `app/root.tsx` and `app/routes/jokes.tsx` to bring in some CSS to make the page look nice (note: each will have its own CSS file(s)). You can look at the CSS and add some structure to your JSX elements to make things look appealing. I'm going to add some links too.

<docs-info>The `app/root.tsx` will be the one that links to the `global` CSS files. Why do you think the name "global" makes sense for the root route's styles?</docs-info>

The `global-large.css` and `global-medium.css` files are for media query-based CSS.

<docs-info>Did you know that `<link />` tags can use media queries? [Check out the MDN page for `<link />`][check-out-the-mdn-page-for-link].</docs-info>

<details>

<summary>app/root.tsx</summary>

```tsx filename=app/root.tsx lines=[1,8-10,12-24]
import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Outlet,
} from "@remix-run/react";

import globalLargeStylesUrl from "~/styles/global-large.css";
import globalMediumStylesUrl from "~/styles/global-medium.css";
import globalStylesUrl from "~/styles/global.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: globalStylesUrl },
  {
    rel: "stylesheet",
    href: globalMediumStylesUrl,
    media: "print, (min-width: 640px)",
  },
  {
    rel: "stylesheet",
    href: globalLargeStylesUrl,
    media: "screen and (min-width: 1024px)",
  },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <title>Remix: So great, it's funny!</title>
        <Links />
      </head>
      <body>
        <Outlet />
        <LiveReload />
      </body>
    </html>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.tsx</summary>

```tsx filename=app/routes/jokes.tsx lines=[1,4,6-8]
import type { LinksFunction } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";

import stylesUrl from "~/styles/jokes.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function JokesRoute() {
  return (
    <div className="jokes-layout">
      <header className="jokes-header">
        <div className="container">
          <h1 className="home-link">
            <Link
              to="/"
              title="Remix Jokes"
              aria-label="Remix Jokes"
            >
              <span className="logo">🤪</span>
              <span className="logo-medium">J🤪KES</span>
            </Link>
          </h1>
        </div>
      </header>
      <main className="jokes-main">
        <div className="container">
          <div className="jokes-list">
            <Link to=".">Get a random joke</Link>
            <p>Here are a few more jokes to check out:</p>
            <ul>
              <li>
                <Link to="some-joke-id">Hippo</Link>
              </li>
            </ul>
            <Link to="new" className="button">
              Add your own
            </Link>
          </div>
          <div className="jokes-outlet">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
```

</details>

💿 Let's also add a link to the jokes from the homepage and follow some class names in the CSS to make the homepage look nice.

<details>

<summary>app/routes/_index.tsx</summary>

```tsx filename=app/routes/_index.tsx lines=[2,11-26]
import type { LinksFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import stylesUrl from "~/styles/index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function IndexRoute() {
  return (
    <div className="container">
      <div className="content">
        <h1>
          Remix <span>Jokes!</span>
        </h1>
        <nav>
          <ul>
            <li>
              <Link to="jokes">Read Jokes</Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
```

</details>

As we work through the rest of the tutorial, you may want to check the class names in those CSS files, so you can take full advantage of that CSS.

One quick note about CSS. A lot of you folks may be used to using runtime libraries for CSS (like [Styled-Components][styled-components]). While you can use those with Remix, we'd like to encourage you to look into more traditional approaches to CSS. Many of the problems that led to the creation of these styling solutions aren't really problems in Remix, so you can often go with a simpler styling approach.

That said, many Remix users are very happy with [Tailwind CSS][tailwind], and we recommend this approach. Basically, if it can give you a URL (or a CSS file which you can import to get a URL), then it's generally a good approach because Remix can then leverage the browser platform for caching and loading/unloading.

## Database

Most real-world applications require some form of data persistence. In our case, we want to save our jokes to a database so people can laugh at our hilarity and even submit their own (coming soon in the authentication section!).

You can use any persistence solution you like with Remix; [Firebase][firebase], [Supabase][supabase], [Airtable][airtable], [Hasura][hasura], [Google Spreadsheets][google-spreadsheets], [Cloudflare Workers KV][cloudflare-workers-kv], [Fauna][fauna], a custom [PostgreSQL][postgre-sql], or even your backend team's REST/GraphQL APIs. Seriously. Whatever you want.

### Set up Prisma

<docs-info>The Prisma team has built [a VSCode extension][a-vs-code-extension] you might find quite helpful when working on the Prisma schema.</docs-info>

In this tutorial we're going to use our own [SQLite][sq-lite] database. Essentially, it's a database that lives in a file on your computer, is surprisingly capable, and best of all it's supported by [Prisma][prisma], our favorite database ORM! It's a great place to start if you're not sure what database to use.

There are two packages that we need to get started:

- `prisma` for interacting with our database and schema during development.
- `@prisma/client` for making queries to our database during runtime.

💿 Install the Prisma packages:

```sh
npm install --save-dev prisma
npm install @prisma/client
```

💿 Now we can initialize Prisma with SQLite:

```sh
npx prisma init --datasource-provider sqlite
```

That gives us this output:

```
✔ Your Prisma schema was created at prisma/schema.prisma
  You can now open it in your favorite editor.

warn You already have a .gitignore file. Don't forget to add `.env` in it to not commit any private information.

Next steps:
1. Set the DATABASE_URL in the .env file to point to your existing database. If your database has no tables yet, read https://pris.ly/d/getting-started
2. Run prisma db pull to turn your database schema into a Prisma schema.
3. Run prisma generate to generate the Prisma Client. You can then start querying your database.

More information in our documentation:
https://pris.ly/d/getting-started
```

Now that we've got Prisma initialized, we can start modeling our app data. Because this isn't a Prisma tutorial, I'll just hand you that, and you can read more about the Prisma schema from [their docs][their-docs]:

```prisma filename=prisma/schema.prisma lines=[13-19]
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Joke {
  id         String   @id @default(uuid())
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  name       String
  content    String
}
```

💿 With that in place, run this:

```sh
npx prisma db push
```

This command will give you this output:

```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

SQLite database dev.db created at file:./dev.db

🚀  Your database is now in sync with your Prisma schema. Done in 39ms

✔ Generated Prisma Client (4.12.0 | library) to ./node_modules/@prisma/client in 26ms
```

This command did a few things. For one, it created our database file in `prisma/dev.db`. Then it pushed all the necessary changes to our database to match the schema we provided. Finally, it generated Prisma's TypeScript types, so we'll get stellar autocomplete and type checking as we use its API for interacting with our database.

💿 Let's add that `prisma/dev.db` to our `.gitignore` so we don't accidentally commit it to our repository. As mentioned in the Prisma output, we don't want to commit our secrets, so your `.env` file is already added to the `.gitignore` out of the box!

```text filename=.gitignore lines=[8]
node_modules

/.cache
/build
/public/build
.env

/prisma/dev.db
```

<docs-warning>If your database gets messed up, you can always delete the `prisma/dev.db` file and run `npx prisma db push` again. Remember to also restart your dev server with `npm run dev`.</docs-warning>

Next, we're going to write a little file that will "seed" our database with test data. Again, this isn't really remix-specific stuff, so I'll just give this to you (don't worry, we'll get back to remix soon):

💿 Copy this into a new file called `prisma/seed.ts`

```ts filename=prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function seed() {
  await Promise.all(
    getJokes().map((joke) => {
      return db.joke.create({ data: joke });
    })
  );
}

seed();

function getJokes() {
  // shout-out to https://icanhazdadjoke.com/

  return [
    {
      name: "Road worker",
      content: `I never wanted to believe that my Dad was stealing from his job as a road worker. But when I got home, all the signs were there.`,
    },
    {
      name: "Frisbee",
      content: `I was wondering why the frisbee was getting bigger, then it hit me.`,
    },
    {
      name: "Trees",
      content: `Why do trees seem suspicious on sunny days? Dunno, they're just a bit shady.`,
    },
    {
      name: "Skeletons",
      content: `Why don't skeletons ride roller coasters? They don't have the stomach for it.`,
    },
    {
      name: "Hippos",
      content: `Why don't you find hippopotamuses hiding in trees? They're really good at it.`,
    },
    {
      name: "Dinner",
      content: `What did one plate say to the other plate? Dinner is on me!`,
    },
    {
      name: "Elevator",
      content: `My first time using an elevator was an uplifting experience. The second time let me down.`,
    },
  ];
}
```

Feel free to add your own jokes if you like.

Now we just need to run this file. We wrote it in TypeScript to get type safety (this is much more useful as our app and data models grow in complexity). So we'll need a way to run it.

💿 Install `ts-node` and `tsconfig-paths` as dev dependencies:

```sh
npm install --save-dev ts-node tsconfig-paths
```

💿 And now we can run our `seed.ts` file with that:

```sh
npx ts-node --require tsconfig-paths/register prisma/seed.ts
```

Now our database has those jokes in it. No joke!

But I don't want to have to remember to run that script any time I reset the database. Luckily, we don't have to!

💿 Add this to your `package.json`:

```json filename=package.json nocopy
{
  "prisma": {
    "seed": "ts-node --require tsconfig-paths/register prisma/seed.ts"
  }
}
```

Now, whenever we reset the database, Prisma will call our seeding file as well.

### Connect to the database

Ok, one last thing we need to do is connect to the database in our app. We do this at the top of our `prisma/seed.ts` file:

```ts nocopy
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
```

This works just fine, but the problem is, during development, we don't want to close down and completely restart our server every time we make a server-side change. So `@remix-run/serve` actually rebuilds our code and requires it brand new. The problem here is that every time we make a code change, we'll make a new connection to the database and eventually run out of connections! This is such a common problem with database-accessing apps that Prisma has a warning for it:

> Warning: 10 Prisma Clients are already running

So we've got a bit of extra work to do to avoid this development time problem.

Note that this isn't a remix-only problem. Any time you have "live reload" of server code, you're going to have to either disconnect and reconnect to databases (which can be slow) or do the workaround I'm about to show you.

💿 Copy this into a new file called `app/utils/db.server.ts`

```ts filename=app/utils/db.server.ts
import { PrismaClient } from "@prisma/client";

let db: PrismaClient;

declare global {
  var __db__: PrismaClient | undefined;
}

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
// In production, we'll have a single connection to the DB.
if (process.env.NODE_ENV === "production") {
  db = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  db = global.__db__;
  db.$connect();
}

export { db };
```

I'll leave analysis of this code as an exercise for the reader because again, this has nothing to do with Remix directly.

The one thing that I will call out is the file name convention. The `.server` part of the filename informs Remix that this code should never end up in the browser. This is optional, because Remix does a good job of ensuring server code doesn't end up in the client. But sometimes some server-only dependencies are difficult to treeshake, so adding the `.server` to the filename is a hint to the compiler to not worry about this module or its imports when bundling for the browser. The `.server` acts as a sort of boundary for the compiler.

### Read from the database in a Remix loader

Ok, ready to get back to writing Remix code? Me too!

Our goal is to put a list of jokes on the `/jokes` route, so we can have a list of links to jokes people can choose from. In Remix, each route module is responsible for getting its own data. So if we want data on the `/jokes` route, then we'll be updating the `app/routes/jokes.tsx` file.

To _load_ data in a Remix route module, you use a [`loader`][loader]. This is simply an `async` function you export that returns a response, and is accessed on the component through the [`useLoaderData`][use-loader-data] hook. Here's a quick example:

```tsx nocopy
// this is just an example. No need to copy/paste this 😄
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { db } from "~/utils/db.server";

export const loader = async () => {
  return json({
    sandwiches: await db.sandwich.findMany(),
  });
};

export default function Sandwiches() {
  const data = useLoaderData<typeof loader>();
  return (
    <ul>
      {data.sandwiches.map((sandwich) => (
        <li key={sandwich.id}>{sandwich.name}</li>
      ))}
    </ul>
  );
}
```

Does that give you a good idea of what to do here? If not, you can take a look at my solution in the `<details>` below 😄

<docs-info>

Remix and the `tsconfig.json` you get from the starter template are configured to allow imports from the `app/` directory via `~` as demonstrated above, so you don't have `../../` all over the place.

</docs-info>

💿 Update the `app/routes/jokes.tsx` route module to load jokes from our database and render a list of links to the jokes.

<details>

<summary>app/routes/jokes.tsx</summary>

```tsx filename=app/routes/jokes.tsx lines=[2,6,10,16-20,23,47-51]
import type { LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Link,
  Outlet,
  useLoaderData,
} from "@remix-run/react";

import stylesUrl from "~/styles/jokes.css";
import { db } from "~/utils/db.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const loader = async () => {
  return json({
    jokeListItems: await db.joke.findMany(),
  });
};

export default function JokesRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="jokes-layout">
      <header className="jokes-header">
        <div className="container">
          <h1 className="home-link">
            <Link
              to="/"
              title="Remix Jokes"
              aria-label="Remix Jokes"
            >
              <span className="logo">🤪</span>
              <span className="logo-medium">J🤪KES</span>
            </Link>
          </h1>
        </div>
      </header>
      <main className="jokes-main">
        <div className="container">
          <div className="jokes-list">
            <Link to=".">Get a random joke</Link>
            <p>Here are a few more jokes to check out:</p>
            <ul>
              {data.jokeListItems.map(({ id, name }) => (
                <li key={id}>
                  <Link to={id}>{name}</Link>
                </li>
              ))}
            </ul>
            <Link to="new" className="button">
              Add your own
            </Link>
          </div>
          <div className="jokes-outlet">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
```

</details>

And here's what we have with that now:

![List of links to jokes][list-of-links-to-jokes]

### Data overfetching

I want to call out something specific in my solution. Here's my loader:

```tsx lines=[3-7]
export const loader = async () => {
  return json({
    jokeListItems: await db.joke.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
      take: 5,
    }),
  });
};
```

Notice that all I need for this page is the joke `id` and `name`. I don't need to bother getting the `content`. I'm also limiting to a total of 5 items and ordering by creation date, so we get the latest jokes. So with `prisma`, I can change my query to be exactly what I need and avoid sending too much data to the client! That makes my app faster and more responsive for my users.

And to make it even cooler, you don't necessarily need Prisma or direct database access to do this. You've got a GraphQL backend you're hitting? Sweet, use your regular GraphQL stuff in your loader. It's even better than doing it on the client because you don't need to worry about shipping a [huge GraphQL client][huge-graphql-client] to the client. Keep that on your server and filter down to what you want.

Oh, you've just got REST endpoints you hit? That's fine too! You can easily filter out the extra data before sending it off in your loader. Because it all happens on the server, you can save your user's download size easily without having to convince your backend engineers to change their entire API. Neat!

Filtering out data you don't render isn't just about sending less over the wire, you should also filter out any sensitive data you don't want exposed to the client.

<docs-error>
Whatever you return from your loader will be exposed to the client, even if the component doesn't render it. Treat your loaders with the same care as public API endpoints.
</docs-error>

### Network Type Safety

In our code we're using the `useLoaderData`'s type generic and pass our `loader` so we can get nice auto-complete, but it's not _really_ getting us type safety because the `loader` and the `useLoaderData` are running in completely different environments. Remix ensures we get what the server sent, but who really knows? Maybe in a fit of rage, your co-worker set up your server to automatically remove references to dogs (they prefer cats).

So the only way to really be 100% positive that your data is correct, you should use [assertion functions][assertion-functions] on the `data` you get back from `useLoaderData`. That's outside the scope of this tutorial, but we're fans of [zod][zod] which can aid in this.

### Wrap up database queries

Before we get to the `/jokes/:jokeId` route, here's a quick example of how you can access params (like `:jokeId`) in your loader.

```tsx nocopy
export const loader = async ({ params }: LoaderArgs) => {
  console.log(params); // <-- {jokeId: "123"}
};
```

And here's how you get the joke from Prisma:

```tsx nocopy
const joke = await db.joke.findUnique({
  where: { id: jokeId },
});
```

<docs-warning>Remember, when we're referencing the URL route, it's `/jokes/:jokeId`, and when we talk about the file system it's `/app/routes/jokes.$jokeId.tsx`.</docs-warning>

💿 Great! Now you know everything you need to continue and connect the `/jokes/:jokeId` route in `app/routes/jokes.$jokeId.tsx`.

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[1-3,5,7-15,18,23-24]
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { db } from "~/utils/db.server";

export const loader = async ({ params }: LoaderArgs) => {
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Error("Joke not found");
  }
  return json({ joke });
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">"{data.joke.name}" Permalink</Link>
    </div>
  );
}
```

</details>

With that you should be able to go to [`/jokes`][jokes] and click on a link to get the joke:

![Jokes page showing a unique joke][jokes-page-showing-a-unique-joke]

We'll handle the case where someone tries to access a joke that doesn't exist in the database in the next section.

Next, let's handle the `/jokes` index route in `app/routes/jokes._index.tsx` that shows a random joke.

Here's how you get a random joke from Prisma:

```tsx
const count = await db.joke.count();
const randomRowNumber = Math.floor(Math.random() * count);
const [randomJoke] = await db.joke.findMany({
  skip: randomRowNumber,
  take: 1,
});
```

💿 You should be able to get the loader working from there.

<details>

<summary>app/routes/jokes._index.tsx</summary>

```tsx filename=app/routes/jokes._index.tsx lines=[1-2,4,6-14,17,22-25]
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { db } from "~/utils/db.server";

export const loader = async () => {
  const count = await db.joke.count();
  const randomRowNumber = Math.floor(Math.random() * count);
  const [randomJoke] = await db.joke.findMany({
    skip: randomRowNumber,
    take: 1,
  });
  return json({ randomJoke });
};

export default function JokesIndexRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's a random joke:</p>
      <p>{data.randomJoke.content}</p>
      <Link to={data.randomJoke.id}>
        "{data.randomJoke.name}" Permalink
      </Link>
    </div>
  );
}
```

</details>

With that your [`/jokes`][jokes] route should display a list of links to jokes as well as a random joke:

![Jokes page showing a random joke][jokes-page-showing-a-random-joke]

## Mutations

We've got ourselves a `/jokes/new` route, but that form doesn't do anything yet. Let's wire it up! As a reminder here's what that code should look like right now (the `method="post"` is important so make sure yours has it):

```tsx filename=app/routes/jokes.new.tsx
export default function NewJokeRoute() {
  return (
    <div>
      <p>Add your own hilarious joke</p>
      <form method="post">
        <div>
          <label>
            Name: <input type="text" name="name" />
          </label>
        </div>
        <div>
          <label>
            Content: <textarea name="content" />
          </label>
        </div>
        <div>
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
```

Not much there. Just a form. What if I told you that you could make that form work with a single export to the route module? Well you can! It's the [`action`][action] function export! Read up on that a bit.

Here's the Prisma code you'll need:

```tsx
const joke = await db.joke.create({
  data: { name, content },
});
```

💿 Create an `action` in `app/routes/jokes.new.tsx`.

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx lines=[1-2,4,6-23]
import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { db } from "~/utils/db.server";

export const action = async ({ request }: ActionArgs) => {
  const form = await request.formData();
  const content = form.get("content");
  const name = form.get("name");
  // we do this type check to be extra sure and to make TypeScript happy
  // we'll explore validation next!
  if (
    typeof content !== "string" ||
    typeof name !== "string"
  ) {
    throw new Error("Form not submitted correctly.");
  }

  const fields = { content, name };

  const joke = await db.joke.create({ data: fields });
  return redirect(`/jokes/${joke.id}`);
};

export default function NewJokeRoute() {
  return (
    <div>
      <p>Add your own hilarious joke</p>
      <form method="post">
        <div>
          <label>
            Name: <input type="text" name="name" />
          </label>
        </div>
        <div>
          <label>
            Content: <textarea name="content" />
          </label>
        </div>
        <div>
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
```

</details>

If you've got that working, you should be able to create new jokes and be redirected to the new joke's page.

<docs-info>

The `redirect` utility is a simple utility in Remix for creating a [`Response`][response] object that has the right headers/status codes to redirect the user.

</docs-info>

![Create new joke form filled out][create-new-joke-form-filled-out]

![Newly created joke displayed][newly-created-joke-displayed]

Hooray! How cool is that? No `useEffect` or `useAnything` hooks. Just a form, and an async function to process the submission. Pretty cool. You can definitely still do all that stuff if you wanted to, but why would you? This is really nice.

Another thing you'll notice is that when we were redirected to the joke's new page, it was there! But we didn't have to think about updating the cache at all. Remix handles invalidating the cache for us automatically. You don't have to think about it. _That_ is cool 😎

Why don't we add some validation? We could definitely do the typical React validation approach. Wiring up `useState` with `onChange` handlers and such. And sometimes that's nice to get some real-time validation as the user's typing. But even if you do all that work, you're still going to want to do validation on the server.

Before I set you off on this one, there's one more thing you need to know about route module `action` functions. The return value is expected to be the same as the `loader` function: A `Response`, or (as a convenience) a serializable JavaScript object. Normally you want to `redirect` when the action is successful to avoid the annoying "confirm resubmission" dialog you might have seen on some websites.

<!-- TODO: add a page about why `redirect`ing is better for successful actions and link it here. -->

But if there's an error, you can return an object with the error messages and then the component can get those values from [`useActionData`][use-action-data] and display them to the user.

💿 Go ahead and validate that the `name` and `content` fields are long enough. I'd say the name should be at least 3 characters long and the content should be at least 10 characters long. Do this validation server-side.

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx lines=[3,6,8-12,14-18,28-32,35-38,40-46,53,63,66-73,76-84,90,92-99,102-110,113-120]
import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useActionData } from "@remix-run/react";

import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";

function validateJokeContent(content: string) {
  if (content.length < 10) {
    return "That joke is too short";
  }
}

function validateJokeName(name: string) {
  if (name.length < 3) {
    return "That joke's name is too short";
  }
}

export const action = async ({ request }: ActionArgs) => {
  const form = await request.formData();
  const content = form.get("content");
  const name = form.get("name");
  if (
    typeof content !== "string" ||
    typeof name !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fieldErrors = {
    content: validateJokeContent(content),
    name: validateJokeName(name),
  };
  const fields = { content, name };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  const joke = await db.joke.create({ data: fields });
  return redirect(`/jokes/${joke.id}`);
};

export default function NewJokeRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <p>Add your own hilarious joke</p>
      <form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              defaultValue={actionData?.fields?.name}
              name="name"
              type="text"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.name
              )}
              aria-errormessage={
                actionData?.fieldErrors?.name
                  ? "name-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p
              className="form-validation-error"
              id="name-error"
              role="alert"
            >
              {actionData.fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={actionData?.fields?.content}
              name="content"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.content
              )}
              aria-errormessage={
                actionData?.fieldErrors?.content
                  ? "content-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              id="content-error"
              role="alert"
            >
              {actionData.fieldErrors.content}
            </p>
          ) : null}
        </div>
        <div>
          {actionData?.formError ? (
            <p
              className="form-validation-error"
              role="alert"
            >
              {actionData.formError}
            </p>
          ) : null}
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
```

</details>

<details>

<summary>app/utils/request.server.ts</summary>

```ts filename=app/utils/request.server.ts
import { json } from "@remix-run/node";

/**
 * This helper function helps us to return the accurate HTTP status,
 * 400 Bad Request, to the client.
 */
export const badRequest = <T>(data: T) =>
  json<T>(data, { status: 400 });
```

</details>

Great! You should now have a form that validates the fields on the server and displays those errors on the client:

![New joke form with validation errors][new-joke-form-with-validation-errors]

Why don't you pop open my code example for a second? I want to show you a few things about the way I'm doing this.

First I want you to notice that I've passed `typeof action` to the `useActionData` generic function. This way, `actionData` type will properly be inferred, and we'll get some type safety. Keep in mind that `useActionData` can return `undefined` if the action hasn't been called yet, so we've got a bit of defensive programming going on there.

You may also notice that I return the fields as well. This is so that the form can be re-rendered with the values from the server in the event that JavaScript fails to load for some reason. That's what the `defaultValue` stuff is all about as well.

The `badRequest` helper function will automatically infer the type of the passed data, while still returning the accurate HTTP status, [`400 Bad Request`][400-bad-request], to the client. If we just used `json()` without specifying the status, that would result in a `200 OK` response, which isn't suitable since the form submission had errors.

Another thing I want to call out is how all of this is just so nice and declarative. You don't have to think about state at all here. Your action gets some data, you process it and return a value. The component consumes the action data and renders based on that value. No managing state here. No thinking about race conditions. Nothing.

Oh, and if you _do_ want to have client-side validation (for while the user is typing), you can simply call the `validateJokeContent` and `validateJokeName` functions that the action is using. You can _actually_ seamlessly share code between the client and server! Now _that_ is cool!

## Authentication

It's the moment we've all been waiting for! We're going to add authentication to our little application. The reason we want to add authentication is so jokes can be associated to the users who created them.

One thing that would be good to understand for this section is how [HTTP cookies][http-cookies] work on the web.

We're going to handroll our own authentication from scratch. Don't worry, I promise it's not as scary as it sounds.

### Preparing the database

<docs-warning>Remember, if your database gets messed up, you can always delete the `prisma/dev.db` file and run `npx prisma db push` again. Remember to also restart your dev server with `npm run dev`.</docs-warning>

Let's start by showing you our updated `prisma/schema.prisma` file.

💿 Go ahead and update your `prisma/schema.prisma` file to look like this:

```prisma filename=prisma/schema.prisma lines=[13-20,24-25]
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  username     String   @unique
  passwordHash String
  jokes        Joke[]
}

model Joke {
  id         String   @id @default(uuid())
  jokesterId String
  jokester   User     @relation(fields: [jokesterId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  name       String
  content    String
}
```

With that updated, let's go ahead and reset our database to this schema:

💿 Run this:

```sh
npx prisma db push
```

It will prompt you to reset the database, hit "y" to confirm.

That will give you this output:

```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"


⚠️ We found changes that cannot be executed:

  • Added the required column `jokesterId` to the `Joke` table without a default value. There are 9 rows in this table, it is not possible to execute this step.


✔ To apply this change we need to reset the database, do you want to continue? All data will be lost. … yes
The SQLite database "dev.db" from "file:./dev.db" was successfully reset.

🚀  Your database is now in sync with your Prisma schema. Done in 1.56s

✔ Generated Prisma Client (4.12.0 | library) to ./node_modules/@prisma/client in 34ms
```

With this change, we're going to start experiencing some TypeScript errors in our project because you can no longer create a `joke` without a `jokesterId` value.

💿 Let's start by fixing our `prisma/seed.ts` file.

```ts filename=prisma/seed.ts lines=[5-12,15-16]
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function seed() {
  const kody = await db.user.create({
    data: {
      username: "kody",
      // this is a hashed version of "twixrox"
      passwordHash:
        "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u",
    },
  });
  await Promise.all(
    getJokes().map((joke) => {
      const data = { jokesterId: kody.id, ...joke };
      return db.joke.create({ data });
    })
  );
}

seed();

function getJokes() {
  // shout-out to https://icanhazdadjoke.com/

  return [
    {
      name: "Road worker",
      content: `I never wanted to believe that my Dad was stealing from his job as a road worker. But when I got home, all the signs were there.`,
    },
    {
      name: "Frisbee",
      content: `I was wondering why the frisbee was getting bigger, then it hit me.`,
    },
    {
      name: "Trees",
      content: `Why do trees seem suspicious on sunny days? Dunno, they're just a bit shady.`,
    },
    {
      name: "Skeletons",
      content: `Why don't skeletons ride roller coasters? They don't have the stomach for it.`,
    },
    {
      name: "Hippos",
      content: `Why don't you find hippopotamuses hiding in trees? They're really good at it.`,
    },
    {
      name: "Dinner",
      content: `What did one plate say to the other plate? Dinner is on me!`,
    },
    {
      name: "Elevator",
      content: `My first time using an elevator was an uplifting experience. The second time let me down.`,
    },
  ];
}
```

💿 Great, now run the seed again:

```sh
npx prisma db seed
```

And that outputs:

```
Environment variables loaded from .env
Running seed command `ts-node --require tsconfig-paths/register prisma/seed.ts` ...

🌱  The seed command has been executed.
```

Great! Our database is now ready to go.

### Auth Flow Overview

So our authentication will be of the traditional username/password variety. We'll be using [`bcryptjs`][bcryptjs] to hash our passwords so nobody will be able to reasonably brute-force their way into an account.

💿 Go ahead and get that installed right now, so we don't forget:

```sh
npm install bcryptjs
```

💿 The `bcryptjs` library has TypeScript definitions in DefinitelyTyped, so let's install those as well:

```sh
npm install --save-dev @types/bcryptjs
```

Let me give you a quick diagram of the flow of things:

![Excalidraw Authentication diagram][excalidraw-authentication-diagram]

Here's that written out:

- On the `/login` route.
- User submits login form.
- Form data is validated.
  - If the form data is invalid, return the form with the errors.
- Login type is "register"
  - Check whether the username is available
    - If the username is not available, return the form with an error.
  - Hash the password
  - Create a new user
- Login type is "login"
  - Check whether the user exists
    - If the user doesn't exist, return the form with an error.
  - Check whether the password hash matches
    - If the password hash doesn't match, return the form with an error.
- Create a new session
- Redirect to the `/jokes` route with the `Set-Cookie` header.

### Build the login form

Alright, enough high-level stuff. Let's start writing some Remix code!

We're going to create a login page, and I've got some CSS for you to use on that page:

<details>

<summary>💿 Copy this CSS into `app/styles/login.css`</summary>

```css
/*
 * when the user visits this page, this style will apply, when they leave, it
 * will get unloaded, so don't worry so much about conflicting styles between
 * pages!
 */

body {
  background-image: var(--gradient-background);
}

.container {
  min-height: inherit;
}

.container,
.content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.content {
  padding: 1rem;
  background-color: hsl(0, 0%, 100%);
  border-radius: 5px;
  box-shadow: 0 0.2rem 1rem rgba(0, 0, 0, 0.5);
  width: 400px;
  max-width: 100%;
}

@media print, (min-width: 640px) {
  .content {
    padding: 2rem;
    border-radius: 8px;
  }
}

h1 {
  margin-top: 0;
}

fieldset {
  display: flex;
  justify-content: center;
}

fieldset > :not(:last-child) {
  margin-right: 2rem;
}

.links ul {
  margin-top: 1rem;
  padding: 0;
  list-style: none;
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.links a:hover {
  text-decoration-style: wavy;
  text-decoration-thickness: 1px;
}
```

</details>

💿 Create a `/login` route by adding a `app/routes/login.tsx` file.

<details>

<summary>app/routes/login.tsx</summary>

```tsx filename=app/routes/login.tsx
import type { LinksFunction } from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";

import stylesUrl from "~/styles/login.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function Login() {
  const [searchParams] = useSearchParams();
  return (
    <div className="container">
      <div className="content" data-light="">
        <h1>Login</h1>
        <form method="post">
          <input
            type="hidden"
            name="redirectTo"
            value={
              searchParams.get("redirectTo") ?? undefined
            }
          />
          <fieldset>
            <legend className="sr-only">
              Login or Register?
            </legend>
            <label>
              <input
                type="radio"
                name="loginType"
                value="login"
                defaultChecked
              />{" "}
              Login
            </label>
            <label>
              <input
                type="radio"
                name="loginType"
                value="register"
              />{" "}
              Register
            </label>
          </fieldset>
          <div>
            <label htmlFor="username-input">Username</label>
            <input
              type="text"
              id="username-input"
              name="username"
            />
          </div>
          <div>
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              name="password"
              type="password"
            />
          </div>
          <button type="submit" className="button">
            Submit
          </button>
        </form>
      </div>
      <div className="links">
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/jokes">Jokes</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
```

</details>

This should look something like this:

![A login form with a login/register radio button and username/password fields and a submit button][a-login-form-with-a-login-register-radio-button-and-username-password-fields-and-a-submit-button]

Notice in my solution I'm using `useSearchParams` to get the `redirectTo` query parameter and putting that in a hidden input. This way our `action` can know where to redirect the user. This will be useful later when we redirect a user to the login page.

Great, now that we've got the UI looking nice, let's add some logic. This will be very similar to the sort of thing we did in the `/jokes/new` route. Fill in as much as you can (validation and stuff) and we'll just leave comments for the parts of the logic we don't have implemented yet (like _actually_ registering/logging in).

💿 Implement validation with an `action` in `app/routes/login.tsx`

<details>

<summary>app/routes/login.tsx</summary>

```tsx filename=app/routes/login.tsx lines=[2,7,12-13,19-23,25-29,31-37,39-110,113,136-139,148-151,162-170,172-180,188-196,198-206,208-217]
import type {
  ActionArgs,
  LinksFunction,
} from "@remix-run/node";
import {
  Link,
  useActionData,
  useSearchParams,
} from "@remix-run/react";

import stylesUrl from "~/styles/login.css";
import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

function validateUsername(username: string) {
  if (username.length < 3) {
    return "Usernames must be at least 3 characters long";
  }
}

function validatePassword(password: string) {
  if (password.length < 6) {
    return "Passwords must be at least 6 characters long";
  }
}

function validateUrl(url: string) {
  const urls = ["/jokes", "/", "https://remix.run"];
  if (urls.includes(url)) {
    return url;
  }
  return "/jokes";
}

export const action = async ({ request }: ActionArgs) => {
  const form = await request.formData();
  const loginType = form.get("loginType");
  const password = form.get("password");
  const username = form.get("username");
  const redirectTo = validateUrl(
    (form.get("redirectTo") as string) || "/jokes"
  );
  if (
    typeof loginType !== "string" ||
    typeof password !== "string" ||
    typeof username !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fields = { loginType, password, username };
  const fieldErrors = {
    password: validatePassword(password),
    username: validateUsername(username),
  };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  switch (loginType) {
    case "login": {
      // login to get the user
      // if there's no user, return the fields and a formError
      // if there is a user, create their session and redirect to /jokes
      return badRequest({
        fieldErrors: null,
        fields,
        formError: "Not implemented",
      });
    }
    case "register": {
      const userExists = await db.user.findFirst({
        where: { username },
      });
      if (userExists) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError: `User with username ${username} already exists`,
        });
      }
      // create the user
      // create their session and redirect to /jokes
      return badRequest({
        fieldErrors: null,
        fields,
        formError: "Not implemented",
      });
    }
    default: {
      return badRequest({
        fieldErrors: null,
        fields,
        formError: "Login type invalid",
      });
    }
  }
};

export default function Login() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  return (
    <div className="container">
      <div className="content" data-light="">
        <h1>Login</h1>
        <form method="post">
          <input
            type="hidden"
            name="redirectTo"
            value={
              searchParams.get("redirectTo") ?? undefined
            }
          />
          <fieldset>
            <legend className="sr-only">
              Login or Register?
            </legend>
            <label>
              <input
                type="radio"
                name="loginType"
                value="login"
                defaultChecked={
                  !actionData?.fields?.loginType ||
                  actionData?.fields?.loginType === "login"
                }
              />{" "}
              Login
            </label>
            <label>
              <input
                type="radio"
                name="loginType"
                value="register"
                defaultChecked={
                  actionData?.fields?.loginType ===
                  "register"
                }
              />{" "}
              Register
            </label>
          </fieldset>
          <div>
            <label htmlFor="username-input">Username</label>
            <input
              type="text"
              id="username-input"
              name="username"
              defaultValue={actionData?.fields?.username}
              aria-invalid={Boolean(
                actionData?.fieldErrors?.username
              )}
              aria-errormessage={
                actionData?.fieldErrors?.username
                  ? "username-error"
                  : undefined
              }
            />
            {actionData?.fieldErrors?.username ? (
              <p
                className="form-validation-error"
                role="alert"
                id="username-error"
              >
                {actionData.fieldErrors.username}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              name="password"
              type="password"
              defaultValue={actionData?.fields?.password}
              aria-invalid={Boolean(
                actionData?.fieldErrors?.password
              )}
              aria-errormessage={
                actionData?.fieldErrors?.password
                  ? "password-error"
                  : undefined
              }
            />
            {actionData?.fieldErrors?.password ? (
              <p
                className="form-validation-error"
                role="alert"
                id="password-error"
              >
                {actionData.fieldErrors.password}
              </p>
            ) : null}
          </div>
          <div id="form-error-message">
            {actionData?.formError ? (
              <p
                className="form-validation-error"
                role="alert"
              >
                {actionData.formError}
              </p>
            ) : null}
          </div>
          <button type="submit" className="button">
            Submit
          </button>
        </form>
      </div>
      <div className="links">
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/jokes">Jokes</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
```

</details>

Once you've got that done, your form should look something like this:

![Login form with errors][login-form-with-errors]

Sweet! Now it's time for the juicy stuff. Let's start with the `login` side of things. We seed in a user with the username `kody` and the password (hashed) is `twixrox`. So we want to implement enough logic that will allow us to login as that user. We're going to put this logic in a separate file called `app/utils/session.server.ts`.

Here's what we need in that file to get started:

- Export a function called `login` that accepts the `username` and `password`
- Queries Prisma for a user with the `username`
- If there is no user, return `null`
- Use `bcrypt.compare` to compare the given `password` to the user's `passwordHash`
- If the passwords don't match, return `null`
- If the passwords match, return the user

💿 Create a file called `app/utils/session.server.ts` and implement the above requirements.

<details>

<summary>app/utils/session.server.ts</summary>

```ts filename=app/utils/session.server.ts
import bcrypt from "bcryptjs";

import { db } from "./db.server";

type LoginForm = {
  password: string;
  username: string;
};

export async function login({
  password,
  username,
}: LoginForm) {
  const user = await db.user.findUnique({
    where: { username },
  });
  if (!user) {
    return null;
  }

  const isCorrectPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );
  if (!isCorrectPassword) {
    return null;
  }

  return { id: user.id, username };
}
```

</details>

Great, with that in place, we can now update `app/routes/login.tsx` to use it:

<details>

<summary>app/routes/login.tsx</summary>

```tsx filename=app/routes/login.tsx lines=[6,14-23] nocopy
// ...

import stylesUrl from "~/styles/login.css";
import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import { login } from "~/utils/session.server";

// ...

export const action = async ({ request }: ActionArgs) => {
  // ...
  switch (loginType) {
    case "login": {
      const user = await login({ username, password });
      console.log({ user });
      if (!user) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError:
            "Username/Password combination is incorrect",
        });
      }
      // if there is a user, create their session and redirect to /jokes
      return badRequest({
        fieldErrors: null,
        fields,
        formError: "Not implemented",
      });
    }
    // ...
  }
};

export default function Login() {
  // ...
}
```

</details>

To check our work, I added a `console.log` to `app/routes/login.tsx` after the `login` call.

<docs-info>Remember, `actions` and `loaders` run on the server, so `console.log` calls you put in those you can't see in the browser console. Those will show up in the terminal window you're running your server in.</docs-info>

💿 With that in place, try to log in with the username `kody` and the password `twixrox` and check the terminal output. Here's what I get:

```
{
  user: {
    id: '1dc45f54-4061-4d9e-8a6d-28d6df6a8d7f',
    username: 'kody'
  }
}
```

<docs-warning>If you're having trouble, run `npx prisma studio` to see the database in the browser. It's possible you don't have any data because you forgot to run `npx prisma db seed` (like I did when I was writing this 😅).</docs-warning>

Wahoo! We got the user! Now we need to put that user's ID into the session. We're going to do this in `app/utils/session.server.ts`. Remix has a built-in abstraction to help us with managing several types of storage mechanisms for sessions ([here are the docs][here-are-the-docs]). We'll be using [`createCookieSessionStorage`][create-cookie-session-storage] as it's the simplest and scales quite well.

💿 Write a `createUserSession` function in `app/utils/session.server.ts` that accepts a user ID and a route to redirect to. It should do the following:

- creates a new session (via the cookie storage `getSession` function)
- sets the `userId` field on the session
- redirects to the given route setting the `Set-Cookie` header (via the cookie storage `commitSession` function)

Note: If you need a hand, there's a small example of how the whole basic flow goes in [the session docs][here-are-the-docs]. Once you have that, you'll want to use it in `app/routes/login.tsx` to set the session and redirect to the `/jokes` route.

<details>

<summary>app/utils/session.server.ts</summary>

```ts filename=app/utils/session.server.ts lines=[1-4,35-38,40-53,55-66]
import {
  createCookieSessionStorage,
  redirect,
} from "@remix-run/node";
import bcrypt from "bcryptjs";

import { db } from "./db.server";

type LoginForm = {
  username: string;
  password: string;
};

export async function login({
  username,
  password,
}: LoginForm) {
  const user = await db.user.findUnique({
    where: { username },
  });
  if (!user) {
    return null;
  }
  const isCorrectPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );
  if (!isCorrectPassword) {
    return null;
  }

  return { id: user.id, username };
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "RJ_session",
    // normally you want this to be `secure: true`
    // but that doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

export async function createUserSession(
  userId: string,
  redirectTo: string
) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}
```

</details>

<details>

<summary>app/routes/login.tsx</summary>

```tsx filename=app/routes/login.tsx lines=[7,27] nocopy
// ...

import stylesUrl from "~/styles/login.css";
import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import {
  createUserSession,
  login,
} from "~/utils/session.server";

// ...

export const action = async ({ request }: ActionArgs) => {
  // ...

  switch (loginType) {
    case "login": {
      const user = await login({ username, password });

      if (!user) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError: `Username/Password combination is incorrect`,
        });
      }
      return createUserSession(user.id, redirectTo);
    }

    // ...
  }
};

// ...
```

</details>

I want to call out the `SESSION_SECRET` environment variable I'm using really quick. The value of the `secrets` option is not the sort of thing you want in your code because the baddies could use it for their nefarious purposes. So instead we are going to read the value from the environment. This means you'll need to set the environment variable in your `.env` file. Incidentally, Prisma loads that file for us automatically so all we need to do is make sure we set that value when we deploy to production.

💿 Update `.env` file with `SESSION_SECRET` (with any value you like).

With that, pop open your [Network tab][network-tab], go to [`/login`][login] and enter `kody` and `twixrox` and check the response headers in the network tab. Should look something like this:

![DevTools Network tab showing a "Set-Cookie" header on the POST response][dev-tools-network-tab-showing-a-set-cookie-header-on-the-post-response]

And if you check the cookies section of the [Application tab][application-tab] then you should have the cookie set in there as well.

![DevTools Application tab showing ][dev-tools-application-tab-showing]

And now every request the browser makes to our server will include that cookie (we don't have to do anything on the client, [this is how cookies work][http-cookies]):

![Request headers showing the Cookie][request-headers-showing-the-cookie]

So we can now check whether the user is authenticated on the server by reading that header to get the `userId` we had set into it. To test this out, let's fix the `/jokes/new` route by adding the `jokesterId` field to `db.joke.create` call.

<docs-info>Remember to check [the docs][here-are-the-docs] to learn how to get the session from the request</docs-info>

💿 Update `app/utils/session.server.ts` to get the `userId` from the session. In my solution I create three functions: `getUserSession(request: Request)`, `getUserId(request: Request)` and `requireUserId(request: Request, redirectTo: string)`.

<details>

<summary>app/utils/session.server.ts</summary>

```ts filename=app/utils/session.server.ts lines=[55-57,59-66,68-81]
import {
  createCookieSessionStorage,
  redirect,
} from "@remix-run/node";
import bcrypt from "bcryptjs";

import { db } from "./db.server";

type LoginForm = {
  username: string;
  password: string;
};

export async function login({
  username,
  password,
}: LoginForm) {
  const user = await db.user.findUnique({
    where: { username },
  });
  if (!user) {
    return null;
  }
  const isCorrectPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );
  if (!isCorrectPassword) {
    return null;
  }

  return { id: user.id, username };
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "RJ_session",
    // normally you want this to be `secure: true`
    // but that doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    return null;
  }
  return userId;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    const searchParams = new URLSearchParams([
      ["redirectTo", redirectTo],
    ]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function createUserSession(
  userId: string,
  redirectTo: string
) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}
```

</details>

<docs-info>Did you notice in my example that we're `throw`ing a `Response`?!</docs-info>

In my example, I created a `requireUserId` which will throw a `redirect`. Remember `redirect` is a utility function that returns a [`Response`][response] object. Remix will catch that thrown response and send it back to the client. It's a great way to "exit early" in abstractions like this so users of our `requireUserId` function can just assume that the return will always give us the `userId` and don't need to worry about what happens if there isn't a `userId` because the response is thrown which stops their code execution!

We'll cover this more in the error handling sections later.

You may also notice that our solution makes use of the `login` route's `redirectTo` feature we had earlier.

💿 Now update `app/routes/jokes.new.tsx` to use that function to get the `userId` and pass it to the `db.joke.create` call.

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx lines=[7,22,51]
import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useActionData } from "@remix-run/react";

import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import { requireUserId } from "~/utils/session.server";

function validateJokeContent(content: string) {
  if (content.length < 10) {
    return "That joke is too short";
  }
}

function validateJokeName(name: string) {
  if (name.length < 3) {
    return "That joke's name is too short";
  }
}

export const action = async ({ request }: ActionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const content = form.get("content");
  const name = form.get("name");
  if (
    typeof content !== "string" ||
    typeof name !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fieldErrors = {
    content: validateJokeContent(content),
    name: validateJokeName(name),
  };
  const fields = { content, name };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  const joke = await db.joke.create({
    data: { ...fields, jokesterId: userId },
  });
  return redirect(`/jokes/${joke.id}`);
};

export default function NewJokeRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <p>Add your own hilarious joke</p>
      <form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              defaultValue={actionData?.fields?.name}
              name="name"
              type="text"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.name
              )}
              aria-errormessage={
                actionData?.fieldErrors?.name
                  ? "name-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p
              className="form-validation-error"
              id="name-error"
              role="alert"
            >
              {actionData.fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={actionData?.fields?.content}
              name="content"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.content
              )}
              aria-errormessage={
                actionData?.fieldErrors?.content
                  ? "content-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              id="content-error"
              role="alert"
            >
              {actionData.fieldErrors.content}
            </p>
          ) : null}
        </div>
        <div>
          {actionData?.formError ? (
            <p
              className="form-validation-error"
              role="alert"
            >
              {actionData.formError}
            </p>
          ) : null}
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
```

</details>

Super! So now if a user attempts to create a new joke, they'll be redirected to the login page because a `userId` is required to create a new joke.

### Build Logout Action

We should probably give people the ability to see that they're logged in and a way to log out right? Yeah, I think so. Let's implement that.

💿 Update `app/utils/session.server.ts` to add a `getUser` function that gets the user from Prisma and a `logout` function that uses [`destroySession`][destroy-session] to log the user out.

<details>

<summary>app/utils/session.server.ts</summary>

```ts filename=app/utils/session.server.ts lines=[84-100,102-109]
import {
  createCookieSessionStorage,
  redirect,
} from "@remix-run/node";
import bcrypt from "bcryptjs";

import { db } from "./db.server";

type LoginForm = {
  password: string;
  username: string;
};

export async function login({
  password,
  username,
}: LoginForm) {
  const user = await db.user.findUnique({
    where: { username },
  });
  if (!user) {
    return null;
  }

  const isCorrectPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );
  if (!isCorrectPassword) {
    return null;
  }

  return { id: user.id, username };
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "RJ_session",
    // normally you want this to be `secure: true`
    // but that doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    return null;
  }
  return userId;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    const searchParams = new URLSearchParams([
      ["redirectTo", redirectTo],
    ]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (typeof userId !== "string") {
    return null;
  }

  const user = await db.user.findUnique({
    select: { id: true, username: true },
    where: { id: userId },
  });

  if (!user) {
    throw logout(request);
  }

  return user;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}

export async function createUserSession(
  userId: string,
  redirectTo: string
) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}
```

</details>

💿 Great, now we're going to update the `app/routes/jokes.tsx` route, so we can display a login link if the user isn't logged in. If they are logged in then we'll display their username and a logout form. I'm also going to clean up the UI a bit to match the class names we've got as well, so feel free to copy/paste the example when you're ready.

<details>

<summary>app/routes/jokes.tsx</summary>

```tsx filename=app/routes/jokes.tsx lines=[3,14,20,26,28,48-59]
import type {
  LinksFunction,
  LoaderArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Link,
  Outlet,
  useLoaderData,
} from "@remix-run/react";

import stylesUrl from "~/styles/jokes.css";
import { db } from "~/utils/db.server";
import { getUser } from "~/utils/session.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const loader = async ({ request }: LoaderArgs) => {
  const jokeListItems = await db.joke.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
    take: 5,
  });
  const user = await getUser(request);

  return json({ jokeListItems, user });
};

export default function JokesRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="jokes-layout">
      <header className="jokes-header">
        <div className="container">
          <h1 className="home-link">
            <Link
              to="/"
              title="Remix Jokes"
              aria-label="Remix Jokes"
            >
              <span className="logo">🤪</span>
              <span className="logo-medium">J🤪KES</span>
            </Link>
          </h1>
          {data.user ? (
            <div className="user-info">
              <span>{`Hi ${data.user.username}`}</span>
              <form action="/logout" method="post">
                <button type="submit" className="button">
                  Logout
                </button>
              </form>
            </div>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </header>
      <main className="jokes-main">
        <div className="container">
          <div className="jokes-list">
            <Link to=".">Get a random joke</Link>
            <p>Here are a few more jokes to check out:</p>
            <ul>
              {data.jokeListItems.map(({ id, name }) => (
                <li key={id}>
                  <Link to={id}>{name}</Link>
                </li>
              ))}
            </ul>
            <Link to="new" className="button">
              Add your own
            </Link>
          </div>
          <div className="jokes-outlet">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/logout.tsx</summary>

```tsx filename=app/routes/logout.tsx
import type { ActionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { logout } from "~/utils/session.server";

export const action = async ({ request }: ActionArgs) =>
  logout(request);

export const loader = async () => redirect("/");
```

</details>

Hopefully getting the user in the loader and rendering them in the component was pretty straightforward. There are a few things I want to call out about other parts of my version of the code before we continue.

First, the new `logout` route is just there to make it easy for us to logout. The reason that we're using an action (rather than a loader) is because we want to avoid [CSRF][csrf] problems by using a POST request rather than a GET request. This is why the logout button is a form and not a link. Additionally, Remix will only re-call our loaders when we perform an `action`, so if we used a `loader` then the cache would not get invalidated. The `loader` is just there in case someone somehow lands on that page, we'll just redirect them back home.

```tsx
<Link to="new" className="button">
  Add your own
</Link>
```

Notice that the `to` prop is set to "new" without any `/`. This is the benefit of nested routing. You don't have to construct the entire URL. It can be relative. This is the same thing for the `<Link to=".">Get a random joke</Link>` link which will effectively tell Remix to reload the data for the current route.

Terrific, now our app looks like this:

![Jokes page nice and designed][jokes-page-nice-and-designed]

![New Joke form designed][new-joke-form-designed]

### User Registration

I suppose now would be a good time to add support for user registration! Did you forget like I did? 😅 Well, let's get that bit added before moving on.

Luckily, all we need to do to support this is to update `app/utils/session.server.ts` with a `register` function that's pretty similar to our `login` function. The difference here is that we need to use `bcrypt.hash` to hash the password before we store it in the database. Then update the `register` case in our `app/routes/login.tsx` route to handle the registration.

💿 Update both `app/utils/session.server.ts` and `app/routes/login.tsx` to handle user registration.

<details>

<summary>app/utils/session.server.ts</summary>

```tsx filename=app/utils/session.server.ts lines=[14-23]
import {
  createCookieSessionStorage,
  redirect,
} from "@remix-run/node";
import bcrypt from "bcryptjs";

import { db } from "./db.server";

type LoginForm = {
  password: string;
  username: string;
};

export async function register({
  password,
  username,
}: LoginForm) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { passwordHash, username },
  });
  return { id: user.id, username };
}

export async function login({
  password,
  username,
}: LoginForm) {
  const user = await db.user.findUnique({
    where: { username },
  });
  if (!user) {
    return null;
  }

  const isCorrectPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );
  if (!isCorrectPassword) {
    return null;
  }

  return { id: user.id, username };
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "RJ_session",
    // normally you want this to be `secure: true`
    // but that doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    return null;
  }
  return userId;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    const searchParams = new URLSearchParams([
      ["redirectTo", redirectTo],
    ]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (typeof userId !== "string") {
    return null;
  }

  const user = await db.user.findUnique({
    select: { id: true, username: true },
    where: { id: userId },
  });

  if (!user) {
    throw logout(request);
  }

  return user;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}

export async function createUserSession(
  userId: string,
  redirectTo: string
) {
  const session = await storage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}
```

</details>

<details>

<summary>app/routes/login.tsx</summary>

```tsx filename=app/routes/login.tsx lines=[17,102-110]
import type {
  ActionArgs,
  LinksFunction,
} from "@remix-run/node";
import {
  Link,
  useActionData,
  useSearchParams,
} from "@remix-run/react";

import stylesUrl from "~/styles/login.css";
import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import {
  createUserSession,
  login,
  register,
} from "~/utils/session.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

function validateUsername(username: string) {
  if (username.length < 3) {
    return "Usernames must be at least 3 characters long";
  }
}

function validatePassword(password: string) {
  if (password.length < 6) {
    return "Passwords must be at least 6 characters long";
  }
}

function validateUrl(url: string) {
  const urls = ["/jokes", "/", "https://remix.run"];
  if (urls.includes(url)) {
    return url;
  }
  return "/jokes";
}

export const action = async ({ request }: ActionArgs) => {
  const form = await request.formData();
  const loginType = form.get("loginType");
  const password = form.get("password");
  const username = form.get("username");
  const redirectTo = validateUrl(
    (form.get("redirectTo") as string) || "/jokes"
  );
  if (
    typeof loginType !== "string" ||
    typeof password !== "string" ||
    typeof username !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fields = { loginType, password, username };
  const fieldErrors = {
    password: validatePassword(password),
    username: validateUsername(username),
  };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  switch (loginType) {
    case "login": {
      const user = await login({ username, password });
      console.log({ user });
      if (!user) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError:
            "Username/Password combination is incorrect",
        });
      }
      return createUserSession(user.id, redirectTo);
    }
    case "register": {
      const userExists = await db.user.findFirst({
        where: { username },
      });
      if (userExists) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError: `User with username ${username} already exists`,
        });
      }
      const user = await register({ username, password });
      if (!user) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError:
            "Something went wrong trying to create a new user.",
        });
      }
      return createUserSession(user.id, redirectTo);
    }
    default: {
      return badRequest({
        fieldErrors: null,
        fields,
        formError: "Login type invalid",
      });
    }
  }
};

export default function Login() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  return (
    <div className="container">
      <div className="content" data-light="">
        <h1>Login</h1>
        <form method="post">
          <input
            type="hidden"
            name="redirectTo"
            value={
              searchParams.get("redirectTo") ?? undefined
            }
          />
          <fieldset>
            <legend className="sr-only">
              Login or Register?
            </legend>
            <label>
              <input
                type="radio"
                name="loginType"
                value="login"
                defaultChecked={
                  !actionData?.fields?.loginType ||
                  actionData?.fields?.loginType === "login"
                }
              />{" "}
              Login
            </label>
            <label>
              <input
                type="radio"
                name="loginType"
                value="register"
                defaultChecked={
                  actionData?.fields?.loginType ===
                  "register"
                }
              />{" "}
              Register
            </label>
          </fieldset>
          <div>
            <label htmlFor="username-input">Username</label>
            <input
              type="text"
              id="username-input"
              name="username"
              defaultValue={actionData?.fields?.username}
              aria-invalid={Boolean(
                actionData?.fieldErrors?.username
              )}
              aria-errormessage={
                actionData?.fieldErrors?.username
                  ? "username-error"
                  : undefined
              }
            />
            {actionData?.fieldErrors?.username ? (
              <p
                className="form-validation-error"
                role="alert"
                id="username-error"
              >
                {actionData.fieldErrors.username}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              name="password"
              type="password"
              defaultValue={actionData?.fields?.password}
              aria-invalid={Boolean(
                actionData?.fieldErrors?.password
              )}
              aria-errormessage={
                actionData?.fieldErrors?.password
                  ? "password-error"
                  : undefined
              }
            />
            {actionData?.fieldErrors?.password ? (
              <p
                className="form-validation-error"
                role="alert"
                id="password-error"
              >
                {actionData.fieldErrors.password}
              </p>
            ) : null}
          </div>
          <div id="form-error-message">
            {actionData?.formError ? (
              <p
                className="form-validation-error"
                role="alert"
              >
                {actionData.formError}
              </p>
            ) : null}
          </div>
          <button type="submit" className="button">
            Submit
          </button>
        </form>
      </div>
      <div className="links">
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/jokes">Jokes</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
```

</details>

Phew, there we go. Now users can register for a new account!

## Unexpected errors

I'm sorry, but there's no way you'll be able to avoid errors at some point. Servers fall over, co-workers use `// @ts-ignore`, and so on. So we need to just embrace the possibility of unexpected errors and deal with them.

Luckily, error handling in Remix is stellar. You may have used React's [Error Boundary feature][error-boundary-feature]. With Remix, your route modules can export an [`ErrorBoundary` component][error-boundary-component], and it will be used. But it's even cooler because it works on the server too! Not only that, but it'll handle errors in `loader`s and `action`s too! Wowza! So let's get to it!

Just like the `useLoaderData` hook to get data from the `loader` and the `useActionData` hook to get data from the `action`, the `ErrorBoundary` gets the thrown instance from the `useRouteError` hook.

We're going to add four `ErrorBoundary`s in our app. One in each of the child routes in `app/routes/jokes.*` in case there's an error reading or processing stuff with the jokes, and one in `app/root.tsx` to handle errors for everything else.

<docs-info>The `app/root.tsx` `ErrorBoundary` is a bit more complicated</docs-info>

Remember that the `app/root.tsx` module is responsible for rendering our `<html>` element. When the `ErrorBoundary` is rendered, it's rendered _in place_ of the default export. That means the `app/root.tsx` module should render the `<html>` element along with the `<Link />` elements, etc.

💿 Add a simple `ErrorBoundary` to each of those files.

<details>

<summary>app/root.tsx</summary>

```tsx filename=app/root.tsx lines=[6,8,28-49,51-57,59-74]
import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Outlet,
  useRouteError,
} from "@remix-run/react";
import type { PropsWithChildren } from "react";

import globalLargeStylesUrl from "~/styles/global-large.css";
import globalMediumStylesUrl from "~/styles/global-medium.css";
import globalStylesUrl from "~/styles/global.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: globalStylesUrl },
  {
    rel: "stylesheet",
    href: globalMediumStylesUrl,
    media: "print, (min-width: 640px)",
  },
  {
    rel: "stylesheet",
    href: globalLargeStylesUrl,
    media: "screen and (min-width: 1024px)",
  },
];

function Document({
  children,
  title = "Remix: So great, it's funny!",
}: PropsWithChildren<{ title?: string }>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <title>{title}</title>
        <Links />
      </head>
      <body>
        {children}
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  const errorMessage =
    error instanceof Error
      ? error.message
      : "Unknown error";
  return (
    <Document title="Uh-oh!">
      <div className="error-container">
        <h1>App Error</h1>
        <pre>{errorMessage}</pre>
      </div>
    </Document>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[6,11-19] nocopy
// ...

import {
  Link,
  useLoaderData,
  useParams,
} from "@remix-run/react";

// ...

export function ErrorBoundary() {
  const { jokeId } = useParams();
  return (
    <div className="error-container">
      There was an error loading joke by the id "${jokeId}".
      Sorry.
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx nocopy
// ...

export function ErrorBoundary() {
  return (
    <div className="error-container">
      Something unexpected went wrong. Sorry about that.
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes._index.tsx</summary>

```tsx filename=app/routes/jokes._index.tsx nocopy
// ...

export function ErrorBoundary() {
  return (
    <div className="error-container">
      I did a whoopsies.
    </div>
  );
}
```

</details>

Ok great, with those in place, let's check what happens when there's an error. Go ahead and just add this to the default component, loader, or action of each of the routes.

```ts
throw new Error("Testing Error Boundary");
```

Here's what I get:

![App error][app-error]

![Joke Page Error][joke-page-error]

![Joke Index Page Error][joke-index-page-error]

![New Joke Page Error][new-joke-page-error]

What I love about this is that in the case of the children routes, the only unusable part of the app is the part that actually broke. The rest of the app is completely interactive. There's another point for the user's experience!

## Expected errors

Sometimes users do things we can anticipate. I'm not talking about validation necessarily. I'm talking about things like whether the user's authenticated (status `401`) or authorized (status `403`) to do what they're trying to do. Or maybe they're looking for something that isn't there (status `404`).

It might help to think of the unexpected errors as 500-level errors ([server errors][server-errors]) and the expected errors as 400-level errors ([client errors][client-errors]).

To check for client error responses, Remix offers the [`isRouteErrorResponse`][is-route-error-response] helper function. In the case that your server code detects a problem, it'll throw a [`Response`][response] object. Remix then catches that thrown `Response` and renders your `ErrorBoundary`. Since you can throw whatever you want, the `isRouteErrorResponse` helper function is a way to check if the thrown instance is a `Response` object.

One last thing, this isn't for form validations and stuff. We already discussed that earlier with `useActionData`. This is just for situations where the user did something that means we can't reasonably render our default component, so we want to render something else instead.

<docs-info>`ErrorBoundary` allows our default exports to represent the "happy path" and not worry about errors. If the default component is rendered, then we can assume all is right with the world.</docs-info>

With that understanding, we're going to add a `isRouteErrorResponse` check to the following routes:

- `app/root.tsx` - Just as a last resort fallback.
- `app/routes/jokes.$jokeId.tsx` - When a user tries to access a joke that doesn't exist (404).
- `app/routes/jokes.new.tsx` - When a user tries to go to this page without being authenticated (401). Right now they'll just get redirected to the login if they try to submit it without authenticating. That would be super annoying to spend time writing a joke only to get redirected. Rather than inexplicably redirecting them, we could render a message that says they need to authenticate first.
- `app/routes/jokes._index.tsx` - If there are no jokes in the database then a random joke is 404-not found. (simulate this by deleting the `prisma/dev.db` and running `npx prisma db push`. Don't forget to run `npx prisma db seed` afterwards to get your seed data back.)

💿 Let's add these `isRouteErrorResponse` checks to the routes.

<details>

<summary>app/root.tsx</summary>

```tsx filename=app/root.tsx lines=[3,63-75]
import type { LinksFunction } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Links,
  LiveReload,
  Outlet,
  useRouteError,
} from "@remix-run/react";
import type { PropsWithChildren } from "react";

import globalLargeStylesUrl from "~/styles/global-large.css";
import globalMediumStylesUrl from "~/styles/global-medium.css";
import globalStylesUrl from "~/styles/global.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: globalStylesUrl },
  {
    rel: "stylesheet",
    href: globalMediumStylesUrl,
    media: "print, (min-width: 640px)",
  },
  {
    rel: "stylesheet",
    href: globalLargeStylesUrl,
    media: "screen and (min-width: 1024px)",
  },
];

function Document({
  children,
  title = "Remix: So great, it's funny!",
}: PropsWithChildren<{ title?: string }>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <title>{title}</title>
        <Links />
      </head>
      <body>
        {children}
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <Document
        title={`${error.status} ${error.statusText}`}
      >
        <div className="error-container">
          <h1>
            {error.status} {error.statusText}
          </h1>
        </div>
      </Document>
    );
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : "Unknown error";
  return (
    <Document title="Uh-oh!">
      <div className="error-container">
        <h1>App Error</h1>
        <pre>{errorMessage}</pre>
      </div>
    </Document>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[4,8,18-20,39,41-47]
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useParams,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";

export const loader = async ({ params }: LoaderArgs) => {
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }
  return json({ joke });
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">"{data.joke.name}" Permalink</Link>
    </div>
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="error-container">
        Huh? What the heck is "{jokeId}"?
      </div>
    );
  }

  return (
    <div className="error-container">
      There was an error loading joke by the id "${jokeId}".
      Sorry.
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes._index.tsx</summary>

```tsx filename=app/routes/jokes._index.tsx lines=[3,6,18-22,41,43-50]
import { json } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";

export const loader = async () => {
  const count = await db.joke.count();
  const randomRowNumber = Math.floor(Math.random() * count);
  const [randomJoke] = await db.joke.findMany({
    skip: randomRowNumber,
    take: 1,
  });
  if (!randomJoke) {
    throw new Response("No random joke found", {
      status: 404,
    });
  }
  return json({ randomJoke });
};

export default function JokesIndexRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's a random joke:</p>
      <p>{data.randomJoke.content}</p>
      <Link to={data.randomJoke.id}>
        "{data.randomJoke.name}" Permalink
      </Link>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="error-container">
        <p>There are no jokes to display.</p>
        <Link to="new">Add your own</Link>
      </div>
    );
  }

  return (
    <div className="error-container">
      I did a whoopsies.
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx lines=[3,5,7,10,16,20-26,154,156-163]
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useActionData,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return json({});
};

function validateJokeContent(content: string) {
  if (content.length < 10) {
    return "That joke is too short";
  }
}

function validateJokeName(name: string) {
  if (name.length < 3) {
    return "That joke's name is too short";
  }
}

export const action = async ({ request }: ActionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const content = form.get("content");
  const name = form.get("name");
  if (
    typeof content !== "string" ||
    typeof name !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fieldErrors = {
    content: validateJokeContent(content),
    name: validateJokeName(name),
  };
  const fields = { content, name };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  const joke = await db.joke.create({
    data: { ...fields, jokesterId: userId },
  });
  return redirect(`/jokes/${joke.id}`);
};

export default function NewJokeRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <p>Add your own hilarious joke</p>
      <form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              defaultValue={actionData?.fields?.name}
              name="name"
              type="text"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.name
              )}
              aria-errormessage={
                actionData?.fieldErrors?.name
                  ? "name-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p
              className="form-validation-error"
              id="name-error"
              role="alert"
            >
              {actionData.fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={actionData?.fields?.content}
              name="content"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.content
              )}
              aria-errormessage={
                actionData?.fieldErrors?.content
                  ? "content-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              id="content-error"
              role="alert"
            >
              {actionData.fieldErrors.content}
            </p>
          ) : null}
        </div>
        <div>
          {actionData?.formError ? (
            <p
              className="form-validation-error"
              role="alert"
            >
              {actionData.formError}
            </p>
          ) : null}
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 401) {
    return (
      <div className="error-container">
        <p>You must be logged in to create a joke.</p>
        <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <div className="error-container">
      Something unexpected went wrong. Sorry about that.
    </div>
  );
}
```

</details>

Here's what I've got with that:

![App 400 Bad Request][app-400-bad-request]

![A 404 on the joke page][a-404-on-the-joke-page]

![A 404 on the random joke page][a-404-on-the-random-joke-page]

![A 401 on the new joke page][a-401-on-the-new-joke-page]

Awesome! We're ready to handle errors, and it didn't complicate our happy path one bit! 🎉

Oh, and don't you love how it's all contextual? So the rest of the app continues to function just as well. Another point for user experience 💪

You know what, while we're adding `ErrorBoundary`s. Why don't we improve the `app/routes/jokes.$jokeId.tsx` route a bit by allowing users to delete the joke if they own it. If they don't, we can give them a 403 error in the `ErrorBoundary`.

One thing to keep in mind with `delete` is that HTML forms only support `method="get"` and `method="post"`. They don't support `method="delete"`. So to make sure our form will work with and without JavaScript, it's a good idea to do something like this:

```tsx
<form method="post">
  <button name="intent" type="submit" value="delete">
    Delete
  </button>
</form>
```

And then the `action` can determine whether the intention is to delete based on the `request.formData().get('intent')`.

💿 Add a delete capability to `app/routes/jokes.$jokeId.tsx` route.

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[2,5,7,11,15,29-57,67-76,86-99]
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useParams,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import { requireUserId } from "~/utils/session.server";

export const loader = async ({ params }: LoaderArgs) => {
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }
  return json({ joke });
};

export const action = async ({
  params,
  request,
}: ActionArgs) => {
  const form = await request.formData();
  if (form.get("intent") !== "delete") {
    throw new Response(
      `The intent ${form.get("intent")} is not supported`,
      { status: 400 }
    );
  }
  const userId = await requireUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("Can't delete what does not exist", {
      status: 404,
    });
  }
  if (joke.jokesterId !== userId) {
    throw new Response(
      "Pssh, nice try. That's not your joke",
      { status: 403 }
    );
  }
  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect("/jokes");
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">"{data.joke.name}" Permalink</Link>
      <form method="post">
        <button
          className="button"
          name="intent"
          type="submit"
          value="delete"
        >
          Delete
        </button>
      </form>
    </div>
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 400) {
      return (
        <div className="error-container">
          What you're trying to do is not allowed.
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div className="error-container">
          Sorry, but "{jokeId}" is not your joke.
        </div>
      );
    }
    if (error.status === 404) {
      return (
        <div className="error-container">
          Huh? What the heck is "{jokeId}"?
        </div>
      );
    }
  }

  return (
    <div className="error-container">
      There was an error loading joke by the id "${jokeId}".
      Sorry.
    </div>
  );
}
```

</details>

Now that people will get a proper error message if they try to delete a joke that is not theirs, maybe we could also simply hide the delete button if the user doesn't own the joke.

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[16,22,24,34,77,88]
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useParams,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const loader = async ({
  params,
  request,
}: LoaderArgs) => {
  const userId = await getUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }
  return json({
    isOwner: userId === joke.jokesterId,
    joke,
  });
};

export const action = async ({
  params,
  request,
}: ActionArgs) => {
  const form = await request.formData();
  if (form.get("intent") !== "delete") {
    throw new Response(
      `The intent ${form.get("intent")} is not supported`,
      { status: 400 }
    );
  }
  const userId = await requireUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("Can't delete what does not exist", {
      status: 404,
    });
  }
  if (joke.jokesterId !== userId) {
    throw new Response(
      "Pssh, nice try. That's not your joke",
      { status: 403 }
    );
  }
  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect("/jokes");
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">"{data.joke.name}" Permalink</Link>
      {data.isOwner ? (
        <form method="post">
          <button
            className="button"
            name="intent"
            type="submit"
            value="delete"
          >
            Delete
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 400) {
      return (
        <div className="error-container">
          What you're trying to do is not allowed.
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div className="error-container">
          Sorry, but "{jokeId}" is not your joke.
        </div>
      );
    }
    if (error.status === 404) {
      return (
        <div className="error-container">
          Huh? What the heck is "{jokeId}"?
        </div>
      );
    }
  }

  return (
    <div className="error-container">
      There was an error loading joke by the id "${jokeId}".
      Sorry.
    </div>
  );
}
```

</details>

## SEO with Meta tags

Meta tags are useful for SEO and social media. The tricky bit is that often the part of the code that has access to the data you need is in components that request/use the data.

This is why Remix has the [`meta`][meta] export. Why don't you go through and add a useful few meta tags to the following routes:

- `app/routes/login.tsx`
- `app/routes/jokes.$jokeId.tsx` - (this one you can reference the joke's name in the title which is fun)

But before you get started, remember that we're in charge of rendering everything from the `<html>` to the `</html>` which means we need to make sure these `meta` tags are rendered in the `<head>` of the `<html>`. This is why Remix gives us a [`Meta` component][meta-component].

💿 Add the `Meta` component to `app/root.tsx`, and add the `meta` export to the routes mentioned above. The `Meta` component needs to be placed above the existing `<title>` tag to be able to overwrite it when provided.

<details>

<summary>app/root.tsx</summary>

```tsx filename=app/root.tsx lines=[3,9,33-42,46,56-69]
import type {
  LinksFunction,
  V2_MetaFunction,
} from "@remix-run/node";
import {
  isRouteErrorResponse,
  Links,
  LiveReload,
  Meta,
  Outlet,
  useRouteError,
} from "@remix-run/react";
import type { PropsWithChildren } from "react";

import globalLargeStylesUrl from "~/styles/global-large.css";
import globalMediumStylesUrl from "~/styles/global-medium.css";
import globalStylesUrl from "~/styles/global.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: globalStylesUrl },
  {
    rel: "stylesheet",
    href: globalMediumStylesUrl,
    media: "print, (min-width: 640px)",
  },
  {
    rel: "stylesheet",
    href: globalLargeStylesUrl,
    media: "screen and (min-width: 1024px)",
  },
];

export const meta: V2_MetaFunction = () => {
  const description =
    "Learn Remix and laugh at the same time!";

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title: "Remix: So great, it's funny!" },
  ];
};

function Document({
  children,
  title,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <meta name="keywords" content="Remix,jokes" />
        <meta
          name="twitter:image"
          content="https://remix-jokes.lol/social.png"
        />
        <meta
          name="twitter:card"
          content="summary_large_image"
        />
        <meta name="twitter:creator" content="@remix_run" />
        <meta name="twitter:site" content="@remix_run" />
        <meta name="twitter:title" content="Remix Jokes" />
        <Meta />
        {title ? <title>{title}</title> : null}
        <Links />
      </head>
      <body>
        {children}
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <Document
        title={`${error.status} ${error.statusText}`}
      >
        <div className="error-container">
          <h1>
            {error.status} {error.statusText}
          </h1>
        </div>
      </Document>
    );
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : "Unknown error";
  return (
    <Document title="Uh-oh!">
      <div className="error-container">
        <h1>App Error</h1>
        <pre>{errorMessage}</pre>
      </div>
    </Document>
  );
}
```

</details>

<details>

<summary>app/routes/login.tsx</summary>

```tsx filename=app/routes/login.tsx lines=[4,25-34]
import type {
  ActionArgs,
  LinksFunction,
  V2_MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useActionData,
  useSearchParams,
} from "@remix-run/react";

import stylesUrl from "~/styles/login.css";
import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import {
  createUserSession,
  login,
  register,
} from "~/utils/session.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const meta: V2_MetaFunction = () => {
  const description =
    "Login to submit your own jokes to Remix Jokes!";

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title: "Remix Jokes | Login" },
  ];
};

function validateUsername(username: string) {
  if (username.length < 3) {
    return "Usernames must be at least 3 characters long";
  }
}

function validatePassword(password: string) {
  if (password.length < 6) {
    return "Passwords must be at least 6 characters long";
  }
}

function validateUrl(url: string) {
  const urls = ["/jokes", "/", "https://remix.run"];
  if (urls.includes(url)) {
    return url;
  }
  return "/jokes";
}

export const action = async ({ request }: ActionArgs) => {
  const form = await request.formData();
  const loginType = form.get("loginType");
  const password = form.get("password");
  const username = form.get("username");
  const redirectTo = validateUrl(
    (form.get("redirectTo") as string) || "/jokes"
  );
  if (
    typeof loginType !== "string" ||
    typeof password !== "string" ||
    typeof username !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fields = { loginType, password, username };
  const fieldErrors = {
    password: validatePassword(password),
    username: validateUsername(username),
  };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  switch (loginType) {
    case "login": {
      const user = await login({ username, password });
      console.log({ user });
      if (!user) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError:
            "Username/Password combination is incorrect",
        });
      }
      return createUserSession(user.id, redirectTo);
    }
    case "register": {
      const userExists = await db.user.findFirst({
        where: { username },
      });
      if (userExists) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError: `User with username ${username} already exists`,
        });
      }
      const user = await register({ username, password });
      if (!user) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError:
            "Something went wrong trying to create a new user.",
        });
      }
      return createUserSession(user.id, redirectTo);
    }
    default: {
      return badRequest({
        fieldErrors: null,
        fields,
        formError: "Login type invalid",
      });
    }
  }
};

export default function Login() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  return (
    <div className="container">
      <div className="content" data-light="">
        <h1>Login</h1>
        <form method="post">
          <input
            type="hidden"
            name="redirectTo"
            value={
              searchParams.get("redirectTo") ?? undefined
            }
          />
          <fieldset>
            <legend className="sr-only">
              Login or Register?
            </legend>
            <label>
              <input
                type="radio"
                name="loginType"
                value="login"
                defaultChecked={
                  !actionData?.fields?.loginType ||
                  actionData?.fields?.loginType === "login"
                }
              />{" "}
              Login
            </label>
            <label>
              <input
                type="radio"
                name="loginType"
                value="register"
                defaultChecked={
                  actionData?.fields?.loginType ===
                  "register"
                }
              />{" "}
              Register
            </label>
          </fieldset>
          <div>
            <label htmlFor="username-input">Username</label>
            <input
              type="text"
              id="username-input"
              name="username"
              defaultValue={actionData?.fields?.username}
              aria-invalid={Boolean(
                actionData?.fieldErrors?.username
              )}
              aria-errormessage={
                actionData?.fieldErrors?.username
                  ? "username-error"
                  : undefined
              }
            />
            {actionData?.fieldErrors?.username ? (
              <p
                className="form-validation-error"
                role="alert"
                id="username-error"
              >
                {actionData.fieldErrors.username}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              name="password"
              type="password"
              defaultValue={actionData?.fields?.password}
              aria-invalid={Boolean(
                actionData?.fieldErrors?.password
              )}
              aria-errormessage={
                actionData?.fieldErrors?.password
                  ? "password-error"
                  : undefined
              }
            />
            {actionData?.fieldErrors?.password ? (
              <p
                className="form-validation-error"
                role="alert"
                id="password-error"
              >
                {actionData.fieldErrors.password}
              </p>
            ) : null}
          </div>
          <div id="form-error-message">
            {actionData?.formError ? (
              <p
                className="form-validation-error"
                role="alert"
              >
                {actionData.formError}
              </p>
            ) : null}
          </div>
          <button type="submit" className="button">
            Submit
          </button>
        </form>
      </div>
      <div className="links">
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/jokes">Jokes</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[4,21-36]
import type {
  ActionArgs,
  LoaderArgs,
  V2_MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useParams,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const meta: V2_MetaFunction<typeof loader> = ({
  data,
}) => {
  const { description, title } = data
    ? {
        description: `Enjoy the "${data.joke.name}" joke and much more`,
        title: `"${data.joke.name}" joke`,
      }
    : { description: "No joke found", title: "No joke" };

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title },
  ];
};

export const loader = async ({
  params,
  request,
}: LoaderArgs) => {
  const userId = await getUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }
  return json({
    isOwner: userId === joke.jokesterId,
    joke,
  });
};

export const action = async ({
  params,
  request,
}: ActionArgs) => {
  const form = await request.formData();
  if (form.get("intent") !== "delete") {
    throw new Response(
      `The intent ${form.get("intent")} is not supported`,
      { status: 400 }
    );
  }
  const userId = await requireUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("Can't delete what does not exist", {
      status: 404,
    });
  }
  if (joke.jokesterId !== userId) {
    throw new Response(
      "Pssh, nice try. That's not your joke",
      { status: 403 }
    );
  }
  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect("/jokes");
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">"{data.joke.name}" Permalink</Link>
      {data.isOwner ? (
        <form method="post">
          <button
            className="button"
            name="intent"
            type="submit"
            value="delete"
          >
            Delete
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 400) {
      return (
        <div className="error-container">
          What you're trying to do is not allowed.
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div className="error-container">
          Sorry, but "{jokeId}" is not your joke.
        </div>
      );
    }
    if (error.status === 404) {
      return (
        <div className="error-container">
          Huh? What the heck is "{jokeId}"?
        </div>
      );
    }
  }

  return (
    <div className="error-container">
      There was an error loading joke by the id "${jokeId}".
      Sorry.
    </div>
  );
}
```

</details>

Sweet! Now search engines and social media platforms will like our site a bit better.

## Resource Routes

Sometimes we want our routes to render something other than an HTML document. For example, maybe you have an endpoint that generates your social image for a blog post, or the image for a product, or the CSV data for a report, or an RSS feed, or sitemap, or maybe you want to implement API routes for your mobile app, or anything else.

This is what [Resource Routes][resource-routes] are for. I think it'd be cool to have an RSS feed of all our jokes. I think it would make sense to be at the URL `/jokes.rss`. For that to work, you'll need to escape the `.` because that character has special meaning in Remix route filenames. Learn more about [escaping special characters here][escaping-special-characters-here].

<docs-info>Believe it or not, you've actually already made one of these. Check out your logout route! No UI necessary because it's just there to handle mutations and redirect lost souls.</docs-info>

For this one, you'll probably want to at least peek at the example unless you want to go read up on the RSS spec 😅.

💿 Make a `/jokes.rss` route.

<details>

<summary>app/routes/jokes[.]rss.tsx</summary>

```tsx filename=app/routes/jokes[.]rss.tsx
import type { LoaderArgs } from "@remix-run/node";

import { db } from "~/utils/db.server";

function escapeCdata(s: string) {
  return s.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const loader = async ({ request }: LoaderArgs) => {
  const jokes = await db.joke.findMany({
    include: { jokester: { select: { username: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const host =
    request.headers.get("X-Forwarded-Host") ??
    request.headers.get("host");
  if (!host) {
    throw new Error("Could not determine domain URL.");
  }
  const protocol = host.includes("localhost")
    ? "http"
    : "https";
  const domain = `${protocol}://${host}`;
  const jokesUrl = `${domain}/jokes`;

  const rssString = `
    <rss xmlns:blogChannel="${jokesUrl}" version="2.0">
      <channel>
        <title>Remix Jokes</title>
        <link>${jokesUrl}</link>
        <description>Some funny jokes</description>
        <language>en-us</language>
        <generator>Kody the Koala</generator>
        <ttl>40</ttl>
        ${jokes
          .map((joke) =>
            `
            <item>
              <title><![CDATA[${escapeCdata(
                joke.name
              )}]]></title>
              <description><![CDATA[A funny joke called ${escapeHtml(
                joke.name
              )}]]></description>
              <author><![CDATA[${escapeCdata(
                joke.jokester.username
              )}]]></author>
              <pubDate>${joke.createdAt.toUTCString()}</pubDate>
              <link>${jokesUrl}/${joke.id}</link>
              <guid>${jokesUrl}/${joke.id}</guid>
            </item>
          `.trim()
          )
          .join("\n")}
      </channel>
    </rss>
  `.trim();

  return new Response(rssString, {
    headers: {
      "Cache-Control": `public, max-age=${
        60 * 10
      }, s-maxage=${60 * 60 * 24}`,
      "Content-Type": "application/xml",
      "Content-Length": String(
        Buffer.byteLength(rssString)
      ),
    },
  });
};
```

</details>

![XML document for RSS feed][xml-document-for-rss-feed]

Wahoo! You can seriously do anything you can imagine with this API. You could even make a JSON API for a native version of your app if you wanted to. Lots of power here.

💿 Feel free to throw a link to that RSS feed on `app/routes/_index.tsx` and `app/routes/jokes.tsx` pages. Note that if you use `<Link />` you'll want to use the `reloadDocument` prop because you can't do a client-side transition to a URL that's not technically part of the React app.

<details>

<summary>app/routes/_index.tsx</summary>

```tsx filename=app/routes/_index.tsx lines=[22-26]
import type { LinksFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import stylesUrl from "~/styles/index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function IndexRoute() {
  return (
    <div className="container">
      <div className="content">
        <h1>
          Remix <span>Jokes!</span>
        </h1>
        <nav>
          <ul>
            <li>
              <Link to="jokes">Read Jokes</Link>
            </li>
            <li>
              <Link reloadDocument to="/jokes.rss">
                RSS
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.tsx</summary>

```tsx filename=app/routes/jokes.tsx lines=[83-89]
import type {
  LinksFunction,
  LoaderArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Link,
  Outlet,
  useLoaderData,
} from "@remix-run/react";

import stylesUrl from "~/styles/jokes.css";
import { db } from "~/utils/db.server";
import { getUser } from "~/utils/session.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const loader = async ({ request }: LoaderArgs) => {
  const jokeListItems = await db.joke.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
    take: 5,
  });
  const user = await getUser(request);

  return json({ jokeListItems, user });
};

export default function JokesRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="jokes-layout">
      <header className="jokes-header">
        <div className="container">
          <h1 className="home-link">
            <Link
              to="/"
              title="Remix Jokes"
              aria-label="Remix Jokes"
            >
              <span className="logo">🤪</span>
              <span className="logo-medium">J🤪KES</span>
            </Link>
          </h1>
          {data.user ? (
            <div className="user-info">
              <span>{`Hi ${data.user.username}`}</span>
              <form action="/logout" method="post">
                <button type="submit" className="button">
                  Logout
                </button>
              </form>
            </div>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </header>
      <main className="jokes-main">
        <div className="container">
          <div className="jokes-list">
            <Link to=".">Get a random joke</Link>
            <p>Here are a few more jokes to check out:</p>
            <ul>
              {data.jokeListItems.map(({ id, name }) => (
                <li key={id}>
                  <Link to={id}>{name}</Link>
                </li>
              ))}
            </ul>
            <Link to="new" className="button">
              Add your own
            </Link>
          </div>
          <div className="jokes-outlet">
            <Outlet />
          </div>
        </div>
      </main>
      <footer className="jokes-footer">
        <div className="container">
          <Link reloadDocument to="/jokes.rss">
            RSS
          </Link>
        </div>
      </footer>
    </div>
  );
}
```

</details>

## JavaScript...

Maybe we should actually include JavaScript on our JavaScript app. 😂

Seriously, pull up your network tab and navigate to our app.

![Network tab indicating no JavaScript is loaded][network-tab-indicating-no-java-script-is-loaded]

Did you notice that our app isn't loading any JavaScript before now? 😆 This actually is pretty significant. Our entire app can work without JavaScript on the page at all. This is because Remix leverages the platform so well for us.

Why does it matter that our app works without JavaScript? Is it because we're worried about the 0.002% of users who run around with JS disabled? Not really. It's because not everyone's connected to your app on a lightning-fast connection and sometimes JavaScript takes some time to load or fails to load at all. Making your app functional without JavaScript means that when that happens, your app _still works_ for your users even before the JavaScript finishes loading.

Another point for user experience!

There are reasons to include JavaScript on the page. For example, some common UI experiences can't be accessible without JavaScript (focus management in particular is not great when you have full-page reloads all over the place). And we can make an even nicer user experience with optimistic UI (coming soon) when we have JavaScript on the page. But we thought it'd be cool to show you how far you can get with Remix without JavaScript for your users on poor network connections. 💪

Ok, so let's load JavaScript on this page now 😆

💿 Use Remix's [`<Scripts />` component][scripts-component] to load all the JavaScript files in `app/root.tsx`.

<details>

<summary>app/root.tsx</summary>

```tsx filename=app/root.tsx lines=[11,75]
import type {
  LinksFunction,
  V2_MetaFunction,
} from "@remix-run/node";
import {
  isRouteErrorResponse,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  useRouteError,
} from "@remix-run/react";
import type { PropsWithChildren } from "react";

import globalLargeStylesUrl from "~/styles/global-large.css";
import globalMediumStylesUrl from "~/styles/global-medium.css";
import globalStylesUrl from "~/styles/global.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: globalStylesUrl },
  {
    rel: "stylesheet",
    href: globalMediumStylesUrl,
    media: "print, (min-width: 640px)",
  },
  {
    rel: "stylesheet",
    href: globalLargeStylesUrl,
    media: "screen and (min-width: 1024px)",
  },
];

export const meta: V2_MetaFunction = () => {
  const description =
    "Learn Remix and laugh at the same time!";

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title: "Remix: So great, it's funny!" },
  ];
};

function Document({
  children,
  title,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <meta name="keywords" content="Remix,jokes" />
        <meta
          name="twitter:image"
          content="https://remix-jokes.lol/social.png"
        />
        <meta
          name="twitter:card"
          content="summary_large_image"
        />
        <meta name="twitter:creator" content="@remix_run" />
        <meta name="twitter:site" content="@remix_run" />
        <meta name="twitter:title" content="Remix Jokes" />
        <Meta />
        {title ? <title>{title}</title> : null}
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <Document
        title={`${error.status} ${error.statusText}`}
      >
        <div className="error-container">
          <h1>
            {error.status} {error.statusText}
          </h1>
        </div>
      </Document>
    );
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : "Unknown error";
  return (
    <Document title="Uh-oh!">
      <div className="error-container">
        <h1>App Error</h1>
        <pre>{errorMessage}</pre>
      </div>
    </Document>
  );
}
```

</details>

![Network tab showing JavaScript loaded][network-tab-showing-java-script-loaded]

💿 Another thing we can do now is you can `console.error(error);` in all your `ErrorBoundary` components, and you'll get even server-side errors logged in the browser's console. 🤯

<details>

<summary>app/root.tsx</summary>

```tsx filename=app/root.tsx lines=[92]
import type {
  LinksFunction,
  V2_MetaFunction,
} from "@remix-run/node";
import {
  isRouteErrorResponse,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  useRouteError,
} from "@remix-run/react";
import type { PropsWithChildren } from "react";

import globalLargeStylesUrl from "~/styles/global-large.css";
import globalMediumStylesUrl from "~/styles/global-medium.css";
import globalStylesUrl from "~/styles/global.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: globalStylesUrl },
  {
    rel: "stylesheet",
    href: globalMediumStylesUrl,
    media: "print, (min-width: 640px)",
  },
  {
    rel: "stylesheet",
    href: globalLargeStylesUrl,
    media: "screen and (min-width: 1024px)",
  },
];

export const meta: V2_MetaFunction = () => {
  const description =
    "Learn Remix and laugh at the same time!";

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title: "Remix: So great, it's funny!" },
  ];
};

function Document({
  children,
  title,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <meta name="keywords" content="Remix,jokes" />
        <meta
          name="twitter:image"
          content="https://remix-jokes.lol/social.png"
        />
        <meta
          name="twitter:card"
          content="summary_large_image"
        />
        <meta name="twitter:creator" content="@remix_run" />
        <meta name="twitter:site" content="@remix_run" />
        <meta name="twitter:title" content="Remix Jokes" />
        <Meta />
        {title ? <title>{title}</title> : null}
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  if (isRouteErrorResponse(error)) {
    return (
      <Document
        title={`${error.status} ${error.statusText}`}
      >
        <div className="error-container">
          <h1>
            {error.status} {error.statusText}
          </h1>
        </div>
      </Document>
    );
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : "Unknown error";
  return (
    <Document title="Uh-oh!">
      <div className="error-container">
        <h1>App Error</h1>
        <pre>{errorMessage}</pre>
      </div>
    </Document>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[114]
import type {
  ActionArgs,
  LoaderArgs,
  V2_MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useParams,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const meta: V2_MetaFunction<typeof loader> = ({
  data,
}) => {
  const { description, title } = data
    ? {
        description: `Enjoy the "${data.joke.name}" joke and much more`,
        title: `"${data.joke.name}" joke`,
      }
    : { description: "No joke found", title: "No joke" };

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title },
  ];
};

export const loader = async ({
  params,
  request,
}: LoaderArgs) => {
  const userId = await getUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }
  return json({
    isOwner: userId === joke.jokesterId,
    joke,
  });
};

export const action = async ({
  params,
  request,
}: ActionArgs) => {
  const form = await request.formData();
  if (form.get("intent") !== "delete") {
    throw new Response(
      `The intent ${form.get("intent")} is not supported`,
      { status: 400 }
    );
  }
  const userId = await requireUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("Can't delete what does not exist", {
      status: 404,
    });
  }
  if (joke.jokesterId !== userId) {
    throw new Response(
      "Pssh, nice try. That's not your joke",
      { status: 403 }
    );
  }
  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect("/jokes");
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">"{data.joke.name}" Permalink</Link>
      {data.isOwner ? (
        <form method="post">
          <button
            className="button"
            name="intent"
            type="submit"
            value="delete"
          >
            Delete
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  const error = useRouteError();
  console.error(error);

  if (isRouteErrorResponse(error)) {
    if (error.status === 400) {
      return (
        <div className="error-container">
          What you're trying to do is not allowed.
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div className="error-container">
          Sorry, but "{jokeId}" is not your joke.
        </div>
      );
    }
    if (error.status === 404) {
      return (
        <div className="error-container">
          Huh? What the heck is "{jokeId}"?
        </div>
      );
    }
  }

  return (
    <div className="error-container">
      There was an error loading joke by the id "${jokeId}".
      Sorry.
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes._index.tsx</summary>

```tsx filename=app/routes/jokes._index.tsx lines=[42]
import { json } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";

export const loader = async () => {
  const count = await db.joke.count();
  const randomRowNumber = Math.floor(Math.random() * count);
  const [randomJoke] = await db.joke.findMany({
    skip: randomRowNumber,
    take: 1,
  });
  if (!randomJoke) {
    throw new Response("No random joke found", {
      status: 404,
    });
  }
  return json({ randomJoke });
};

export default function JokesIndexRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's a random joke:</p>
      <p>{data.randomJoke.content}</p>
      <Link to={data.randomJoke.id}>
        "{data.randomJoke.name}" Permalink
      </Link>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="error-container">
        <p>There are no jokes to display.</p>
        <Link to="new">Add your own</Link>
      </div>
    );
  }

  return (
    <div className="error-container">
      I did a whoopsies.
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx lines=[155]
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  isRouteErrorResponse,
  Link,
  useActionData,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return json({});
};

function validateJokeContent(content: string) {
  if (content.length < 10) {
    return "That joke is too short";
  }
}

function validateJokeName(name: string) {
  if (name.length < 3) {
    return "That joke's name is too short";
  }
}

export const action = async ({ request }: ActionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const content = form.get("content");
  const name = form.get("name");
  if (
    typeof content !== "string" ||
    typeof name !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fieldErrors = {
    content: validateJokeContent(content),
    name: validateJokeName(name),
  };
  const fields = { content, name };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  const joke = await db.joke.create({
    data: { ...fields, jokesterId: userId },
  });
  return redirect(`/jokes/${joke.id}`);
};

export default function NewJokeRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <p>Add your own hilarious joke</p>
      <form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              defaultValue={actionData?.fields?.name}
              name="name"
              type="text"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.name
              )}
              aria-errormessage={
                actionData?.fieldErrors?.name
                  ? "name-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p
              className="form-validation-error"
              id="name-error"
              role="alert"
            >
              {actionData.fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={actionData?.fields?.content}
              name="content"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.content
              )}
              aria-errormessage={
                actionData?.fieldErrors?.content
                  ? "content-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              id="content-error"
              role="alert"
            >
              {actionData.fieldErrors.content}
            </p>
          ) : null}
        </div>
        <div>
          {actionData?.formError ? (
            <p
              className="form-validation-error"
              role="alert"
            >
              {actionData.formError}
            </p>
          ) : null}
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  if (isRouteErrorResponse(error) && error.status === 401) {
    return (
      <div className="error-container">
        <p>You must be logged in to create a joke.</p>
        <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <div className="error-container">
      Something unexpected went wrong. Sorry about that.
    </div>
  );
}
```

</details>

![Browser console showing the log of a server-side error][browser-console-showing-the-log-of-a-server-side-error]

### Forms

Remix has its own [`<Form />`][form] component. When JavaScript is not yet loaded, it works the same way as a regular form, but when JavaScript is enabled, it's "progressively enhanced" to make a `fetch` request instead, so we don't do a full-page reload.

💿 Find all `<form />` elements and change them to the Remix `<Form />` component.

<details>

<summary>app/routes/login.tsx</summary>

```tsx filename=app/routes/login.tsx lines=[7,143,245]
import type {
  ActionArgs,
  LinksFunction,
  V2_MetaFunction,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useSearchParams,
} from "@remix-run/react";

import stylesUrl from "~/styles/login.css";
import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import {
  createUserSession,
  login,
  register,
} from "~/utils/session.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const meta: V2_MetaFunction = () => {
  const description =
    "Login to submit your own jokes to Remix Jokes!";

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title: "Remix Jokes | Login" },
  ];
};

function validateUsername(username: string) {
  if (username.length < 3) {
    return "Usernames must be at least 3 characters long";
  }
}

function validatePassword(password: string) {
  if (password.length < 6) {
    return "Passwords must be at least 6 characters long";
  }
}

function validateUrl(url: string) {
  const urls = ["/jokes", "/", "https://remix.run"];
  if (urls.includes(url)) {
    return url;
  }
  return "/jokes";
}

export const action = async ({ request }: ActionArgs) => {
  const form = await request.formData();
  const loginType = form.get("loginType");
  const password = form.get("password");
  const username = form.get("username");
  const redirectTo = validateUrl(
    (form.get("redirectTo") as string) || "/jokes"
  );
  if (
    typeof loginType !== "string" ||
    typeof password !== "string" ||
    typeof username !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fields = { loginType, password, username };
  const fieldErrors = {
    password: validatePassword(password),
    username: validateUsername(username),
  };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  switch (loginType) {
    case "login": {
      const user = await login({ username, password });
      console.log({ user });
      if (!user) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError:
            "Username/Password combination is incorrect",
        });
      }
      return createUserSession(user.id, redirectTo);
    }
    case "register": {
      const userExists = await db.user.findFirst({
        where: { username },
      });
      if (userExists) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError: `User with username ${username} already exists`,
        });
      }
      const user = await register({ username, password });
      if (!user) {
        return badRequest({
          fieldErrors: null,
          fields,
          formError:
            "Something went wrong trying to create a new user.",
        });
      }
      return createUserSession(user.id, redirectTo);
    }
    default: {
      return badRequest({
        fieldErrors: null,
        fields,
        formError: "Login type invalid",
      });
    }
  }
};

export default function Login() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  return (
    <div className="container">
      <div className="content" data-light="">
        <h1>Login</h1>
        <Form method="post">
          <input
            type="hidden"
            name="redirectTo"
            value={
              searchParams.get("redirectTo") ?? undefined
            }
          />
          <fieldset>
            <legend className="sr-only">
              Login or Register?
            </legend>
            <label>
              <input
                type="radio"
                name="loginType"
                value="login"
                defaultChecked={
                  !actionData?.fields?.loginType ||
                  actionData?.fields?.loginType === "login"
                }
              />{" "}
              Login
            </label>
            <label>
              <input
                type="radio"
                name="loginType"
                value="register"
                defaultChecked={
                  actionData?.fields?.loginType ===
                  "register"
                }
              />{" "}
              Register
            </label>
          </fieldset>
          <div>
            <label htmlFor="username-input">Username</label>
            <input
              type="text"
              id="username-input"
              name="username"
              defaultValue={actionData?.fields?.username}
              aria-invalid={Boolean(
                actionData?.fieldErrors?.username
              )}
              aria-errormessage={
                actionData?.fieldErrors?.username
                  ? "username-error"
                  : undefined
              }
            />
            {actionData?.fieldErrors?.username ? (
              <p
                className="form-validation-error"
                role="alert"
                id="username-error"
              >
                {actionData.fieldErrors.username}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              name="password"
              type="password"
              defaultValue={actionData?.fields?.password}
              aria-invalid={Boolean(
                actionData?.fieldErrors?.password
              )}
              aria-errormessage={
                actionData?.fieldErrors?.password
                  ? "password-error"
                  : undefined
              }
            />
            {actionData?.fieldErrors?.password ? (
              <p
                className="form-validation-error"
                role="alert"
                id="password-error"
              >
                {actionData.fieldErrors.password}
              </p>
            ) : null}
          </div>
          <div id="form-error-message">
            {actionData?.formError ? (
              <p
                className="form-validation-error"
                role="alert"
              >
                {actionData.formError}
              </p>
            ) : null}
          </div>
          <button type="submit" className="button">
            Submit
          </button>
        </Form>
      </div>
      <div className="links">
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/jokes">Jokes</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.tsx</summary>

```tsx filename=app/routes/jokes.tsx lines=[7,52,56]
import type {
  LinksFunction,
  LoaderArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Link,
  Outlet,
  useLoaderData,
} from "@remix-run/react";

import stylesUrl from "~/styles/jokes.css";
import { db } from "~/utils/db.server";
import { getUser } from "~/utils/session.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const loader = async ({ request }: LoaderArgs) => {
  const jokeListItems = await db.joke.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
    take: 5,
  });
  const user = await getUser(request);

  return json({ jokeListItems, user });
};

export default function JokesRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="jokes-layout">
      <header className="jokes-header">
        <div className="container">
          <h1 className="home-link">
            <Link
              to="/"
              title="Remix Jokes"
              aria-label="Remix Jokes"
            >
              <span className="logo">🤪</span>
              <span className="logo-medium">J🤪KES</span>
            </Link>
          </h1>
          {data.user ? (
            <div className="user-info">
              <span>{`Hi ${data.user.username}`}</span>
              <Form action="/logout" method="post">
                <button type="submit" className="button">
                  Logout
                </button>
              </Form>
            </div>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </header>
      <main className="jokes-main">
        <div className="container">
          <div className="jokes-list">
            <Link to=".">Get a random joke</Link>
            <p>Here are a few more jokes to check out:</p>
            <ul>
              {data.jokeListItems.map(({ id, name }) => (
                <li key={id}>
                  <Link to={id}>{name}</Link>
                </li>
              ))}
            </ul>
            <Link to="new" className="button">
              Add your own
            </Link>
          </div>
          <div className="jokes-outlet">
            <Outlet />
          </div>
        </div>
      </main>
      <footer className="jokes-footer">
        <div className="container">
          <Link reloadDocument to="/jokes.rss">
            RSS
          </Link>
        </div>
      </footer>
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[8,97,106]
import type {
  ActionArgs,
  LoaderArgs,
  V2_MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useParams,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const meta: V2_MetaFunction<typeof loader> = ({
  data,
}) => {
  const { description, title } = data
    ? {
        description: `Enjoy the "${data.joke.name}" joke and much more`,
        title: `"${data.joke.name}" joke`,
      }
    : { description: "No joke found", title: "No joke" };

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title },
  ];
};

export const loader = async ({
  params,
  request,
}: LoaderArgs) => {
  const userId = await getUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }
  return json({
    isOwner: userId === joke.jokesterId,
    joke,
  });
};

export const action = async ({
  params,
  request,
}: ActionArgs) => {
  const form = await request.formData();
  if (form.get("intent") !== "delete") {
    throw new Response(
      `The intent ${form.get("intent")} is not supported`,
      { status: 400 }
    );
  }
  const userId = await requireUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("Can't delete what does not exist", {
      status: 404,
    });
  }
  if (joke.jokesterId !== userId) {
    throw new Response(
      "Pssh, nice try. That's not your joke",
      { status: 403 }
    );
  }
  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect("/jokes");
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">"{data.joke.name}" Permalink</Link>
      {data.isOwner ? (
        <Form method="post">
          <button
            className="button"
            name="intent"
            type="submit"
            value="delete"
          >
            Delete
          </button>
        </Form>
      ) : null}
    </div>
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  const error = useRouteError();
  console.error(error);

  if (isRouteErrorResponse(error)) {
    if (error.status === 400) {
      return (
        <div className="error-container">
          What you're trying to do is not allowed.
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div className="error-container">
          Sorry, but "{jokeId}" is not your joke.
        </div>
      );
    }
    if (error.status === 404) {
      return (
        <div className="error-container">
          Huh? What the heck is "{jokeId}"?
        </div>
      );
    }
  }

  return (
    <div className="error-container">
      There was an error loading joke by the id "${jokeId}".
      Sorry.
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx lines=[7,82,149]
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  isRouteErrorResponse,
  Link,
  useActionData,
  useRouteError,
} from "@remix-run/react";

import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return json({});
};

function validateJokeContent(content: string) {
  if (content.length < 10) {
    return "That joke is too short";
  }
}

function validateJokeName(name: string) {
  if (name.length < 3) {
    return "That joke's name is too short";
  }
}

export const action = async ({ request }: ActionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const content = form.get("content");
  const name = form.get("name");
  if (
    typeof content !== "string" ||
    typeof name !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fieldErrors = {
    content: validateJokeContent(content),
    name: validateJokeName(name),
  };
  const fields = { content, name };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  const joke = await db.joke.create({
    data: { ...fields, jokesterId: userId },
  });
  return redirect(`/jokes/${joke.id}`);
};

export default function NewJokeRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <p>Add your own hilarious joke</p>
      <Form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              defaultValue={actionData?.fields?.name}
              name="name"
              type="text"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.name
              )}
              aria-errormessage={
                actionData?.fieldErrors?.name
                  ? "name-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p
              className="form-validation-error"
              id="name-error"
              role="alert"
            >
              {actionData.fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={actionData?.fields?.content}
              name="content"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.content
              )}
              aria-errormessage={
                actionData?.fieldErrors?.content
                  ? "content-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              id="content-error"
              role="alert"
            >
              {actionData.fieldErrors.content}
            </p>
          ) : null}
        </div>
        <div>
          {actionData?.formError ? (
            <p
              className="form-validation-error"
              role="alert"
            >
              {actionData.formError}
            </p>
          ) : null}
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </Form>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  if (isRouteErrorResponse(error) && error.status === 401) {
    return (
      <div className="error-container">
        <p>You must be logged in to create a joke.</p>
        <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <div className="error-container">
      Something unexpected went wrong. Sorry about that.
    </div>
  );
}
```

</details>

### Prefetching

If a user focuses or mouses-over a link, it's likely they want to go there. So we can prefetch the page that they're going to. And this is all it takes to enable that for a specific link:

```
<Link prefetch="intent" to="somewhere/neat">Somewhere Neat</Link>
```

💿 Add `prefetch="intent"` to the list of Joke links in `app/routes/jokes.tsx`.

<details>

<summary>app/routes/jokes.tsx</summary>

```tsx filename=app/routes/jokes.tsx lines=[71]
import type {
  LinksFunction,
  LoaderArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Link,
  Outlet,
  useLoaderData,
} from "@remix-run/react";

import stylesUrl from "~/styles/jokes.css";
import { db } from "~/utils/db.server";
import { getUser } from "~/utils/session.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const loader = async ({ request }: LoaderArgs) => {
  const jokeListItems = await db.joke.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
    take: 5,
  });
  const user = await getUser(request);

  return json({ jokeListItems, user });
};

export default function JokesRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="jokes-layout">
      <header className="jokes-header">
        <div className="container">
          <h1 className="home-link">
            <Link
              to="/"
              title="Remix Jokes"
              aria-label="Remix Jokes"
            >
              <span className="logo">🤪</span>
              <span className="logo-medium">J🤪KES</span>
            </Link>
          </h1>
          {data.user ? (
            <div className="user-info">
              <span>{`Hi ${data.user.username}`}</span>
              <Form action="/logout" method="post">
                <button type="submit" className="button">
                  Logout
                </button>
              </Form>
            </div>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>
      </header>
      <main className="jokes-main">
        <div className="container">
          <div className="jokes-list">
            <Link to=".">Get a random joke</Link>
            <p>Here are a few more jokes to check out:</p>
            <ul>
              {data.jokeListItems.map(({ id, name }) => (
                <li key={id}>
                  <Link prefetch="intent" to={id}>
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="new" className="button">
              Add your own
            </Link>
          </div>
          <div className="jokes-outlet">
            <Outlet />
          </div>
        </div>
      </main>
      <footer className="jokes-footer">
        <div className="container">
          <Link reloadDocument to="/jokes.rss">
            RSS
          </Link>
        </div>
      </footer>
    </div>
  );
}
```

</details>

## Optimistic UI

Now that we have JavaScript on the page, we can benefit from _progressive enhancement_ and make our site _even better_ with JavaScript by adding some _optimistic UI_ to our app.

Even though our app is quite fast (especially locally 😅), some users may have a poor connection to our app. This means that they're going to submit their jokes, but then they'll have to wait for a while before they see anything. We could add a loading spinner somewhere, but it'd be a much better user experience to be optimistic about the success of the request and render what the user would see.

We have a pretty in depth [guide on Optimistic UI][guide-on-optimistic-ui], so go give that a read

💿 Add optimistic UI to the `app/routes/jokes.new.tsx` route.

Note, you'll probably want to create a new file in `app/components/` called `joke.tsx` so you can reuse that UI in both `app/routes/jokes.$jokeId.tsx` & `app/routes/jokes.new.tsx`.

<details>

<summary>app/components/joke.tsx</summary>

```tsx filename=app/components/joke.tsx lines=[5,9,16-18,22]
import type { Joke } from "@prisma/client";
import { Form, Link } from "@remix-run/react";

export function JokeDisplay({
  canDelete = true,
  isOwner,
  joke,
}: {
  canDelete?: boolean;
  isOwner: boolean;
  joke: Pick<Joke, "content" | "name">;
}) {
  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{joke.content}</p>
      <Link to=".">"{joke.name}" Permalink</Link>
      {isOwner ? (
        <Form method="post">
          <button
            className="button"
            disabled={!canDelete}
            name="intent"
            type="submit"
            value="delete"
          >
            Delete
          </button>
        </Form>
      ) : null}
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.$jokeId.tsx</summary>

```tsx filename=app/routes/jokes.$jokeId.tsx lines=[14,91]
import type {
  ActionArgs,
  LoaderArgs,
  V2_MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  isRouteErrorResponse,
  useLoaderData,
  useParams,
  useRouteError,
} from "@remix-run/react";

import { JokeDisplay } from "~/components/joke";
import { db } from "~/utils/db.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const meta: V2_MetaFunction<typeof loader> = ({
  data,
}) => {
  const { description, title } = data
    ? {
        description: `Enjoy the "${data.joke.name}" joke and much more`,
        title: `"${data.joke.name}" joke`,
      }
    : { description: "No joke found", title: "No joke" };

  return [
    { name: "description", content: description },
    { name: "twitter:description", content: description },
    { title },
  ];
};

export const loader = async ({
  params,
  request,
}: LoaderArgs) => {
  const userId = await getUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("What a joke! Not found.", {
      status: 404,
    });
  }
  return json({
    isOwner: userId === joke.jokesterId,
    joke,
  });
};

export const action = async ({
  params,
  request,
}: ActionArgs) => {
  const form = await request.formData();
  if (form.get("intent") !== "delete") {
    throw new Response(
      `The intent ${form.get("intent")} is not supported`,
      { status: 400 }
    );
  }
  const userId = await requireUserId(request);
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });
  if (!joke) {
    throw new Response("Can't delete what does not exist", {
      status: 404,
    });
  }
  if (joke.jokesterId !== userId) {
    throw new Response(
      "Pssh, nice try. That's not your joke",
      { status: 403 }
    );
  }
  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect("/jokes");
};

export default function JokeRoute() {
  const data = useLoaderData<typeof loader>();

  return (
    <JokeDisplay isOwner={data.isOwner} joke={data.joke} />
  );
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  const error = useRouteError();
  console.error(error);

  if (isRouteErrorResponse(error)) {
    if (error.status === 400) {
      return (
        <div className="error-container">
          What you're trying to do is not allowed.
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div className="error-container">
          Sorry, but "{jokeId}" is not your joke.
        </div>
      );
    }
    if (error.status === 404) {
      return (
        <div className="error-container">
          Huh? What the heck is "{jokeId}"?
        </div>
      );
    }
  }

  return (
    <div className="error-container">
      There was an error loading joke by the id "${jokeId}".
      Sorry.
    </div>
  );
}
```

</details>

<details>

<summary>app/routes/jokes.new.tsx</summary>

```tsx filename=app/routes/jokes.new.tsx lines=[11,15,80,82-99]
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  isRouteErrorResponse,
  Link,
  useActionData,
  useNavigation,
  useRouteError,
} from "@remix-run/react";

import { JokeDisplay } from "~/components/joke";
import { db } from "~/utils/db.server";
import { badRequest } from "~/utils/request.server";
import {
  getUserId,
  requireUserId,
} from "~/utils/session.server";

export const loader = async ({ request }: LoaderArgs) => {
  const userId = await getUserId(request);
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return json({});
};

function validateJokeContent(content: string) {
  if (content.length < 10) {
    return "That joke is too short";
  }
}

function validateJokeName(name: string) {
  if (name.length < 3) {
    return "That joke's name is too short";
  }
}

export const action = async ({ request }: ActionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const content = form.get("content");
  const name = form.get("name");
  if (
    typeof content !== "string" ||
    typeof name !== "string"
  ) {
    return badRequest({
      fieldErrors: null,
      fields: null,
      formError: "Form not submitted correctly.",
    });
  }

  const fieldErrors = {
    content: validateJokeContent(content),
    name: validateJokeName(name),
  };
  const fields = { content, name };
  if (Object.values(fieldErrors).some(Boolean)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  const joke = await db.joke.create({
    data: { ...fields, jokesterId: userId },
  });
  return redirect(`/jokes/${joke.id}`);
};

export default function NewJokeRoute() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  if (navigation.formData) {
    const content = navigation.formData.get("content");
    const name = navigation.formData.get("name");
    if (
      typeof content === "string" &&
      typeof name === "string" &&
      !validateJokeContent(content) &&
      !validateJokeName(name)
    ) {
      return (
        <JokeDisplay
          canDelete={false}
          isOwner={true}
          joke={{ name, content }}
        />
      );
    }
  }

  return (
    <div>
      <p>Add your own hilarious joke</p>
      <Form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              defaultValue={actionData?.fields?.name}
              name="name"
              type="text"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.name
              )}
              aria-errormessage={
                actionData?.fieldErrors?.name
                  ? "name-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p
              className="form-validation-error"
              id="name-error"
              role="alert"
            >
              {actionData.fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label>
            Content:{" "}
            <textarea
              defaultValue={actionData?.fields?.content}
              name="content"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.content
              )}
              aria-errormessage={
                actionData?.fieldErrors?.content
                  ? "content-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              id="content-error"
              role="alert"
            >
              {actionData.fieldErrors.content}
            </p>
          ) : null}
        </div>
        <div>
          {actionData?.formError ? (
            <p
              className="form-validation-error"
              role="alert"
            >
              {actionData.formError}
            </p>
          ) : null}
          <button type="submit" className="button">
            Add
          </button>
        </div>
      </Form>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  if (isRouteErrorResponse(error) && error.status === 401) {
    return (
      <div className="error-container">
        <p>You must be logged in to create a joke.</p>
        <Link to="/login">Login</Link>
      </div>
    );
  }

  return (
    <div className="error-container">
      Something unexpected went wrong. Sorry about that.
    </div>
  );
}
```

</details>

One thing I like about my example is that it can use the _exact_ same validation functions that the server uses! So if what they submitted will fail server-side validation, we don't even bother rendering the optimistic UI because we know it would fail.

That said, this declarative optimistic UI approach is fantastic because we don't have to worry about error recovery. If the request fails, then our component will be re-rendered, it will no longer be a submission and everything will work as it did before. Nice!

Here's a demonstration of what that experience looks like:

<video src="/jokes-tutorial/img/optimistic-ui.mp4" controls muted loop autoplay></video>

## Deployment

I feel pretty great about the user experience we've created here. So let's get this thing deployed! With Remix, you have a lot of options for deployment. When you ran `npx create-remix@latest` at the start of this tutorial, there were several options given to you. Because the tutorial we've built relies on Node.js (`prisma`), we're going to deploy to one of our favorite hosting providers: [Fly.io][fly-io].

💿 Before proceeding, you're going to need to [install fly][install-fly] and [sign up for an account][sign-up-for-an-account].

<docs-info>Fly.io asks you a credit card number at account creation (see why in [their blog article][their-blog-article]) but there are free tiers that cover the needs of this app hosted as a simple side project.</docs-info>

💿 Once you've done that, run this command from within your project directory:

```sh
fly launch
```

The folks at fly were kind enough to put together a great setup experience. They'll detect your Remix project and ask you a few questions to get you started. Here's my output/choices:

```
Creating app in /Users/kentcdodds/Desktop/remix-jokes
Scanning source code
Detected a Remix app
? Choose an app name (leave blank to generate one): remix-jokes
automatically selected personal organization: Kent C. Dodds
Some regions require a paid plan (fra, maa).
See https://fly.io/plans to set up a plan.

? Choose a region for deployment: Dallas, Texas (US) (dfw)
Created app 'remix-jokes' in organization 'personal'
Admin URL: https://fly.io/apps/remix-jokes
Hostname: remix-jokes.fly.dev
Created a 1GB volume vol_18l524yj27947zmp in the dfw region
Wrote config file fly.toml

This launch configuration uses SQLite on a single, dedicated volume. It will not scale beyond a single VM. Look into 'fly postgres' for a more robust production database.

? Would you like to deploy now? No
Your app is ready! Deploy with `flyctl deploy`
```

You'll want to choose a different app name because I already took `remix-jokes` (sorry 🙃).

It also allowed you to select a region, I recommend choosing one that's close to you. If you decide to deploy a real app on Fly in the future, you may decide to scale up your fly to multiple regions.

Fly also detected that this project is using SQLite with Prisma and created a persistence volume for us.

We don't want to deploy right now because we have an environment variable we need to set! So choose "No".

Fly generated a few files for us:

- `fly.toml` - Fly-specific configuration
- `Dockerfile` - Remix-specific Dockerfile for the app
- `.dockerignore` - It just ignores `node_modules` because we'll run the installation as we build the image.

💿 Now set the `SESSION_SECRET` environment variable by running this command:

```sh
fly secrets set SESSION_SECRET=your-secret-here
```

`your-secret-here` can be whatever you want. It's just a string that's used to sign the session cookie. Use a password generator if you like.

One other thing we need to do is get Prisma ready to set up our database for the first time. Now that we're happy with our schema, we can create our first migration.

💿 Run this command:

```sh
npx prisma migrate dev
```

This will create a migration file in the `migrations` directory. You may get an error when it tries to run the seed file. You can safely ignore that. It will ask you what you want to call your migration:

```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

SQLite database dev.db created at file:./dev.db

✔ Enter a name for the new migration: … init
```

💿 I called mine "init". Then you'll get the rest of the output:

```
Applying migration `20211121111251_init`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20211121111251_init/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (4.12.0 | library) to ./node_modules/@prisma/client in 52ms


Running seed command `ts-node --require tsconfig-paths/register prisma/seed.ts` ...

🌱  The seed command has been executed.
```

💿 If you did get an error when running the seed, you can run it manually now:

```sh
npx prisma db seed
```

With that done, you're ready to deploy.

💿 Run this command:

```sh
fly deploy
```

This will build the docker image and deploy it on Fly in the region you selected. It will take a little while. While you wait, you can think of someone you haven't talked to in a while and shoot them a message telling them why you appreciate them.

Great! We're done and you made someone's day! Success!

Your app is now live at `https://<your-app-name>.fly.dev`! You can find that URL in your fly account online as well: [fly.io/apps][fly-io-apps].

Any time you make a change, simply run `fly deploy` again to redeploy.

## Conclusion

Phew! And there we have it. If you made it through this whole thing then I'm really impressed ([tweet your success][tweet-your-success])! There's a lot to Remix, and we've only gotten you started. Good luck on the rest of your Remix journey!

[remix-jokes]: https://remix-jokes.lol
[mdn]: https://developer.mozilla.org/en-US
[prisma]: https://www.prisma.io
[code-sandbox]: https://codesandbox.com
[node-js]: https://nodejs.org
[npm]: https://www.npmjs.com
[vs-code]: https://code.visualstudio.com
[fly-io]: https://fly.io
[java-script-to-know-for-react]: https://kentcdodds.com/blog/javascript-to-know-for-react
[the-beginner-s-guide-to-react]: https://kcd.im/beginner-react
[the-http-api]: https://developer.mozilla.org/en-US/docs/Web/HTTP
[the-basic-example]: https://codesandbox.io/s/github/remix-run/examples/tree/main/basic
[express]: https://expressjs.com
[hydrate]: https://react.dev/reference/react-dom/client/hydrateRoot
[http-localhost-3000]: http://localhost:3000
[bare-bones-hello-world-app]: /jokes-tutorial/img/bare-bones.png
[remix-config-js]: ../file-conventions/remix-config
[route-module]: ../route/route-module
[the-route-filename-convention]: ../file-conventions/route-files-v2
[react-router]: https://reactrouter.com
[a-greeting-from-the-index-route]: /jokes-tutorial/img/index-route-greeting.png
[jokes]: http://localhost:3000/jokes
[a-random-joke-on-the-jokes-page-i-was-wondering-why-the-frisbee-was-getting-bigger-then-it-hit-me]: /jokes-tutorial/img/random-joke.png
[jokes-new]: http://localhost:3000/jokes/new
[a-new-joke-form]: /jokes-tutorial/img/new-joke.png
[jokes-anything-you-want]: http://localhost:3000/jokes/hippos
[a-new-joke-form-2]: /jokes-tutorial/img/param-route.png
[links]: ../route/links
[links-2]: ../components/link
[the-homepage-with-a-purple-gradient-background-and-white-text-with-the-words-hello-index-route]: /jokes-tutorial/img/homepage-styles.png
[the-jokes-page-with-no-background-gradient]: /jokes-tutorial/img/jokes-no-styles.png
[check-out-the-mdn-page-for-link]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link
[styled-components]: https://www.styled-components.com
[tailwind]: https://tailwindcss.com
[firebase]: https://firebase.google.com
[supabase]: https://supabase.com
[airtable]: https://www.airtable.com
[hasura]: https://hasura.io
[google-spreadsheets]: https://www.google.com/sheets/about
[cloudflare-workers-kv]: https://www.cloudflare.com/products/workers-kv
[fauna]: https://fauna.com/features
[postgre-sql]: https://www.postgresql.org
[a-vs-code-extension]: https://marketplace.visualstudio.com/items?itemName=Prisma.prisma
[sq-lite]: https://sqlite.org/index.html
[their-docs]: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference
[loader]: ../route/loader
[use-loader-data]: ../hooks/use-loader-data
[list-of-links-to-jokes]: /jokes-tutorial/img/jokes-loaded.png
[huge-graphql-client]: https://bundlephobia.com/package/graphql@16.0.1
[assertion-functions]: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
[zod]: https://npm.im/zod
[jokes-page-showing-a-unique-joke]: /jokes-tutorial/img/joke-page.png
[jokes-page-showing-a-random-joke]: /jokes-tutorial/img/random-joke-loaded.png
[action]: ../route/action
[response]: https://developer.mozilla.org/en-US/docs/Web/API/Response
[create-new-joke-form-filled-out]: /jokes-tutorial/img/creating-new-joke.png
[newly-created-joke-displayed]: /jokes-tutorial/img/new-joke-created.png
[use-action-data]: ../hooks/use-action-data
[new-joke-form-with-validation-errors]: /jokes-tutorial/img/new-joke-form-with-errors.png
[400-bad-request]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400
[http-cookies]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
[bcryptjs]: https://npm.im/bcryptjs
[excalidraw-authentication-diagram]: /jokes-tutorial/img/auth-flow.png
[a-login-form-with-a-login-register-radio-button-and-username-password-fields-and-a-submit-button]: /jokes-tutorial/img/login-route.png
[login-form-with-errors]: /jokes-tutorial/img/login-form-with-errors.png
[here-are-the-docs]: ../utils/sessions
[create-cookie-session-storage]: ../utils/sessions#createcookiesessionstorage
[network-tab]: https://developer.chrome.com/docs/devtools/network/reference
[login]: http://localhost:3000/login
[dev-tools-network-tab-showing-a-set-cookie-header-on-the-post-response]: /jokes-tutorial/img/network-tab-set-cookie.png
[application-tab]: https://developer.chrome.com/docs/devtools/storage/cookies
[dev-tools-application-tab-showing]: /jokes-tutorial/img/application-tab-cookies.png
[request-headers-showing-the-cookie]: /jokes-tutorial/img/cookie-header-on-request.png
[destroy-session]: ../utils/sessions#using-sessions
[csrf]: https://developer.mozilla.org/en-US/docs/Glossary/CSRF
[jokes-page-nice-and-designed]: /jokes-tutorial/img/random-joke-designed.png
[new-joke-form-designed]: /jokes-tutorial/img/new-joke-designed.png
[error-boundary-feature]: https://reactjs.org/docs/error-boundaries.html#gatsby-focus-wrapper
[error-boundary-component]: ../route/error-boundary-v2
[app-error]: /jokes-tutorial/img/app-level-error.png
[joke-page-error]: /jokes-tutorial/img/joke-id-error.png
[joke-index-page-error]: /jokes-tutorial/img/jokes-index-error.png
[new-joke-page-error]: /jokes-tutorial/img/new-joke-error.png
[server-errors]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#server_error_responses
[client-errors]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses
[is-route-error-response]: ../utils/is-route-error-response
[app-400-bad-request]: /jokes-tutorial/img/app-400.png
[a-404-on-the-joke-page]: /jokes-tutorial/img/joke-404.png
[a-404-on-the-random-joke-page]: /jokes-tutorial/img/jokes-404.png
[a-401-on-the-new-joke-page]: /jokes-tutorial/img/new-joke-401.png
[meta]: ../route/meta-v2
[meta-component]: ../components/meta
[resource-routes]: ../guides/resource-routes
[escaping-special-characters-here]: ../file-conventions/routes-files#escaping-special-characters
[xml-document-for-rss-feed]: /jokes-tutorial/img/jokes-rss-feed.png
[network-tab-indicating-no-java-script-is-loaded]: /jokes-tutorial/img/no-javascript.png
[scripts-component]: ../components/scripts
[network-tab-showing-java-script-loaded]: /jokes-tutorial/img/yes-javascript.png
[browser-console-showing-the-log-of-a-server-side-error]: /jokes-tutorial/img/server-side-error-in-browser.png
[form]: ../components/form
[guide-on-optimistic-ui]: ../guides/optimistic-ui
[install-fly]: https://fly.io/docs/hands-on/installing
[sign-up-for-an-account]: https://fly.io/docs/hands-on/sign-up
[their-blog-article]: https://fly.io/blog/free-postgres/#a-note-about-credit-cards
[fly-io-apps]: https://fly.io/apps
[tweet-your-success]: https://twitter.com/intent/tweet?text=I%20went%20through%20the%20whole%20remix.run%20jokes%20tutorial!%20%F0%9F%92%BF%20And%20now%20I%20love%20@remix_run!&url=https://remix.run/tutorials/jokes
