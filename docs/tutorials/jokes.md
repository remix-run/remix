---
title: Jokes App
order: 2
---

# Jokes App Tutorial

You want to learn Remix? You're in the right place. This tutorial is the fast-track to getting an overview of the primary APIs available in Remix. By the end, you'll have a full application you can show your mom, significant other, or dog and I'm sure they'll be just as excited about Remix as you are (though I make no guarantees).

We're going to be laser focused on Remix. This means that we're going to skip over a few things that are a distraction from the core ideas we want you to learn about Remix. For example, we'll show you how to get a CSS stylesheet on the page, but we're not going to make you write the styles by yourself. So we'll just give you stuff you can copy/paste for that kind of thing.

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

You should be presented with something that looks a bit like this:

![The Remix Starter App](/docs-images/jokes-tutorial/remix-starter.png)

💿 Feel free to read a bit of what's in there and explore the code if you like. I'll be here when you get back.

💿 You done? Ok, sweet, now delete all this stuff:

- `app/routes`
- `app/styles`
- `app/data.server.tsx`

💿 Now, replace the contents of `app/root.tsx` with this:

```tsx
export default function App() {
  return (
    <html>
      <head>
        <title>Remix: It's funny!</title>
      </head>
      <body>Hello world</body>
    </html>
  );
}
```

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

The first thing we're going to add
