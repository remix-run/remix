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

You can programmatically create routes via the [`remix.config.js`](../api/app#remixconfigjs), but the more common way to create the routes is through the file system. This is called "file-based routing."

Each of file we put in the `app/routes` directory is called a ["Route Module"](../api/app#route-module-api) and by following [the route filename convention](../api/app#route-filenames) (like that weird `app/routes/$jokeId.tsx` file we're going to make), we can create the routing URL structure we're looking for. Remix uses React Router under the hood to handle this routing.

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

You do this by exporting a [`links`](../api/app#links) function in your route module. Let's get the homepage styled. You can put your CSS files anywhere you like within the `app` directory. We'll put ours in `app/styles/`.

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

💿 Now update `app/routes/index.tsx` to import that css file. Then add a `links` export (as described in [the documentation](../api/app#links)) to add that link to the page.

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

That's pretty much all there is to it for styling with the tutorial. The rest is just writing all the CSS and stuff and you're welcome to do that if you want, but I'm going to let you skip that and I'll just give you URLs you can get the CSS from and you can either download and use it in your project or reference it directly (it's all just URLs to CSS files in the end anyway).

💿 Add/update the `links` export to `app/root.tsx`, `app/routes/index.tsx`, and `app/routes/jokes.tsx` to bring in some CSS to make the page look nice (note: each page will have its own CSS file(s)). Here are the URLs:

<!-- These can't be regular links because they're not routes, they're files. -->

<ul>
<li><a data-noprefetch href="/jokes-tutorial/styling/global.css">global.css</a></li>
<li><a data-noprefetch href="/jokes-tutorial/styling/global-large.css">global-large.css</a></li>
<li><a data-noprefetch href="/jokes-tutorial/styling/global-medium.css">global-medium.css</a></li>
<li><a data-noprefetch href="/jokes-tutorial/styling/index.css">index.css</a></li>
<li><a data-noprefetch href="/jokes-tutorial/styling/jokes.css">jokes.css</a></li>
</ul>

As we work through the rest of the tutorial, you may want to check the class names in those CSS files so you can take full advantage of that CSS.

<docs-info>

The `app/root.tsx` will be the one that links to the `global` CSS files. Why do you think the name "global" makes sense for the root route's styles?

</docs-info>

The `global-large.css` and `global-medium.css` files are for media query-based CSS.

<docs-info>

Did you know that `<link />` tags can use media queries? [Check out the MDN page for `<link />`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link).

</docs-info>

<details>

<summary>For example:</summary>

```tsx filename=app/root.tsx lines=[1,4-21]
import type { LinksFunction } from "remix";
import { Links, LiveReload, Outlet } from "remix";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://remixdotrunstage.fly.dev/jokes-tutorial/styling/global.css"
    },
    {
      rel: "stylesheet",
      href: "https://remixdotrunstage.fly.dev/jokes-tutorial/styling/global-medium.css",
      media: "print, (min-width: 640px)"
    },
    {
      rel: "stylesheet",
      href: "https://remixdotrunstage.fly.dev/jokes-tutorial/styling/global-large.css",
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

```tsx filename=app/routes/index.tsx lines=[1-10]
import type { LinksFunction } from "remix";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://remixdotrunstage.fly.dev/jokes-tutorial/styling/index.css"
    }
  ];
};

export default function IndexRoute() {
  return <div>Hello Index Route</div>;
}
```

```tsx filename=app/routes/index.tsx lines=[1,4-11]
import type { LinksFunction } from "remix";
import { Outlet } from "remix";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://remixdotrunstage.fly.dev/jokes-tutorial/styling/jokes.css"
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

## Database

Most real-world applications require some form of data persistence. In our case, we want to save our jokes to a database so people can laugh at our hilarity and even submit their own (coming soon in the authentication section!).

You can use any persistence solution you like with Remix, Firebase, Supabase, Airtable, Hasura, Google Spreadsheets, FaunaDB, a custom PostgreSQL, or even your backend team's REST/GraphQL APIs. Seriously. Whatever you want.

### Set up Prisma

In this tutorial we're going to use our own [SQLite](https://sqlite.org/index.html) database. Effectively, it's a database that lives in a file on your computer. It's surprisingly capable. And what makes it better is it's supported by [Prisma](https://www.prisma.io/), our favorite database ORM. It's a great place to start if you're not sure what database to use.

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

```ts lines=[13-19]
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

To _load_ data in a Remix route module, you use a [`loader`](../api/app#loader). This is simply an `async` function you export that returns a response for the data your component needs. And then the component gets it using the [`useLoaderData`](../api/remix#useloaderdata) hook. Here's a quick example:

```tsx
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

Remix and the tsconfig.json you get from the starter template are configured to allow imports from the `app/` directory via `~` as demonstrated above so you don't have `../../` all over the place.

</docs-info>

💿 Update the `app/routes/jokes.tsx` route module to load jokes from our database and render a list of links to the jokes.

<details>

<summary>For example:</summary>

```tsx filename=app/routes/jokes.tsx lines=[4-5,8,19-30,33,38-44]
import {
  Link,
  LinksFunction,
  LoaderFunction,
  useLoaderData
} from "remix";
import { Outlet } from "remix";
import { db } from "~/utils/db.server";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://remixdotrunstage.fly.dev/jokes-tutorial/styling/jokes.css"
    }
  ];
};

type LoaderData = {
  jokeListItems: Array<{ id: string; name: string }>;
};

export let loader: LoaderFunction = async () => {
  let data: LoaderData = {
    jokeListItems: await db.joke.findMany({
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
