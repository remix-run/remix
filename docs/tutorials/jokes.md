---
title: Jokes App
order: 2
---

# Jokes App Tutorial

You want to learn Remix? You're in the right place. This tutorial is the fast-track to getting an overview of the primary APIs available in Remix. By the end, you'll have a full application you can show your mom, significant other, or dog and I'm sure they'll be just as excited about Remix as you are (though I make no guarantees).

We're going to be laser focused on Remix. This means that we're going to skip over a few things that are a distraction from the core ideas we want you to learn about Remix. For example, we'll show you how to get a CSS stylesheet on the page, but we're not going to make you write the styles by yourself. So we'll just give you stuff you can copy/paste for that kind of thing. However, if you'd prefer to write it all out yourself, you totally can (it'll just take you much longer). So we'll put it in little `<details>` elements you have to click to expand to not spoil anything if you'd prefer to code it out yourself.

We'll be linking to various docs (Remix docs as well as web docs on MDN) throughout the tutorial. If you're ever stuck, make sure you check into any docs links you may have skipped.

This tutorial will be using TypeScript. Feel free to follow along and skip/remove the TypeScript bits. We find that Remix is made even better when your using TypeScript, especially since we'll also be using [prisma](https://www.prisma.io/) to access our data models from the sqlite database.

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

Som experience with React and TypeScript/JavaScript is assumed. If you'd like to review your knowledge, check out these resources:

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

![The Remix Starter App](/docs-images/jokes-tutorial/remix-starter.png)

Feel free to read a bit of what's in there and explore the code if you like. I'll be here when you get back. You done? Ok, sweet.

💿 Now stop the server and delete all this stuff:

- `app/routes`
- `app/styles`
- `app/data.server.tsx`

💿 Replace the contents of `app/root.tsx` with this:

```tsx filename="app/root.tsx"
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

![Bare bones hello world app](/docs-images/jokes-tutorial/bare-bones.png)

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

You can programmatically create routes via the [`remix.config.js`](../api/app#remixconfigjs), but the more common way to create the routes is through the file system. This is called "file-based routing."

Each of file we put in the `app/routes` directory is called a ["Route Module"](../api/app#route-module-api) and by following [the route filename convention](../api/app#route-filenames) (like that weird `app/routes/$jokeId.tsx` file we're going to make), we can create the routing URL structure we're looking for. Remix uses React Router under the hood to handle this routing.

💿 Let's start with the index route (`/`). To do that, create a file at `app/routes/index.tsx` and `export default` a component from that route module. For now, you can have it just say "Hello Index Route" or something.

<details>

<summary>For example</summary>

```tsx filename="app/routes/index.tsx"
export default function IndexRoute() {
  return <div>Hello Index Route</div>;
}
```

</details>

React Router supports "nested routing" which means we have parent-child relationships in our routes. The `app/routes/index.tsx` is a child of the `app/root.tsx` route. In nested routing, parents are responsible for laying out their children.

💿 Update the `app/root.tsx` to position children. You'll do this with the `<Outlet />` component from `remix`:

<details>

<summary>For example:</summary>

```tsx filename="app/root.tsx" lines="1,10"
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

![A greeting from the index route](/docs-images/jokes-tutorial/index-route-greeting.png)

Great! Next let's handle the `/jokes` route.

💿 Create a new route at `app/routes/jokes.tsx` (keep in mind that this will be a parent route, so you'll want to use an `<Outlet />` route as well).

<details>

<summary>For example:</summary>

```tsx filename="app/routes/jokes.tsx"
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

```tsx filename="app/routes/jokes/index.tsx"
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

![A random joke on the jokes page: "I was wondering why the frisbee was getting bigger, then it hit me"](/docs-images/jokes-tutorial/random-joke.png)

And notice that each of those route modules is only concerned with their part of the URL. Neat right!? Nested routing is pretty nice, and we're only just getting started. Let's keep going.

💿 Next, let's handle the `/jokes/new` route. I'll bet you can figure out how to do that 😄. Remember we're going to allow people to create jokes on this page, so you'll want to render a `form` with `name` and `content` fields.

<details>

<summary>For example:</summary>

```tsx filename="app/routes/jokes/new.tsx"
export default function NewJokeScreen() {
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

![A new joke form](/docs-images/jokes-tutorial/new-joke.png)

### Parameterized Routes

Let's add one more route. This one is unique. Soon we're going to add a database that stores our jokes by an ID. So we want a parameterized route: `/jokes/:jokeId` where `:jokeId` is anything, and then we can lookup the `:jokeId` part of the URL in the database to display the right joke.

💿 Create a new route at `app/routes/jokes/$jokeId.tsx`. Don't worry too much about what it displays for now (we don't have a database set up yet!):

<details>

<summary>For example:</summary>

```tsx filename="app/routes/jokes/$jokeId.tsx"
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

![A new joke form](/docs-images/jokes-tutorial/param-route.png)

Great! We've got our primary routes all set up!

## Styling

To get CSS on the page, we use `<link rel="stylesheet" href="/path-to-file.css" />`. This is how you style your Remix applications as well, but Remix makes it much easier than just throwing `link` tags all over the place. Remix brings the power of it's Nested Routing support to CSS and allows you to associate `link`s to routes. When the route is active, the `link` is on the page and the CSS applies. When the route is not active (the user navigates away), the `link` tag is removed and the CSS no longer applies.

You do this by exporting a [`links`](../api/app#links) function in your route module. Let's get the homepage styled. You can put your CSS files anywhere you like within the `app` directory. We'll put ours in `app/styles/`.

💿 Create the following css files in `app/styles/`: `global.css`, `global-large.css`, `global-medium.css`, `index.css`, and `jokes.css`.

💿 Add a `links` export to `app/root.tsx`, `app/routes/index.tsx`, and `app/routes/jokes.tsx` to bring in some CSS to make the page look nice (note: each page will have its own CSS file(s)).

<docs-warning>
  The `app/root.tsx` will be the one that links to the `global` CSS files. Why do you think the name "global" makes sense for the root route's styles?
</docs-warning>

<docs-warning>
  The `global-large.css` and `global-medium.css` files are for media query-based CSS. Did you know that `<link />` tags can use media queries? [Check out the MDN page for `<link />`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link).
</docs-warning>

<details>

<summary>CSS Files:</summary>

```tsx filename="app/styles/"

```

</details>
