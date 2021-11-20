---
title: Jokes App
order: 2
---

# Jokes App Tutorial

You want to learn Remix? You're in the right place. This tutorial is the fast-track to getting an overview of the primary APIs available in Remix. By the end, you'll have a full application you can show your mom, significant other, or dog and I'm sure they'll be just as excited about Remix as you are (though I make no guarantees).

We're going to be laser focused on Remix. This means that we're going to skip over a few things that are a distraction from the core ideas we want you to learn about Remix. For example, we'll show you how to get a CSS stylesheet on the page, but we're not going to make you write the styles by yourself. So we'll just give you stuff you can copy/paste for that kind of thing. However, if you'd prefer to write it all out yourself, you totally can (it'll just take you much longer). So we'll put it in little `<details>` elements you have to click to expand to not spoil anything if you'd prefer to code it out yourself.

We'll be linking to various docs (Remix docs as well as web docs on MDN) throughout the tutorial. If you're ever stuck, make sure you check into any docs links you may have skipped. Part of the goal of this tutorial is to get you acclamated to the API documentation, so if something's explained in the docs, then you'll be linked to those instead of rehashing it all out in here.

This tutorial will be using TypeScript. Feel free to follow along and skip/remove the TypeScript bits. We find that Remix is made even better when your using TypeScript, especially since we'll also be using [prisma](https://www.prisma.io/) to access our data models from the sqlite database.

<details>

  <summary>Click me</summary>

There are several areas in the tutorial where we stick code behind one of these `<details>` elements. This is so you can choose how much copy/paste you want to do without us spoiling it for you. We recommend you not waste your time struggling with stuff that's unrelated to Remix-specifically. This isn't the time to waste effort guessing what class names to use. Feel free to reference these once you get the main point of the tutorial. Use these to check your work.

</details>

💿 Hello, I'm Rachel the Remix Disk. This tutorial has a lot of words and mixed throughout is stuff you're actually supposed to _do_ that can kinda get lost in the words. So I'll show up wherever you're supposed to actually _do_ something. Enjoy the tutorial!

## Outline

Here are the topics we'll be covering in this tutorial:

- Generating a new Remix project
- Conventional files
- Routes (including the nested variety ✨)
- Styling
- Database interactions (via `sqlite` and `prisma`)
- Authentication
- Mutations
- Validation
- Resource Routes
- Unexpected (we made a whoopsies) and expected (you made a whoopsies) Error Handling
- Deployment

## Prerequisites

You can follow along with this tutorial on [StackBlitz](https://stackblitz.com/) (a fantastic in-browser editor) or locally on your own computer. If you use the StackBlitz approach then all you need is a good internet connection and a modern browser. If you run things locally then you're going to need some things installed:

- [Node.js](https://nodejs.org) 14 or greater
- [npm](https://www.npmjs.com) 7 or greater
- A code editor ([VSCode](https://code.visualstudio.com/) is a nice one)

If you'd like to follow along with the deploy step at the end, you'll also want an account on [Fly.io](https://fly.io)

We'll also be executing commands in your system command line/terminal interface. So you'll want to be familiar with that.

Some experience with React and TypeScript/JavaScript is assumed. If you'd like to review your knowledge, check out these resources:

- [JavaScript to know for React](https://kentcdodds.com/blog/javascript-to-know-for-react)
- [The Beginner's Guide to React](https://kcd.im/beginner-react)

With that, I think we're ready to get started!

## Generating a new Remix project

<docs-info>

If you're planning on using StackBlitz, you can skip this first part, we've got a StackBlitz project already set up for you [here]()

</docs-info>

💿 Open your terminal and run this command:

```sh
npx create-remix@latest
```

<docs-info>

This may ask you whether you want to install `create-remix` to run the command. Enter `y`. It will only be installed temporarily to run the setup script.

</docs-info>

When the fun Remix animation is finished, it'll ask you a few questions. We'll call our app "remix-jokes", choose the "Remix App Server" deploy target, use TypeScript, and have it run the installation for us:

```
$ npx create-remix@latest

R E M I X

💿 Welcome to Remix! Let's get you set up with a new project.

? Where would you like to create your app? remix-jokes
? Where do you want to deploy? Choose Remix if you're unsure, it's easy to change deployment targets. Remix
 App Server
? TypeScript or JavaScript? TypeScript
? Do you want me to run `npm install`? Yes
```

<docs-info>

Remix can be deployed in a large and growing list of JavaScript environments. The "Remix App Server" is a full-featured Express.js-based Node.js server. It's the simplest option, so that's what we're going with for this tutorial. Feel free to experiment in the future!

</docs-info>

Once the `npm install` has completed, we'll change into the `remix-jokes` directory:

💿 Run this command

```sh
cd remix-jokes
```

Great, now open that up in your favorite editor and let's explore the project structure a bit.

## Explore Project structure

Here's the tree structure. Hopefully what you've got looks a bit like this:

```
remix-jokes
├── README.md
├── app
│   ├── data.server.tsx
│   ├── entry.client.tsx
│   ├── entry.server.tsx
│   ├── root.tsx
│   ├── routes
│   │   ├── about
│   │   │   ├── index.tsx
│   │   │   └── whoa.tsx
│   │   ├── about.tsx
│   │   └── index.tsx
│   └── styles
│       ├── about.css
│       ├── dark.css
│       ├── global.css
│       ├── index.css
│       └── medium.css
├── package-lock.json
├── package.json
├── public
│   └── favicon.ico
├── remix.config.js
├── remix.env.d.ts
└── tsconfig.json
```

Let's talk briefly about a few of these files:

- `app/` - This is where all your Remix app code goes
- `app/entry.client.tsx` - This is the first bit of your JavaScript that will run when the app loads in the browser. We use this file to [hydrate](https://reactjs.org/docs/react-dom.html#hydrate) our React components.
- `app/entry.server.tsx` - This is the first bit of your JavaScript that will run when a request hits your server. Remix handles loading all the necessary data and you're responsible for sending back the response. We'll use this file to render our React app to a string/stream and send that as our response to the client.
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

Now you should also have a `.cache/` directory (something used internally by Remix), a `build/` directory, and a `public/build` directory. The `build/` directory is our server-side code. The `public/build/` holds all our our client-side code.

💿 Let's run the built app now:

```sh
npm start
```

This will start the server and output this:

```
Remix App Server started at http://localhost:3000
```

Open up that URL and you should be presented with something that looks a bit like this:

![The Remix Starter App](/jokes-tutorial/img/remix-starter.png)

Feel free to read a bit of what's in there and explore the code if you like. I'll be here when you get back. You done? Ok, sweet.

💿 Now stop the server and delete all this stuff:

- `app/routes`
- `app/styles`
- `app/data.server.tsx`

💿 Replace the contents of `app/root.tsx` with this:

```tsx filename=app/root.tsx
import { LiveReload } from "remix";

export default function App() {
  return (
    <html>
      <head>
        <title>Remix: It's funny!</title>
      </head>
      <body>
        Hello world
        {process.env.NODE_ENV === "development" ? (
          <LiveReload />
        ) : null}
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

And the app itself should greet the world:

![Bare bones hello world app](/jokes-tutorial/img/bare-bones.png)

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

You can programmatically create routes via the [`remix.config.js`](../api/conventions#remixconfigjs), but the more common way to create the routes is through the file system. This is called "file-based routing."

Each of file we put in the `app/routes` directory is called a ["Route Module"](../api/conventions#route-module-api) and by following [the route filename convention](../api/conventions#route-filenames) (like that weird `app/routes/$jokeId.tsx` file we're going to make), we can create the routing URL structure we're looking for. Remix uses React Router under the hood to handle this routing.

💿 Let's start with the index route (`/`). To do that, create a file at `app/routes/index.tsx` and `export default` a component from that route module. For now, you can have it just say "Hello Index Route" or something.

<details>

<summary>For example</summary>

```tsx filename=app/routes/index.tsx
export default function IndexRoute() {
  return <div>Hello Index Route</div>;
}
```

</details>

React Router supports "nested routing" which means we have parent-child relationships in our routes. The `app/routes/index.tsx` is a child of the `app/root.tsx` route. In nested routing, parents are responsible for laying out their children.

💿 Update the `app/root.tsx` to position children. You'll do this with the `<Outlet />` component from `remix`:

<details>

<summary>For example:</summary>

```tsx filename=app/root.tsx lines=[1,10]
import { LiveReload, Outlet } from "remix";

export default function App() {
  return (
    <html>
      <head>
        <title>Remix: It's funny!</title>
      </head>
      <body>
        <Outlet />
        {process.env.NODE_ENV === "development" ? (
          <LiveReload />
        ) : null}
      </body>
    </html>
  );
}
```

</details>

💿 With that set up, go ahead and start the dev server up with this command:

```sh
npm run dev
```

That will watch your filesystem for changes to rebuild the site and thanks to the `<LiveReload />` component your browser will refresh.

💿 Go ahead and open up the site again and you should be presented with the greeting from the index route.

![A greeting from the index route](/jokes-tutorial/img/index-route-greeting.png)

Great! Next let's handle the `/jokes` route.

💿 Create a new route at `app/routes/jokes.tsx` (keep in mind that this will be a parent route, so you'll want to use an `<Outlet />` route as well).

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes.tsx
import { Outlet } from "remix";

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

You should be presented with that when you go to [`/jokes`](http://localhost:3000/jokes). Now, in that `<Outlet />` we want to render out some random jokes in the "index route".

💿 Create a route at `app/routes/jokes/index.tsx`

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes/index.tsx
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

Now if you refresh [`/jokes`](http://localhost:3000/jokes), you'll get the content in the `app/routes/jokes.tsx` as well as the `app/routes/jokes/index.tsx`. Here's what mine looks like:

![A random joke on the jokes page: "I was wondering why the frisbee was getting bigger, then it hit me"](/jokes-tutorial/img/random-joke.png)

And notice that each of those route modules is only concerned with their part of the URL. Neat right!? Nested routing is pretty nice, and we're only just getting started. Let's keep going.

💿 Next, let's handle the `/jokes/new` route. I'll bet you can figure out how to do that 😄. Remember we're going to allow people to create jokes on this page, so you'll want to render a `form` with `name` and `content` fields.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes/new.tsx
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
        <button type="submit" className="button">
          Add
        </button>
      </form>
    </div>
  );
}
```

</details>

Great, so now going to [`/jokes/new`](http://localhost:3000/jokes/new) should display your form:

![A new joke form](/jokes-tutorial/img/new-joke.png)

### Parameterized Routes

Let's add one more route. This one is unique. Soon we're going to add a database that stores our jokes by an ID. So we want a parameterized route: `/jokes/:jokeId` where `:jokeId` is anything, and then we can lookup the `:jokeId` part of the URL in the database to display the right joke.

💿 Create a new route at `app/routes/jokes/$jokeId.tsx`. Don't worry too much about what it displays for now (we don't have a database set up yet!):

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes/$jokeId.tsx
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

Great, so now going to [`/jokes/anything-you-want`](http://localhost:3000/jokes/hippos) should display what you just created (in addition to the parent routes):

![A new joke form](/jokes-tutorial/img/param-route.png)

Great! We've got our primary routes all set up!

## Styling

To get CSS on the page, we use `<link rel="stylesheet" href="/path-to-file.css" />`. This is how you style your Remix applications as well, but Remix makes it much easier than just throwing `link` tags all over the place. Remix brings the power of it's Nested Routing support to CSS and allows you to associate `link`s to routes. When the route is active, the `link` is on the page and the CSS applies. When the route is not active (the user navigates away), the `link` tag is removed and the CSS no longer applies.

You do this by exporting a [`links`](../api/conventions#links) function in your route module. Let's get the homepage styled. You can put your CSS files anywhere you like within the `app` directory. We'll put ours in `app/styles/`.

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

💿 Now update `app/routes/index.tsx` to import that css file. Then add a `links` export (as described in [the documentation](../api/conventions#links)) to add that link to the page.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/index.tsx lines=[1-6]
import type { LinksFunction } from "remix";
import stylesUrl from "../styles/index.css";

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export default function IndexRoute() {
  return <div>Hello Index Route</div>;
}
```

</details>

Now if you go to [`/`](http://localhost:3000/) you may be a bit disappointed. Our beautiful styles aren't applyed! Well, you may recall that in the `app/root.tsx` we're the ones rendering _everything_ about our app. From the `<html>` to the `</html>`. That means if something doesn't show up in there, it's not going to show up at all!

So we need some way to get the `link` exports from all active routes and add `<link />` tags for all of them. Luckily, Remix makes this easy for us by providing a convenience [`<Links />`](../api/remix#link) component.

💿 Go ahead and add the Remix `<Links />` component to `app/root.tsx` within the `<head>`.

<details>

<summary>For example:</summary>

```tsx filename=app/root.tsx lines=[1,8]
import { Links, LiveReload, Outlet } from "remix";

export default function App() {
  return (
    <html>
      <head>
        <title>Remix: It's funny!</title>
        <Links />
      </head>
      <body>
        <Outlet />
        {process.env.NODE_ENV === "development" ? (
          <LiveReload />
        ) : null}
      </body>
    </html>
  );
}
```

</details>

Great, now check [`/`](http://localhost:3000/) again and it should be nice and styled for you:

![The homepage with a purple gradient background and white text with the words "Hello Index Route"](/jokes-tutorial/img/homepage-styles.png)

Hooray! But I want to call out something important and exciting. You know how the CSS we wrote styles the `body` element? What would you expect to happen on the [`/jokes`](http://localhost:3000/jokes) route? Go ahead and check it out.

![The jokes page with no background gradient](/jokes-tutorial/img/jokes-no-styles.png)

🤯 What is this? Why aren't the CSS rules applied? Did the `body` get removed or something?! Nope. If you open the Elements tab of the dev tools you'll notice that the link tag isn't there at all!

<docs-info>

This means that you don't have to worry about unexpected CSS clashes when you're writing your CSS. You can write whatever you like and so long as you check each route your file is linked on you'll know that you haven't impacted other pages! 🔥

This also means your CSS files can be cached long-term and your CSS is naturally lazy-loaded. Performance FTW ⚡

</docs-info>

That's pretty much all there is to it for styling with the tutorial. The rest is just writing all the CSS and stuff and you're welcome to do that if you want, but I'm going to let you skip that and I'll just give you the CSS you can copy.

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
```

</details>

💿 Add/update the `links` export to `app/root.tsx`, `app/routes/index.tsx`, and `app/routes/jokes.tsx` to bring in some CSS to make the page look nice (note: each page will have its own CSS file(s)).

<docs-info>The `app/root.tsx` will be the one that links to the `global` CSS files. Why do you think the name "global" makes sense for the root route's styles?</docs-info>

The `global-large.css` and `global-medium.css` files are for media query-based CSS.

<docs-info>Did you know that `<link />` tags can use media queries? [Check out the MDN page for `<link />`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link).</docs-info>

<details>

<summary>For example:</summary>

```tsx filename=app/root.tsx lines=[1,4-6,8-25]
import type { LinksFunction } from "remix";
import { Links, LiveReload, Outlet } from "remix";

import globalStylesUrl from "./styles/global.css";
import globalMediumStylesUrl from "./styles/global-medium.css";
import globalLargeStylesUrl from "./styles/global-large.css";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: globalStylesUrl
    },
    {
      rel: "stylesheet",
      href: globalMediumStylesUrl,
      media: "print, (min-width: 640px)"
    },
    {
      rel: "stylesheet",
      href: globalLargeStylesUrl,
      media: "screen and (min-width: 1024px)"
    }
  ];
};

export default function App() {
  return (
    <html>
      <head>
        <title>Remix: It's funny!</title>
        <Links />
      </head>
      <body>
        <Outlet />
        {process.env.NODE_ENV === "development" ? (
          <LiveReload />
        ) : null}
      </body>
    </html>
  );
}
```

```tsx filename=app/routes/index.tsx lines=[1-2,4-11]
import type { LinksFunction } from "remix";
import stylesUrl from "../styles/index.css";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: stylesUrl
    }
  ];
};

export default function IndexRoute() {
  return <div>Hello Index Route</div>;
}
```

```tsx filename=app/routes/jokes.tsx lines=[1,3,5-12]
import type { LinksFunction } from "remix";
import { Outlet } from "remix";
import stylesUrl from "../styles/jokes.css";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: stylesUrl
    }
  ];
};

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

As we work through the rest of the tutorial, you may want to check the class names in those CSS files so you can take full advantage of that CSS.

## Database

Most real-world applications require some form of data persistence. In our case, we want to save our jokes to a database so people can laugh at our hilarity and even submit their own (coming soon in the authentication section!).

You can use any persistence solution you like with Remix, Firebase, Supabase, Airtable, Hasura, Google Spreadsheets, FaunaDB, a custom PostgreSQL, or even your backend team's REST/GraphQL APIs. Seriously. Whatever you want.

### Set up Prisma

In this tutorial we're going to use our own [SQLite](https://sqlite.org/index.html) database. Effectively, it's a database that lives in a file on your computer. It's surprisingly capable. And what makes it better is that it's supported by [Prisma](https://www.prisma.io/), our favorite database ORM. It's a great place to start if you're not sure what database to use.

We're going to use two packages for this, `prisma` which we use during development to interact with our database and schema, and `@prisma/client` which we use during runtime to make queries from our application code.

💿 Install prisma:

```sh
npm install --save-dev prisma
npm install @prisma/client
```

💿 Now we can initialize prisma with sqlite:

```sh
npx prisma init --datasource-provider sqlite
```

That gives us this output:

```
✔ Your Prisma schema was created at prisma/schema.prisma
  You can now open it in your favorite editor.

warn You already have a .gitignore. Don't forget to exclude .env to not commit any secret.

Next steps:
1. Set the DATABASE_URL in the .env file to point to your existing database. If your database has no tables yet, read https://pris.ly/d/getting-started
2. Run prisma db pull to turn your database schema into a Prisma schema.
3. Run prisma generate to generate the Prisma Client. You can then start querying your database.

More information in our documentation:
https://pris.ly/d/getting-started
```

Now that we've got prisma initialized, we can start modeling our app data. Because this isn't a prisma tutorial, I'll just hand you that and you can read more about the prisma scheme from [their docs](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference):

```ts filename=prisma/schema.prisma lines=[13-19]
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

🚀  Your database is now in sync with your schema. Done in 194ms

✔ Generated Prisma Client (3.5.0) to ./node_modules/
@prisma/client in 26ms
```

This command did a few things. For one, it created our database file in `prisma/dev.db`. Then it pushed all the necessary changes to our database to match the schema we provided. Finally it generated Prisma's TypeScript types so we'll get stellar autocomplete and type checking as we use it's API for interacting with our database.

<docs-warning>If your database gets messed up, you can always delete the `prisma/dev.db` file and run `npx prisma db push` again.</docs-warning>

Next, we're going to write a little file that will "seed" our database with test data. Again, this isn't really remix-specific stuff, so I'll just give this to you (don't worry, we'll get back to remix soon):

💿 Copy this into a new file called `prisma/seed.ts`

```ts filename=prisma/seed.ts
import { PrismaClient } from "@prisma/client";
let db = new PrismaClient();

async function seed() {
  await Promise.all(
    getJokes().map(joke => {
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
      content: `I never wanted to believe that my Dad was stealing from his job as a road worker. But when I got home, all the signs were there.`
    },
    {
      name: "Frisbee",
      content: `I was wondering why the frisbee was getting bigger, then it hit me.`
    },
    {
      name: "Trees",
      content: `Why do trees seem suspicious on sunny days? Dunno, they're just a bit shady.`
    },
    {
      name: "Skeletons",
      content: `Why don't skeletons ride roller coasters? They don't have the stomach for it.`
    },
    {
      name: "Hippos",
      content: `Why don't you find hippopotamuses hiding in trees? They're really good at it.`
    },
    {
      name: "Dinner",
      content: `What did one plate say to the other plate? Dinner is on me!`
    },
    {
      name: "Elevator",
      content: `My first time using an elevator was an uplifting experience. The second time let me down.`
    }
  ];
}
```

Feel free to add your own jokes if you like.

Now we just need to run this file. We wrote it in TypeScript to get type safety (this is much more useful as our app and datamodels grow in complexity). So we'll need a way to run it.

💿 Install `esbuild-register` as a dev dependency:

```sh
npm install --save-dev esbuild-register
```

💿 And now we can run our `seed.ts` file with that:

```sh
node --require esbuild-register prisma/seed.ts
```

Now our database has those jokes in it. No joke!

But I don't want to have to remember to run that script any time I reset the database. Luckily, we don't have to!

💿 Add this to your `package.json`:

```json
// ...
  "prisma": {
    "seed": "node --require esbuild-register prisma/seed.ts"
  },
  "scripts": {
// ...
```

Now, whenever we reset the database, prisma will call our seeding file as well.

### Connect to the database

Ok, one last thing we need to do is connect to the database in our app. We do this at the top of our `prisma/seed.ts` file:

```ts
import { PrismaClient } from "@prisma/client";
let db = new PrismaClient();
```

This works just fine, but the problem is, during development, we don't want to close down and completely restart our server every time we make a server-side change. So `@remix-run/serve` actually rebuilds our code and requires it brand new. The problem here is that every time we make a code change, we'll make a new connection to the database and eventually we'll run out of connections! This is such a common problem with database-accessing apps that Prisma has a warning for it:

<docs-warn>Warning: 10 Prisma Clients are already running</docs-warn>

So we've got a little bit of extra work to do to avoid this development time problem.

Note that this isn't a remix-only problem. Any time you have "live reload" of server code, you're going to have to either disconnect and reconnect to databases (which can be slow) or do the workaround I'm about to show you.

💿 Copy this into a new file called `app/utils/db.server.ts`

```ts filename=app/utils/db.server.ts
import { PrismaClient } from "@prisma/client";

let db: PrismaClient;

declare global {
  var __db: PrismaClient | undefined;
}

// this is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (process.env.NODE_ENV === "production") {
  db = new PrismaClient();
  db.$connect();
} else {
  if (!global.__db) {
    global.__db = new PrismaClient();
    global.__db.$connect();
  }
  db = global.__db;
}

export { db };
```

I'll leave analysis of this code as an exercise for the reader because again, this has nothing to do with Remix directly.

The one thing that I will call out is the file name convention. The `.server` part of the filename informs Remix that this code should never end up in the browser. This is optional, because Remix does a good job of ensuring server code doesn't end up in the client. But sometimes the compiler can get confused while resolving dependencies. So adding the `.server` in the filename acts as a sort of boundary for the compiler.

### Read from the database in a Remix loader

Ok, ready to get back to writing Remix code? Me too!

Our goal is to put a list of jokes on the `/jokes` route so we can have a list of links to jokes people can choose from. In Remix, each route module is responsible for getting its own data. So if we want data on the `/jokes` route, then we'll be updating the `app/routes/jokes.tsx` file.

To _load_ data in a Remix route module, you use a [`loader`](../api/conventions#loader). This is simply an `async` function you export that returns a response for the data your component needs. And then the component gets it using the [`useLoaderData`](../api/remix#useloaderdata) hook. Here's a quick example:

```tsx
// this is just an example. No need to copy/paste this 😄
import type { LoaderFunction } from "remix";
import type { User } from "@prisma/client";
import { db } from "~/utils/db.server";

type LoaderData = { users: Array<User> };
export let loader: LoaderFunction = () => {
  let data: LoaderData = {
    users: await prisma.user.findMany()
  };
  return { data };
};

export default function Users() {
  let data = useLoaderData<LoaderData>();
  return (
    <ul>
      {data.map(user => (
        <li>{user.name}</li>
      ))}
    </ul>
  );
}
```

Does that give you a good idea of what to do here? If not, you can take a look at the example 😄

<docs-info>

Remix and the `tsconfig.json` you get from the starter template are configured to allow imports from the `app/` directory via `~` as demonstrated above so you don't have `../../` all over the place.

</docs-info>

💿 Update the `app/routes/jokes.tsx` route module to load jokes from our database and render a list of links to the jokes.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes.tsx lines=[4-5,8,20-22,24-33,34,41-47]
import {
  Link,
  LinksFunction,
  LoaderFunction,
  useLoaderData
} from "remix";
import { Outlet } from "remix";
import { db } from "~/utils/db.server";
import stylesUrl from "../styles/jokes.css";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: stylesUrl
    }
  ];
};

type LoaderData = {
  jokeListItems: Array<{ id: string; name: string }>;
};

export let loader: LoaderFunction = async () => {
  let data: LoaderData = {
    jokeListItems: await db.joke.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true }
    })
  };
  return data;
};

export default function JokesRoute() {
  let data = useLoaderData<LoaderData>();
  return (
    <div>
      <h1>J🤪KES</h1>
      <main>
        <ul>
          {data.jokeListItems.map(joke => (
            <li key={joke.id}>
              <Link to={joke.id}>{joke.name}</Link>
            </li>
          ))}
        </ul>
        <Outlet />
      </main>
    </div>
  );
}
```

</details>

And here's what we have with that now:

![List of links to jokes](/jokes-tutorial/img/jokes-loaded.png)

### Data overfetching

I want to call out something specific in my solution. Here's my loader:

```tsx lines=[8-10]
type LoaderData = {
  jokeListItems: Array<{ id: string; name: string }>;
};

export let loader: LoaderFunction = async () => {
  let data: LoaderData = {
    jokeListItems: await db.joke.findMany({
      take: 5,
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" }
    })
  };
  return data;
};
```

Notice that all I need for this page is the joke `id` and `name`. I don't need to bother getting the `content`. I'm also limiting to a total of 5 items and ordering by creation date so we get the latest jokes. So with `prisma`, I can change my query to be exactly what I need and avoid sending too much data to the client! That makes my app faster and more responsive for my users.

And to make it even cooler, you don't necessarily need prisma or direct database access to do this. You've got a graphql backend you're hitting? Sweet, use your regular graphql stuff in your loader. It's even better than doing it on the client because you don't need to worry about shipping a [huge graphql client](https://bundlephobia.com/package/graphql@16.0.1) to the client. Keep that on your server and filter down to what you want.

Oh, you've just got REST endpoints you hit? That's fine too! You can easily filter out the extra data before sending it off in your loader. Because it all happens on the server, you can save your user's download size easily without having to convince your backend engineers to change their entire API. Neat!

### Network Type Safety

Oh, and one other fun tip, I don't know about you, but I don't really like double-typing stuff, so we can use TypeScript's [`Awaited`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-5.html#the-awaited-type-and-promise-improvements) type to avoid that:

```tsx lines=[2-4,7-13,17]
type LoaderData = {
  jokeListItems: Awaited<
    ReturnType<typeof getJokeListItems>
  >;
};

function getJokeListItems() {
  return db.joke.findMany({
    take: 5,
    select: { id: true, name: true }
    orderBy: { createdAt: "desc" },
  });
}

export let loader: LoaderFunction = async () => {
  let data: LoaderData = {
    jokeListItems: await getJokeListItems()
  };
  return data;
};
```

With this, now if we needed to add or remove any fields from our query, we could easily change our query and all the types would flow through without having to change anything else. Type safety across network boundaries! In the future, we hope to make this experience even better.

### Wrap up database queries

Before we get to the `/jokes/:jokeId` route, here's a quick example of how you can access params (like `:jokeId`) in your loader.

```tsx
export let loader: LoaderFunction = async ({ params }) => {
  console.log(params); // <-- {jokeId: "123"}
};
```

And here's how you get the joke from prisma:

```tsx
let joke = await db.joke.findUnique({
  where: { id: jokeId }
});
```

💿 Great! Now you know everything you need to continue and connect the `/jokes/:jokeId` route in `app/routes/jokes/$jokeId.tsx`.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes/$jokeId.tsx lines=[3-4,6,8-15,18]
import type { LoaderFunction } from "remix";
import { Link, useLoaderData } from "remix";
import type { Joke } from "@prisma/client";
import { db } from "~/utils/db.server";

type LoaderData = { joke: Joke };

export let loader: LoaderFunction = async ({ params }) => {
  let joke = await db.joke.findUnique({
    where: { id: params.jokeId }
  });
  if (!joke) throw new Error("Joke not found");
  let data: LoaderData = { joke };
  return data;
};

export default function JokeRoute() {
  let data = useLoaderData<LoaderData>();

  return (
    <div>
      <p>Here's your hilarious joke:</p>
      <p>{data.joke.content}</p>
      <Link to=".">{data.joke.name} Permalink</Link>
    </div>
  );
}
```

</details>

With that you should be able to go to [`/jokes`](http://localhost:3000/jokes) and click on a link to get the joke:

![Jokes page showing a unique joke](/jokes-tutorial/img/joke-page.png)

We'll handle the case where someone tries to access a joke that doesn't exist in the database in the next section.

Next, let's handle the `/jokes` index route in `app/routes/jokes/index.tsx` that shows a random joke.

Here's how you get a random joke from prisma:

```tsx
const count = await db.joke.count();
const randomRowNumber = Math.floor(Math.random() * count);
let [randomJoke] = await db.joke.findMany({
  take: 1,
  skip: randomRowNumber
});
```

💿 You should be able to get the loader working from there.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes/index.tsx lines=[2-3,5,7-16,19]
import { useLoaderData, Link } from "remix";
import type { Joke } from "@prisma/client";
import { db } from "~/utils/db.server";

type LoaderData = { randomJoke: Joke };

export let loader = async () => {
  const count = await db.joke.count();
  const randomRowNumber = Math.floor(Math.random() * count);
  let [randomJoke] = await db.joke.findMany({
    take: 1,
    skip: randomRowNumber
  });
  let data: LoaderData = { randomJoke };
  return data;
};

export default function JokesIndexRoute() {
  let data = useLoaderData<LoaderData>();

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

With that your [`/jokes`](http://localhost:3000/jokes) route should display a list of links to jokes as well as a random joke:

![Jokes page showing a random joke](/jokes-tutorial/img/random-joke-loaded.png)

## Mutations

We've got ourselves a `/jokes/new` route, but that form doesn't do anything yet. Let's wire it up! As a reminder here's what that code should look like right now:

```tsx filename=app/routes/jokes/new.tsx
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
        <button type="submit" className="button">
          Add
        </button>
      </form>
    </div>
  );
}
```

Not much there. Just a form. What if I told you that you could make that form work with a single export to the route module? Well you can! It's the [`action`](../api/conventions#action) function export! Read up on that a bit.

Here's the prisma code you'll need:

```tsx
let joke = await db.joke.create({
  data: { name, content }
});
```

💿 Create an `action` in `app/routes/jokes/new.tsx`.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes/new.tsx lines=[1-3,5-15]
import type { ActionFunction } from "remix";
import { redirect } from "remix";
import { db } from "~/utils/db.server";

export let action: ActionFunction = async ({ request }) => {
  let { name, content } = Object.fromEntries(
    await request.formData()
  );
  // we do this type check to be extra sure and to make TypeScript happy
  // we'll explore validation next!
  if (
    typeof name !== "string" ||
    typeof content !== "string"
  ) {
    throw new Error(`Form not submitted correctly.`);
  }

  let fields = { name, content };

  let joke = await db.joke.create({ data: fields });
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
        <button type="submit" className="button">
          Add
        </button>
      </form>
    </div>
  );
}
```

</details>

If you've got that working, you should be able to create new jokes and you'll be redirected to the new joke's page.

![Create new joke form filled out](/jokes-tutorial/img/creating-new-joke.png)

![Newly created joke displayed](/jokes-tutorial/img/new-joke-created.png)

Hooray! How cool is that? No `useEffect` or `useAnything` hooks. Just a form, and an async function to process the submission. Pretty cool. You can definitely still do all that stuff if you wanted to, but why would you? This is really nice.

Another thing you'll notice is that when we were redirected to the joke's new page, it was there! But we didn't have to think about updating the cache at all. Remix handles invalidating the cache for us automatically. You don't have to think about it. _That_ is cool 😎

Why don't we add some validation? We could definitely do the typical React validation approach. Wiring up `useState` with `onChange` handlers and such. And sometimes that's nice to get some real-time validation as the user's typing. But even if you do all that work, you're still going to want to do validation on the server.

Before I set you off on this one, there's one more thing you need to know about route module `action` functions. The return value is expected to be the same as the `loader` function: A response, or (as a convenience) a serializeable JavaScript object. Normally you want to `redirect` when the action is successful to avoid the annoying "confirm resubmission" dialog you might have seen on some websites.

But if there's an error, you can return an object with the error messages and then the component can get those values from [`useActionData`](../api/remix#useactiondata) and display them to the user.

💿 Go ahead and validate that the `name` and `content` fields are long enough. I'd say the name should be at least 3 characters long and the content should be at least 10 characters long. Do this validation server-side.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes/new.tsx lines=[2,5-9,11-15,17-27,39,42-45,47-49,56,67,69-76,79-87,93,95-103,105-113]
import type { ActionFunction } from "remix";
import { useActionData, redirect } from "remix";
import { db } from "~/utils/db.server";

function validateJokeContent(content: string) {
  if (content.length < 10) {
    return `That joke is too short`;
  }
}

function validateJokeName(name: string) {
  if (name.length < 2) {
    return `That joke's name is too short`;
  }
}

type ActionData = {
  formError?: string;
  fieldErrors?: {
    name: string | undefined;
    content: string | undefined;
  };
  fields?: {
    name: string;
    content: string;
  };
};

export let action: ActionFunction = async ({
  request
}): Promise<Response | ActionData> => {
  let { name, content } = Object.fromEntries(
    await request.formData()
  );
  if (
    typeof name !== "string" ||
    typeof content !== "string"
  ) {
    return { formError: `Form not submitted correctly.` };
  }

  let fieldErrors = {
    name: validateJokeName(name),
    content: validateJokeContent(content)
  };
  let fields = { name, content };
  if (Object.values(fieldErrors).some(Boolean)) {
    return { fieldErrors, fields };
  }

  let joke = await db.joke.create({ data: fields });
  return redirect(`/jokes/${joke.id}`);
};

export default function NewJokeRoute() {
  let actionData = useActionData<ActionData | undefined>();

  return (
    <div>
      <p>Add your own hilarious joke</p>
      <form method="post">
        <div>
          <label>
            Name:{" "}
            <input
              type="text"
              defaultValue={actionData?.fields?.name}
              name="name"
              aria-invalid={Boolean(
                actionData?.fieldErrors?.name
              )}
              aria-describedby={
                actionData?.fieldErrors?.name
                  ? "name-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.name ? (
            <p
              className="form-validation-error"
              role="alert"
              id="name-error"
            >
              {actionData?.fieldErrors?.name}
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
              aria-describedby={
                actionData?.fieldErrors?.content
                  ? "content-error"
                  : undefined
              }
            />
          </label>
          {actionData?.fieldErrors?.content ? (
            <p
              className="form-validation-error"
              role="alert"
              id="content-error"
            >
              {actionData?.fieldErrors?.content}
            </p>
          ) : null}
        </div>
        <button type="submit" className="button">
          Add
        </button>
      </form>
    </div>
  );
}
```

</details>

Great! You should now have a form that validates the fields on the server and displays those errors on the client:

![New joke form with validation errors](/jokes-tutorial/img/new-joke-form-with-errors.png)

Why don't you pop open my code example for a second. I want to show you a few things about the way I'm doing this.

First I want you to notice that I've added an `ActionData` type so we could get some type safety. Keep in mind that `useActionData` can return `undefined` if the action hasn't been called yet, so we've got a bit of defensive programming going on there.

You may also notice that I return the fields as well. This is so that the form can be re-rendered with the values from the server in the event that JavaScript fails to load for some reason. That's what the `defaultValue` stuff is all about as well.

Another thing I want to call out is how all of this is just so nice and declarative. You don't have to think about state at all here. Your action gets some data, you process it and return a value. The component consumes the action data and renders based on that value. No managing state here. No thinking about race conditions. Nothing.

Oh, and if you _do_ want to have client-side validation (for while the user is typing), you can simply call the `validateJokeContent` and `validateJokeName` functions that the action is using. You can _actually_ seamlessly share code between the client and server! Now _that_ is cool!

## Authentication

It's the moment we've all been waiting for! We're going to add authentication to our little application. We want to add authentication so we can require a user have an account to create jokes and we can associate the user with the jokes they've created. So many ideas!

One thing that would be good to understand for this section is how [HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) work on the web.

We're going to handroll our own authentication from scratch. Don't worry, I promise it's not as scary as it sounds.

### Preparing the database

<docs-warning>Remember, if your database gets messed up, you can always delete the `prisma/dev.db` file and run `npx prisma db push` again.</docs-warning>

Let's start by showing you our updated `prisma/schema.prisma` file. 💿 Go ahead and update your `prisma/schema.prisma` file to look like this:

```ts filename=prisma/schema.prisma lines=[13-20,24-25]
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

🚀  Your database is now in sync with your schema. Done in 1.56s

✔ Generated Prisma Client (3.5.0) to ./node_modules/@prisma/
client in 34ms
```

With this change, we're going to start experiencing some TypeScript errors in our project because you can no longer create a `joke` without a `jokesterId` value.

💿 Let's start by fixing our `prisma/schema.prisma` file.

```ts filename=prisma/schema.prisma lines=[5-11,14-15]
import { PrismaClient } from "@prisma/client";
let prisma = new PrismaClient();

async function seed() {
  let kody = await prisma.user.create({
    data: {
      username: "kody",
      passwordHash:
        "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u"
    }
  });
  await Promise.all(
    getJokes().map(joke => {
      let data = { jokesterId: kody.id, ...joke };
      return prisma.joke.create({ data });
    })
  );
}

seed();

function getJokes() {
  // shout-out to https://icanhazdadjoke.com/

  return [
    {
      name: "Road worker",
      content: `I never wanted to believe that my Dad was stealing from his job as a road worker. But when I got home, all the signs were there.`
    },
    {
      name: "Frisbee",
      content: `I was wondering why the frisbee was getting bigger, then it hit me.`
    },
    {
      name: "Trees",
      content: `Why do trees seem suspicious on sunny days? Dunno, they're just a bit shady.`
    },
    {
      name: "Skeletons",
      content: `Why don't skeletons ride roller coasters? They don't have the stomach for it.`
    },
    {
      name: "Hippos",
      content: `Why don't you find hippopotamuses hiding in trees? They're really good at it.`
    },
    {
      name: "Dinner",
      content: `What did one plate say to the other plate? Dinner is on me!`
    },
    {
      name: "Elevator",
      content: `My first time using an elevator was an uplifting experience. The second time let me down.`
    }
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
Running seed command `node --require esbuild-register prisma/seed.ts` ...

🌱  The seed command has been executed.
```

Great! Our database is now ready to go.

### Auth Flow Overview

So our authentication will be the traditional username/password variety. We'll be using [`bcrypt`](https://npm.im/bcrypt) to hash our passwords so nobody will be able to reasonably brute-force their way into an account.

Let me give you a quick diagram of the flow of things:

![Excalidraw Authentication diagram](/jokes-tutorial/img/auth-flow.png)

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

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

fieldset {
  display: flex;
  justify-content: center;
}

fieldset > :not(:last-child) {
  margin-right: 2rem;
}
```

</details>

💿 Create a `/login` route by adding a `app/routes/login.tsx` file.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/login.tsx
import type { LinksFunction } from "remix";
import stylesUrl from "../styles/login.css";

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: stylesUrl }];
};

export default function Login() {
  return (
    <div className="container">
      <div className="content" data-light="">
        <h1>Login</h1>
        <form method="post">
          <fieldset>
            <legend className="sr-only">
              Login or Register?
            </legend>
            <label>
              <input
                type="radio"
                name="loginType"
                value="login"
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
    </div>
  );
}
```

</details>

This should look something like this:

![A login form with a login/register radio button and username/password fields and a submit button](/jokes-tutorial/img/login-route.png)
