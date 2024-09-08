---
title: Blog Tutorial (short)
order: 3
hidden: true
---

# Blog Tutorial

We're going to be short on words and quick on code in this quickstart. If you're looking to see what Remix is all about in 15 minutes, this is it.

<docs-info>Work through this tutorial with Kent in <a target="_blank" rel="noopener noreferrer" href="https://rmx.as/egghead-course">this free Egghead.io course</a></docs-info>

This tutorial uses TypeScript. Remix can definitely be used without TypeScript. We feel most productive when writing TypeScript, but if you'd prefer to skip the TypeScript syntax, feel free to write your code in JavaScript.

<docs-info>💿 Hey I'm Derrick the Remix Compact Disc 👋 Whenever you're supposed to _do_ something you'll see me</docs-info>

## Prerequisites

Click this button to create a [Gitpod][gitpod] workspace with the project set up and ready to run in VS Code or JetBrains either directly in the browser or on the desktop.

[![Gitpod Ready-to-Code][gitpod-ready-to-code]][gitpod-ready-to-code-image]

If you want to follow this tutorial locally on your own computer, it is important for you to have these things installed:

- [Node.js][node-js] version (>=18.0.0)
- [npm][npm] 7 or greater
- A code editor ([VSCode][vs-code] is a nice one)

## Creating the project

<docs-warning>Make sure you are running at least Node v18 or greater</docs-warning>

💿 Initialize a new Remix project. We'll call ours "blog-tutorial" but you can call it something else if you'd like.

```shellscript nonumber
npx create-remix@latest --template remix-run/indie-stack blog-tutorial
```

```
Install dependencies with npm?
Yes
```

You can read more about the stacks available in [the stacks docs][the-stacks-docs].

We're using [the Indie stack][the-indie-stack], which is a full application ready to deploy to [fly.io][fly-io]. This includes development tools as well as production-ready authentication and persistence. Don't worry if you're unfamiliar with the tools used, we'll walk you through things as we go.

<docs-info>Note, you can definitely start with "Just the basics" instead by running `npx create-remix@latest` without the `--template` flag. The generated project is much more minimal that way. However, some bits of the tutorial will be different for you and you'll have to configure things for deployment manually.</docs-info>

💿 Now, open the project that was generated in your preferred editor and check the instructions in the `README.md` file. Feel free to read over this. We'll get to the deployment bit later in the tutorial.

💿 Let's start the dev server:

```shellscript nonumber
npm run dev
```

💿 Open up [http://localhost:3000][http-localhost-3000], the app should be running.

If you want, take a minute and poke around the UI a bit. Feel free to create an account and create/delete some notes to get an idea of what's available in the UI out of the box.

## Your First Route

We're going to make a new route to render at the "/posts" URL. Before we do that, let's link to it.

💿 Add a link to posts in `app/routes/_index.tsx`

Go ahead and copy/paste this:

```tsx filename=app/routes/_index.tsx
<div className="mx-auto mt-16 max-w-7xl text-center">
  <Link
    to="/posts"
    className="text-xl text-blue-600 underline"
  >
    Blog Posts
  </Link>
</div>
```

You can put it anywhere you like. I stuck it right above the icons of all the technologies used in the stack:

<!-- TODO: once the website can deploy properly, update this to use our self-hosted version of this image -->

<!-- ![Screenshot of the app showing the blog post link](/blog-tutorial/blog-post-link.png) -->

![Screenshot of the app showing the blog post link][screenshot-of-the-app-showing-the-blog-post-link]

<docs-info>You may have noticed we're using <a href="https://tailwindcss.com">Tailwind CSS</a> classes.</docs-info>

The Remix Indie stack has [Tailwind CSS][tailwind] support pre-configured. If you'd prefer to not use Tailwind CSS, you're welcome to remove it and use something else. Learn more about your styling options with Remix in [the styling guide][the-styling-guide].

Back in the browser go ahead and click the link. You should see a 404 page since we've not created this route yet. Let's create the route now:

💿 Create a new file at `app/routes/posts._index.tsx`

```shellscript nonumber
touch app/routes/posts._index.tsx
```

<docs-info>Any time you see terminal commands to create files or folders, you can of course do that however you'd like, but using `touch` is just a way for us to make it clear which files you should be creating.</docs-info>

We could have named it just `posts.tsx` but we'll have another route soon, and it'll be nice to put them by each other. An index route will render at the parent's path (just like `index.html` on a web server).

Now if you navigate to the `/posts` route, you'll get an error indicating there's no way to handle the request. That's because we haven't done anything in that route yet! Let's add a component and export it as the default:

💿 Make the posts component

```tsx filename=app/routes/posts._index.tsx
export default function Posts() {
  return (
    <main>
      <h1>Posts</h1>
    </main>
  );
}
```

You might need to refresh the browser to see our new, bare-bones posts route.

## Loading Data

Data loading is built into Remix.

If your web dev background is primarily in the last few years, you're probably used to creating two things here: an API route to provide data and a frontend component that consumes it. In Remix your frontend component is also its own API route, and it already knows how to talk to itself on the server from the browser. That is, you don't have to fetch it.

If your background is a bit farther back than that with MVC web frameworks like Rails, then you can think of your Remix routes as backend views using React for templating, but then they know how to seamlessly hydrate in the browser to add some flair instead of writing detached jQuery code to dress up the user interactions. It's progressive enhancement realized in its fullest. Additionally, your routes are their own controller.

So let's get to it and provide some data to our component.

💿 Make the posts route `loader`

```tsx filename=app/routes/posts._index.tsx lines=[1-2,4-17,20-21]
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  return json({
    posts: [
      {
        slug: "my-first-post",
        title: "My First Post",
      },
      {
        slug: "90s-mixtape",
        title: "A Mixtape I Made Just For You",
      },
    ],
  });
};

export default function Posts() {
  const { posts } = useLoaderData<typeof loader>();
  return (
    <main>
      <h1>Posts</h1>
    </main>
  );
}
```

`loader` functions are the backend "API" for their component, and it's already wired up for you through `useLoaderData`. It's a little wild how blurry the line is between the client and the server in a Remix route. If you have your server and browser consoles both open, you'll note that they both logged our post data. That's because Remix rendered on the server to send a full HTML document like a traditional web framework, but it also hydrated in the client and logged there too.

<docs-error>
Whatever you return from your loader will be exposed to the client, even if the component doesn't render it. Treat your loaders with the same care as public API endpoints.
</docs-error>

💿 Render links to our posts

```tsx filename=app/routes/posts._index.tsx lines=[2,10-21] nocopy
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

// ...
export default function Posts() {
  const { posts } = useLoaderData<typeof loader>();
  return (
    <main>
      <h1>Posts</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              to={post.slug}
              className="text-blue-600 underline"
            >
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

Hey, that's pretty cool. We get a pretty solid degree of type safety even over a network request because it's all defined in the same file. Unless the network blows up while Remix fetches the data, you've got type safety in this component and its API (remember, the component is already its own API route).

## A little refactoring

A solid practice is to create a module that deals with a particular concern. In our case it's going to be reading and writing posts. Let's set that up now and add a `getPosts` export to our module.

💿 Create `app/models/post.server.ts`

```shellscript nonumber
touch app/models/post.server.ts
```

We're mostly going to copy/paste stuff from our route:

```tsx filename=app/models/post.server.ts
type Post = {
  slug: string;
  title: string;
};

export async function getPosts(): Promise<Array<Post>> {
  return [
    {
      slug: "my-first-post",
      title: "My First Post",
    },
    {
      slug: "90s-mixtape",
      title: "A Mixtape I Made Just For You",
    },
  ];
}
```

Note that we're making the `getPosts` function `async` because even though it's not currently doing anything async it will soon!

💿 Update the posts route to use our new posts module:

```tsx filename=app/routes/posts._index.tsx lines=[4,6-8] nocopy
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { getPosts } from "~/models/post.server";

export const loader = async () => {
  return json({ posts: await getPosts() });
};

// ...
```

## Pulling from a data source

With the Indie Stack, we've got a SQLite database already set up and configured for us, so let's update our Database Schema to handle SQLite. We're using [Prisma][prisma] to interact with the database, so we'll update that schema and Prisma will take care of updating our database to match the schema for us (as well as generating and running the necessary SQL commands for the migration).

<docs-info>You do not have to use Prisma when using Remix. Remix works great with whatever existing database or data persistence services you're currently using.</docs-info>

If you've never used Prisma before, don't worry, we'll walk you through it.

💿 First, we need to update our Prisma schema:

```prisma filename=prisma/schema.prisma nocopy
// Stick this at the bottom of that file:

model Post {
  slug     String @id
  title    String
  markdown String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

💿 Let's generate a migration file for our schema changes, which will be required if you deploy your application rather than just running in dev mode locally. This will also update our local database and TypeScript definitions to match the schema change. We'll name the migration "create post model".

```shellscript nonumber
npx prisma migrate dev --name "create post model"
```

💿 Let's seed our database with a couple posts. Open `prisma/seed.ts` and add this to the end of the seed functionality (right before the `console.log`):

```ts filename=prisma/seed.ts
const posts = [
  {
    slug: "my-first-post",
    title: "My First Post",
    markdown: `
# This is my first post

Isn't it great?
    `.trim(),
  },
  {
    slug: "90s-mixtape",
    title: "A Mixtape I Made Just For You",
    markdown: `
# 90s Mixtape

- I wish (Skee-Lo)
- This Is How We Do It (Montell Jordan)
- Everlong (Foo Fighters)
- Ms. Jackson (Outkast)
- Interstate Love Song (Stone Temple Pilots)
- Killing Me Softly With His Song (Fugees, Ms. Lauryn Hill)
- Just a Friend (Biz Markie)
- The Man Who Sold The World (Nirvana)
- Semi-Charmed Life (Third Eye Blind)
- ...Baby One More Time (Britney Spears)
- Better Man (Pearl Jam)
- It's All Coming Back to Me Now (Céline Dion)
- This Kiss (Faith Hill)
- Fly Away (Lenny Kravits)
- Scar Tissue (Red Hot Chili Peppers)
- Santa Monica (Everclear)
- C'mon N' Ride it (Quad City DJ's)
    `.trim(),
  },
];

for (const post of posts) {
  await prisma.post.upsert({
    where: { slug: post.slug },
    update: post,
    create: post,
  });
}
```

<docs-info>Note that we're using `upsert` so you can run the seed script over and over without adding multiple versions of the same post every time.</docs-info>

Great, let's get those posts into the database with the seed script:

```
npx prisma db seed
```

💿 Now update the `app/models/post.server.ts` file to read from the SQLite database:

```ts filename=app/models/post.server.ts
import { prisma } from "~/db.server";

export async function getPosts() {
  return prisma.post.findMany();
}
```

<docs-success>Notice we're able to remove the return type, but everything is still fully typed. The TypeScript feature of Prisma is one of its greatest strengths. Less manual typing, but still type safe!</docs-success>

<docs-info>The `~/db.server` import is importing the file at `app/db.server.ts`. The `~` is a fancy alias to the `app` directory, so you don't have to worry about how many `../../`s to include in your import as you move files around.</docs-info>

You should be able to go to `http://localhost:3000/posts` and the posts should still be there, but now they're coming from SQLite!

## Dynamic Route Params

Now let's make a route to actually view the post. We want these URLs to work:

```
/posts/my-first-post
/posts/90s-mixtape
```

Instead of creating a route for every single one of our posts, we can use a "dynamic segment" in the url. Remix will parse and pass to us, so we can look up the post dynamically.

💿 Create a dynamic route at `app/routes/posts.$slug.tsx`

```shellscript nonumber
touch app/routes/posts.\$slug.tsx
```

```tsx filename=app/routes/posts.$slug.tsx
export default function PostSlug() {
  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="my-6 border-b-2 text-center text-3xl">
        Some Post
      </h1>
    </main>
  );
}
```

You can click one of your posts and should see the new page.

💿 Add a loader to access the params

```tsx filename=app/routes/posts.$slug.tsx lines=[1-3,5-9,12,16]
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async ({
  params,
}: LoaderFunctionArgs) => {
  return json({ slug: params.slug });
};

export default function PostSlug() {
  const { slug } = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="my-6 border-b-2 text-center text-3xl">
        Some Post: {slug}
      </h1>
    </main>
  );
}
```

The part of the filename attached to the `$` becomes a named key on the `params` object that comes into your loader. This is how we'll look up our blog post.

Now, let's actually get the post contents from the database by its slug.

💿 Add a `getPost` function to our post module

```tsx filename=app/models/post.server.ts lines=[7-9]
import { prisma } from "~/db.server";

export async function getPosts() {
  return prisma.post.findMany();
}

export async function getPost(slug: string) {
  return prisma.post.findUnique({ where: { slug } });
}
```

💿 Use the new `getPost` function in the route

```tsx filename=app/routes/posts.$slug.tsx lines=[5,10-11,15,19]
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { getPost } from "~/models/post.server";

export const loader = async ({
  params,
}: LoaderFunctionArgs) => {
  const post = await getPost(params.slug);
  return json({ post });
};

export default function PostSlug() {
  const { post } = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="my-6 border-b-2 text-center text-3xl">
        {post.title}
      </h1>
    </main>
  );
}
```

Check that out! We're now pulling our posts from a data source instead of including it all in the browser as JavaScript.

Let's make TypeScript happy with our code:

```tsx filename=app/routes/posts.$slug.tsx lines=[4,11,14]
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { getPost } from "~/models/post.server";

export const loader = async ({
  params,
}: LoaderFunctionArgs) => {
  invariant(params.slug, "params.slug is required");

  const post = await getPost(params.slug);
  invariant(post, `Post not found: ${params.slug}`);

  return json({ post });
};

export default function PostSlug() {
  const { post } = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="my-6 border-b-2 text-center text-3xl">
        {post.title}
      </h1>
    </main>
  );
}
```

Quick note on that `invariant` for the params. Because `params` comes from the URL, we can't be totally sure that `params.slug` will be defined--maybe you change the name of the file to `posts.$postId.ts`! It's a good practice to validate that stuff with `invariant`, and it makes TypeScript happy too.

We also have an invariant for the post. We'll handle the `404` case better later. Keep going!

Now let's get that markdown parsed and rendered to HTML to the page. There are a lot of Markdown parsers, we'll use `marked` for this tutorial because it's really easy to get working.

💿 Parse the markdown into HTML

```shellscript nonumber
npm add marked@^4.3.0
# additionally, if using typescript
npm add @types/marked@^4.3.1 -D
```

Now that `marked` has been installed, we will need to restart our server. So stop the dev server and start it back up again with `npm run dev`.

```tsx filename=app/routes/posts.$slug.tsx lines=[4,17-18,22,28]
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { marked } from "marked";
import invariant from "tiny-invariant";

import { getPost } from "~/models/post.server";

export const loader = async ({
  params,
}: LoaderFunctionArgs) => {
  invariant(params.slug, "params.slug is required");

  const post = await getPost(params.slug);
  invariant(post, `Post not found: ${params.slug}`);

  const html = marked(post.markdown);
  return json({ html, post });
};

export default function PostSlug() {
  const { html, post } = useLoaderData<typeof loader>();
  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="my-6 border-b-2 text-center text-3xl">
        {post.title}
      </h1>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
```

Holy smokes, you did it. You have a blog. Check it out! Remix, we're going to make it easier to create new blog posts 📝

## Nested Routing

Right now, our blog posts just come from seeding the database. Not a real solution, so we need a way to create a new blog post in the database. We're going to be using actions for that.

Let's make a new "admin" section of the app.

💿 First, let's add a link to the admin section on the posts index route:

```tsx filename=app/routes/posts._index.tsx
// ...
<Link to="admin" className="text-red-600 underline">
  Admin
</Link>
// ...
```

Put that anywhere in the component. I stuck it right under the `<h1>`.

<docs-info>Did you notice that the `to` prop is just "admin" and it linked to `/posts/admin`? With Remix, you get relative links.</docs-info>

💿 Create an admin route at `app/routes/posts.admin.tsx`:

```shellscript nonumber
touch app/routes/posts.admin.tsx
```

```tsx filename=app/routes/posts.admin.tsx
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { getPosts } from "~/models/post.server";

export const loader = async () => {
  return json({ posts: await getPosts() });
};

export default function PostAdmin() {
  const { posts } = useLoaderData<typeof loader>();
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="my-6 mb-2 border-b-2 text-center text-3xl">
        Blog Admin
      </h1>
      <div className="grid grid-cols-4 gap-6">
        <nav className="col-span-4 md:col-span-1">
          <ul>
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  to={post.slug}
                  className="text-blue-600 underline"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="col-span-4 md:col-span-3">
          ...
        </main>
      </div>
    </div>
  );
}
```

You should recognize several of the things we're doing in there from what we've done so far. With that, you should have a decent looking page with the posts on the left and a placeholder on the right.
Now, if you click on the Admin link, it'll take you to [http://localhost:3000/posts/admin][http-localhost-3000-posts-admin].

### Index Routes

Let's fill in that placeholder with an index route for admin. Hang with us, we're introducing "nested routes" here where your route file nesting becomes UI component nesting.

💿 Create an index route for `posts.admin.tsx`'s child routes

```shellscript nonumber
touch app/routes/posts.admin._index.tsx
```

```tsx filename=app/routes/posts.admin._index.tsx
import { Link } from "@remix-run/react";

export default function AdminIndex() {
  return (
    <p>
      <Link to="new" className="text-blue-600 underline">
        Create a New Post
      </Link>
    </p>
  );
}
```

If you refresh you're not going to see it yet. Every route that starts with `app/routes/posts.admin.` can now render _inside_ of `app/routes/posts.admin.tsx` when their URL matches. You get to control which part of the `posts.admin.tsx` layout the child routes render.

💿 Add an outlet to the admin page

```tsx filename=app/routes/posts.admin.tsx lines=[4,37]
import { json } from "@remix-run/node";
import {
  Link,
  Outlet,
  useLoaderData,
} from "@remix-run/react";

import { getPosts } from "~/models/post.server";

export const loader = async () => {
  return json({ posts: await getPosts() });
};

export default function PostAdmin() {
  const { posts } = useLoaderData<typeof loader>();
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="my-6 mb-2 border-b-2 text-center text-3xl">
        Blog Admin
      </h1>
      <div className="grid grid-cols-4 gap-6">
        <nav className="col-span-4 md:col-span-1">
          <ul>
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  to={post.slug}
                  className="text-blue-600 underline"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="col-span-4 md:col-span-3">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

Hang with us for a minute, index routes can be confusing at first. Just know that when the URL matches the parent route's path, the index will render inside the `Outlet`.

Maybe this will help, let's add the `/posts/admin/new` route and see what happens when we click the link.

💿 Create the `app/routes/posts.admin.new.tsx` file

```shellscript nonumber
touch app/routes/posts.admin.new.tsx
```

```tsx filename=app/routes/posts.admin.new.tsx
export default function NewPost() {
  return <h2>New Post</h2>;
}
```

Now click the link from the index route and watch the `<Outlet/>` automatically swap out the index route for the "new" route!

## Actions

We're going to get serious now. Let's build a form to create a new post in our new "new" route.

💿 Add a form to the new route

```tsx filename=app/routes/posts.admin.new.tsx
import { Form } from "@remix-run/react";

const inputClassName =
  "w-full rounded border border-gray-500 px-2 py-1 text-lg";

export default function NewPost() {
  return (
    <Form method="post">
      <p>
        <label>
          Post Title:{" "}
          <input
            type="text"
            name="title"
            className={inputClassName}
          />
        </label>
      </p>
      <p>
        <label>
          Post Slug:{" "}
          <input
            type="text"
            name="slug"
            className={inputClassName}
          />
        </label>
      </p>
      <p>
        <label htmlFor="markdown">Markdown: </label>
        <br />
        <textarea
          id="markdown"
          rows={20}
          name="markdown"
          className={`${inputClassName} font-mono`}
        />
      </p>
      <p className="text-right">
        <button
          type="submit"
          className="rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300"
        >
          Create Post
        </button>
      </p>
    </Form>
  );
}
```

If you love HTML like us, you should be getting pretty excited. If you've been doing a lot of `<form onSubmit>` and `<button onClick>` you're about to have your mind blown by HTML.

All you really need for a feature like this is a form to get data from the user and a backend action to handle it. And in Remix, that's all you have to do too.

Let's create the essential code that knows how to save a post first in our `post.ts` module.

💿 Add `createPost` anywhere inside of `app/models/post.server.ts`

```tsx filename=app/models/post.server.ts nocopy
// ...
export async function createPost(post) {
  return prisma.post.create({ data: post });
}
```

💿 Call `createPost` from the new post route's action

```tsx filename=app/routes/posts.admin.new.tsx lines=[1-2,5,7-19] nocopy
import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";

import { createPost } from "~/models/post.server";

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const formData = await request.formData();

  const title = formData.get("title");
  const slug = formData.get("slug");
  const markdown = formData.get("markdown");

  await createPost({ title, slug, markdown });

  return redirect("/posts/admin");
};

// ...
```

That's it. Remix (and the browser) will take care of the rest. Click the submit button and watch the sidebar that lists our posts update automatically.

In HTML an input's `name` attribute is sent over the network and available by the same name on the request's `formData`. Oh, and don't forget, the `request` and `formData` objects are both straight out of the web specification. So if you want to learn more about either of them, head over to MDN!

- [`Request`][mdn-request]
- [`Request.formData`][mdn-request-form-data].

TypeScript is mad again, let's add some types.

💿 Add the types to `app/models/post.server.ts`

```tsx filename=app/models/post.server.ts lines=[2,7]
// ...
import type { Post } from "@prisma/client";

// ...

export async function createPost(
  post: Pick<Post, "slug" | "title" | "markdown">
) {
  return prisma.post.create({ data: post });
}
```

Whether you're using TypeScript or not, we've got a problem when the user doesn't provide values on some of these fields (and TS is still mad about that call to `createPost`).

Let's add some validation before we create the post.

💿 Validate if the form data contains what we need, and return the errors if not

```tsx filename=app/routes/posts.admin.new.tsx lines=[2,16-26]
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";

import { createPost } from "~/models/post.server";

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const formData = await request.formData();

  const title = formData.get("title");
  const slug = formData.get("slug");
  const markdown = formData.get("markdown");

  const errors = {
    title: title ? null : "Title is required",
    slug: slug ? null : "Slug is required",
    markdown: markdown ? null : "Markdown is required",
  };
  const hasErrors = Object.values(errors).some(
    (errorMessage) => errorMessage
  );
  if (hasErrors) {
    return json(errors);
  }

  await createPost({ title, slug, markdown });

  return redirect("/posts/admin");
};

// ...
```

Notice we don't return a redirect this time, we actually return the errors. These errors are available to the component via `useActionData`. It's just like `useLoaderData` but the data comes from the action after a form POST.

💿 Add validation messages to the UI

```tsx filename=app/routes/posts.admin.new.tsx lines=[3,11,18-20,27-29,36-40]
import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect, json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

// ...

const inputClassName =
  "w-full rounded border border-gray-500 px-2 py-1 text-lg";

export default function NewPost() {
  const errors = useActionData<typeof action>();

  return (
    <Form method="post">
      <p>
        <label>
          Post Title:{" "}
          {errors?.title ? (
            <em className="text-red-600">{errors.title}</em>
          ) : null}
          <input type="text" name="title" className={inputClassName} />
        </label>
      </p>
      <p>
        <label>
          Post Slug:{" "}
          {errors?.slug ? (
            <em className="text-red-600">{errors.slug}</em>
          ) : null}
          <input type="text" name="slug" className={inputClassName} />
        </label>
      </p>
      <p>
        <label htmlFor="markdown">
          Markdown:{" "}
          {errors?.markdown ? (
            <em className="text-red-600">
              {errors.markdown}
            </em>
          ) : null}
        </label>
        <br />
        <textarea
          id="markdown"
          rows={20}
          name="markdown"
          className={`${inputClassName} font-mono`}
        />
      </p>
      <p className="text-right">
        <button
          type="submit"
          className="rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300"
        >
          Create Post
        </button>
      </p>
    </Form>
  );
}
```

TypeScript is still mad, because someone could call our API with non-string values, so let's add some invariants to make it happy.

```tsx filename=app/routes/posts.admin.new.tsx nocopy
//...
import invariant from "tiny-invariant";
// ..

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  // ...
  invariant(
    typeof title === "string",
    "title must be a string"
  );
  invariant(
    typeof slug === "string",
    "slug must be a string"
  );
  invariant(
    typeof markdown === "string",
    "markdown must be a string"
  );

  await createPost({ title, slug, markdown });

  return redirect("/posts/admin");
};
```

## Progressive Enhancement

For some real fun, [disable JavaScript][disable-java-script] in your dev tools and try it out. Because Remix is built on the fundamentals of HTTP and HTML, this whole thing works without JavaScript in the browser 🤯 But that's not the point. What's cool about it is that this means our UI is resilient to network issues. But we really _like_ having JavaScript in the browser and there are a lot of cool things we can do when we've got it, so make sure to re-enable JavaScript before continuing, because we're going to need it to _progressively enhance_ the user experience remix.

Let's slow this down and add some "pending UI" to our form.

💿 Slow down our action with a fake delay

```tsx filename=app/routes/posts.admin.new.tsx lines=[5-6]
// ...
export const action = async ({
  request,
}: ActionFunctionArgs) => {
  // TODO: remove me
  await new Promise((res) => setTimeout(res, 1000));

  // ...
};
//...
```

💿 Add some pending UI with `useNavigation`

```tsx filename=app/routes/posts.admin.new.tsx lines=[6,14-17,26,28]
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useNavigation,
} from "@remix-run/react";

// ..

export default function NewPost() {
  const errors = useActionData<typeof action>();

  const navigation = useNavigation();
  const isCreating = Boolean(
    navigation.state === "submitting"
  );

  return (
    <Form method="post">
      {/* ... */}
      <p className="text-right">
        <button
          type="submit"
          className="rounded bg-blue-500 py-2 px-4 text-white hover:bg-blue-600 focus:bg-blue-400 disabled:bg-blue-300"
          disabled={isCreating}
        >
          {isCreating ? "Creating..." : "Create Post"}
        </button>
      </p>
    </Form>
  );
}
```

Tada! You just implemented JavaScript-enabled progressive enhancement! 🥳 With what we've done, the experience is better than what the browser can do by itself. Lots of apps use JavaScript to _enable_ the experience (and a select few actually do require JavaScript to work), but we've got a working experience as a baseline and just used JavaScript to _enhance_ it.

## Homework

That's it for today! Here are some bits of homework to implement if you want to go deeper:

**Update/Delete posts:** make a `posts.admin.$slug.tsx` page for your posts. This should open an edit page for the post that allows you to update the post or even delete it. The links are already there in the sidebar, but they return 404! Create a new route that reads the posts, and puts them into the fields. All the code you need is already in `app/routes/posts.$slug.tsx` and `app/routes/posts.admin.new.tsx`. You just gotta put it together.

**Optimistic UI:** You know how when you favorite a tweet, the heart goes red instantly and if the tweet is deleted it reverts back to empty? That's Optimistic UI: assume the request will succeed, and render what the user will see if it does. So your homework is to make it so when you hit "Create" it renders the post in the left nav and renders the "Create a New Post" link (or if you add update/delete do it for those too). You'll find this ends up being easier than you think even if it takes you a second to arrive there (and if you've implemented this pattern in the past, you'll find Remix makes this much easier). Learn more from [the Pending UI guide][the-pending-ui-guide].

**Authenticated users only:** Another cool bit of homework you could do is make it so only authenticated users can create posts. You've already got authentication all set up for you thanks to the Indie Stack. Tip: if you want to make it, so you're the only one who can make posts, simply check the user's email in your loaders and actions and if it's not yours redirect them [somewhere][somewhere] 😈

**Customize the app:** If you're happy with Tailwind CSS, keep it around, otherwise, check [the styling guide][the-styling-guide] to learn of other options. Remove the `Notes` model and routes, etc. Whatever you want to make this thing yours.

**Deploy the app:** Check the README of your project. It has instructions you can follow to get your app deployed to Fly.io. Then you can actually start blogging!

We hope you love Remix! 💿 👋

[gitpod]: https://gitpod.io
[gitpod-ready-to-code-image]: https://gitpod.io/#https://github.com/remix-run/indie-stack
[gitpod-ready-to-code]: https://img.shields.io/badge/Gitpod-Ready--to--Code-blue?logo=gitpod
[node-js]: https://nodejs.org
[npm]: https://www.npmjs.com
[vs-code]: https://code.visualstudio.com
[the-stacks-docs]: ../guides/templates#stacks
[the-indie-stack]: https://github.com/remix-run/indie-stack
[fly-io]: https://fly.io
[http-localhost-3000]: http://localhost:3000
[screenshot-of-the-app-showing-the-blog-post-link]: https://user-images.githubusercontent.com/1500684/160208939-34fe20ed-3146-4f4b-a68a-d82284339c47.png
[tailwind]: https://tailwindcss.com
[the-styling-guide]: ../styling/tailwind
[prisma]: https://prisma.io
[http-localhost-3000-posts-admin]: http://localhost:3000/posts/admin
[mdn-request]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[mdn-request-form-data]: https://developer.mozilla.org/en-US/docs/Web/API/Request/formData
[disable-java-script]: https://developer.chrome.com/docs/devtools/javascript/disable
[the-pending-ui-guide]: ../discussion/pending-ui
[somewhere]: https://www.youtube.com/watch?v=dQw4w9WgXcQ
