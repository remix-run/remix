---
title: Developer Blog
order: 1
---

# Quickstart

We're going to be short on words and quick on code in this quickstart. If you're looking to see what Remix is all about in 15 minutes, this is it.

<docs-info>💿 Hey I'm Derrick the Remix Compact Disc 👋 Whenever you're supposed to _do_ something you'll see me</docs-info>

This uses TypeScript, but we always pepper the types on after we write the code. This isn't our normal workflow, but some of you aren't using TypeScript so we didn't want to clutter up the code for you. Normally we create the type as we write the code so that we get it right the first time (measure twice, cut once!).

## Creating the project

💿 Initialize a new Remix project

```sh
npx create-remix@latest
# choose Remix App Server
cd [whatever you named the project]
npm run dev
```

<docs-error>It is important that you pick Remix App Server</docs-error>

We're going to be doing some work with the file system and not all setups are compatible with the code in this tutorial.

Open up [https://localhost:3000](https://localhost:3000), the app should be running. If you want, take a minute and poke around the starter template, there's a lot of information in there.

If your application is not running properly at [https://localhost:3000](https://localhost:3000) refer to the README.md in the generated project files to see if additional set up is required for your deployment target.

## Your First Route

We're going to make a new route to render at the "/posts" URL. Before we do that, let's link to it.

💿 First, go to `app/root.tsx`

There's a bit going on in the file `app/root.tsx`. Find the `Layout` component, and right after the link to "Home", add a new link to "/posts"

💿 Add a link to posts in `app/root.tsx`

```tsx
<li>
  <Link to="/posts">Posts</Link>
</li>
```

Back in the browser you should see your new link in the header. Go ahead and click it, you should see a 404 page. Let's create the route now:

💿 Create a new file in `app/routes/posts/index.tsx`

```sh
mkdir app/routes/posts
touch app/routes/posts/index.tsx
```

<docs-info>Any time you see terminal commands to create files or folders, you can of course do that however you'd like, but using `mkdir` and `touch` is just a way for us to make it clear which files you should be creating.</docs-info>

We could have named it just `posts.tsx` but we'll have another route soon and it'll be nice to put them by each other. An index route will render at the folder's path (just like index.html on a web server).

You'll probably see the screen just go blank with `null`. You've got a route but there's nothing there yet. Let's add a component and export it as the default:

💿 Make the posts component

```tsx filename=app/routes/posts/index.tsx
export default function Posts() {
  return (
    <div>
      <h1>Posts</h1>
    </div>
  );
}
```

You might need to refresh the browser to see our new, bare-bones posts route.

## Loading Data

Data loading is built in to Remix.

If your web dev background is primarily in the last few years you're probably used to creating two things here: an API route to provide data and a frontend component that consumes it. In Remix your frontend component is also it's own API route and it already knows how to talk to itself on the server from the browser. That is, you don't have to fetch it.

If your background is a bit farther back than that with Rails, PHP, etc. Then you can think of your Remix routes as backend views using React for templating, but then they know how to seamlessly hydrate in the browser to add some flair. It's progressive enhancement realized in its fullest.

So let's get to it and provide some data to our component.

💿 Make the posts route "loader"

```tsx filename=app/routes/posts/index.tsx lines=[1,3-14,17-18]
import { useLoaderData } from "remix";

export let loader = () => {
  return [
    {
      slug: "my-first-post",
      title: "My First Post"
    },
    {
      slug: "90s-mixtape",
      title: "A Mixtape I Made Just For You"
    }
  ];
};

export default function Posts() {
  let posts = useLoaderData();
  console.log(posts);
  return (
    <div>
      <h1>Posts</h1>
    </div>
  );
}
```

Loaders are the backend "API" for their component and it's already wired up for you through `useLoaderData`. It's a little wild how blurry the line is between the client and the server in a Remix route. If you have your server and browser consoles both open, you'll note that they both logged our post data. That's because Remix rendered on the server to send a full HTML document like a traditional web framework, but it also hydrated in the client and logged there too.

<docs-info>We use <code>let</code> because it is only three letters, you can use <code>const</code> if you want 🙂</docs-info>

💿 Render links to our posts

```tsx filename=app/routes/posts/index.tsx lines=[9-15]
import { Link, useLoaderData } from "remix";

// ...
export default function Posts() {
  let posts = useLoaderData();
  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.map(post => (
          <li key={post.slug}>
            <Link to={post.slug}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

TypeScript is mad, so let's help it out:

💿 Add the Post type and generic for `useLoaderData`

```tsx filename=app/routes/posts/index.tsx lines=[3-6,9,19,23]
import { Link, useLoaderData } from "remix";

type Post = {
  slug: string;
  title: string;
};

export let loader = () => {
  let posts: Post[] = [
    {
      slug: "my-first-post",
      title: "My First Post"
    },
    {
      slug: "90s-mixtape",
      title: "A Mixtape I Made Just For You"
    }
  ];
  return posts;
};

export default function Posts() {
  let posts = useLoaderData<Post[]>();
  return (
    <div>
      <h1>Posts</h1>
      <ul>
        {posts.map(post => (
          <li key={post.slug}>
            <Link to={post.slug}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Hey, that's pretty cool. We get a pretty solid degree of type safety even over a network request because it's all defined in the same file. Unless the network blows up while Remix fetches the data, you've got type safety in this component and it's API (remember, the component is already its own API route).

## A little refactoring

A solid practice is to create a module that deals with a particular concern. In our case it's going to be reading and writing posts. Let's set that up now and add a `getPosts` export to our module.

💿 Create `app/post.ts`

```sh
touch app/post.ts
```

We're mostly gonna copy/paste it from our route:

```tsx filename=app/post.ts
export type Post = {
  slug: string;
  title: string;
};

export function getPosts() {
  let posts: Post[] = [
    {
      slug: "my-first-post",
      title: "My First Post"
    },
    {
      slug: "90s-mixtape",
      title: "A Mixtape I Made Just For You"
    }
  ];
  return posts;
}
```

💿 Update the posts route to use our new posts module

```tsx filename=app/routes/posts/index.tsx
import { Link, useLoaderData } from "remix";
import { getPosts } from "~/post";
import type { Post } from "~/post";

export let loader = () => {
  return getPosts();
};

// ...
```

## Pulling from a data source

If we were building this for real, we'd want to store our posts in a database somewhere like Postgres, FaunaDB, Supabase, etc. This is a quickstart, so we're just going to use the file system.

Instead of hard-coding our links, we'll read them from the file system.

💿 Create a "posts/" folder in the root of the project, not in the app directory, but next to it.

```sh
mkdir posts
```

Now add some posts:

```sh
touch posts/my-first-post.md
touch posts/90s-mixtape.md
```

Put whatever you want in them, but make sure they've got some "front matter" attributes in them with a title

```md filename=posts/my-first-post.md
---
title: My First Post
---

# This is my first post

Isn't it great?
```

```md filename=posts/90s-mix-cdr.md
---
title: 90s Mixtape
---

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
```

💿 Update `getPosts` to read from the file system

We'll need a node module for this:

```sh
npm add front-matter
```

```tsx filename=app/post.ts lines=[1-3,11,13-28]
import path from "path";
import fs from "fs/promises";
import parseFrontMatter from "front-matter";

export type Post = {
  slug: string;
  title: string;
};

// relative to the server output not the source!
let postsPath = path.join(__dirname, "..", "posts");

export async function getPosts() {
  let dir = await fs.readdir(postsPath);
  return Promise.all(
    dir.map(async filename => {
      let file = await fs.readFile(
        path.join(postsPath, filename)
      );
      let { attributes } = parseFrontMatter(
        file.toString()
      );
      return {
        slug: filename.replace(/\.md$/, ""),
        title: attributes.title
      };
    })
  );
}
```

This isn't a Node file system tutorial, so you'll just have to trust us on that code. As mentioned before, you could pull this markdown from a database somewhere (which we will show you in a later tutorial).

<docs-error>If you did not use the Remix App Server you'll probably need to add an extra ".." on the path. Also note that you can't deploy this demo anywhere that doesn't have a persistent file system.</docs-error>

TypeScript is gonna be mad at that code, let's make it happy.

Since we're reading in a file, the type system has no idea what's in there, so we need a runtime check, for that we'll want an `invariant` method to make runtime checks like this easy.

💿 Ensure our posts have the proper meta data and get type safety

```sh
npm add tiny-invariant
```

```tsx filename=app/post.ts lines=[4,11-13,17-21,33-36]
import path from "path";
import fs from "fs/promises";
import parseFrontMatter from "front-matter";
import invariant from "tiny-invariant";

export type Post = {
  slug: string;
  title: string;
};

export type PostMarkdownAttributes = {
  title: string;
};

let postsPath = path.join(__dirname, "..", "posts");

function isValidPostAttributes(
  attributes: any
): attributes is PostMarkdownAttributes {
  return attributes?.title;
}

export async function getPosts() {
  let dir = await fs.readdir(postsPath);
  return Promise.all(
    dir.map(async filename => {
      let file = await fs.readFile(
        path.join(postsPath, filename)
      );
      let { attributes } = parseFrontMatter(
        file.toString()
      );
      invariant(
        isValidPostAttributes(attributes),
        `${filename} has bad meta data!`
      );
      return {
        slug: filename.replace(/\.md$/, ""),
        title: attributes.title
      };
    })
  );
}
```

Even if you aren't using TypeScript you're going to want that `invariant` check so you know what's wrong, too.

Okay! Back in the UI we should see our list of posts. Feel free to add some more posts, refresh, and watch the list grow.

## Dynamic Route Params

Now let's make a route to actually view the post. We want these URLs to work:

```
/posts/my-first-post
/posts/90s-mix-cdr
```

Instead of creating a route for every single one of our posts, we can use a "dynamic segment" in the url. Remix will parse and pass to us so we can look up the post dynamically.

💿 Create a dynamic route at "app/routes/posts/$slug.tsx"

```sh
touch app/routes/posts/\$slug.tsx
```

```tsx filename=app/routes/posts/$slug.tsx
export default function PostSlug() {
  return (
    <div>
      <h1>Some Post</h1>
    </div>
  );
}
```

You can click one of your posts and should see the new page.

💿 Add a loader to access the params

```tsx filename=app/routes/posts/$slug.tsx lines=[1,3-5,8,11]
import { useLoaderData } from "remix";

export let loader = async ({ params }) => {
  return params.slug;
};

export default function PostSlug() {
  let slug = useLoaderData();
  return (
    <div>
      <h1>Some Post: {slug}</h1>
    </div>
  );
}
```

The part of the filename attached to the `$` becomes a named key on the `params` object that comes into your loader. This is how we'll look up our blog post.

💿 Let's get some help from TypeScript for the loader function signature.

```tsx filename=app/routes/posts/$slug.tsx lines=[2,4]
import { useLoaderData } from "remix";
import type { LoaderFunction } from "remix";

export let loader: LoaderFunction = async ({ params }) => {
  return params.slug;
};
```

Now let's actually read the post from the file system.

💿 Add a `getPost` function to our post module

Put this function anywhere in the `app/post.ts` module:

```tsx filename=app/post.ts lines=[2,4]
// ...
export async function getPost(slug: string) {
  let filepath = path.join(postsPath, slug + ".md");
  let file = await fs.readFile(filepath);
  let { attributes } = parseFrontMatter(file.toString());
  invariant(
    isValidPostAttributes(attributes),
    `Post ${filepath} is missing attributes`
  );
  return { slug, title: attributes.title };
}
```

💿 Use the new `getPost` function in the route

```tsx filename=app/routes/posts/$slug.tsx lines=[3,4,7,8,15]
import { useLoaderData } from "remix";
import type { LoaderFunction } from "remix";
import { getPost } from "~/post";
import invariant from "tiny-invariant";

export let loader: LoaderFunction = async ({ params }) => {
  invariant(params.slug, "expected params.slug");
  return getPost(params.slug);
};

export default function PostSlug() {
  let post = useLoaderData();
  return (
    <div>
      <h1>{post.title}</h1>
    </div>
  );
}
```

Check that out! We're now pulling our posts from a data source instead of including it all in the browser as JavaScript.

Quick note on that `invariant`. Because `params` comes from the URL, we can't be totally sure that `params.slug` will be defined--maybe you change the name of the file to `$postId.ts`! It's good practice to validate that stuff with `invariant`, and it makes TypeScript happy too.

There are a lot of markdown parsers, we'll use "marked" for this tutorial because it's really easy to get working.

💿 Parse the markdown into HTML

```sh
npm add marked
# if using typescript
npm add @types/marked
```

```tsx filename=app/post.ts lines=[5,11,18,19]
import path from "path";
import fs from "fs/promises";
import parseFrontMatter from "front-matter";
import invariant from "tiny-invariant";
import { marked } from "marked";

//...
export async function getPost(slug: string) {
  let filepath = path.join(postsPath, slug + ".md");
  let file = await fs.readFile(filepath);
  let { attributes, body } = parseFrontMatter(
    file.toString()
  );
  invariant(
    isValidPostAttributes(attributes),
    `Post ${filepath} is missing attributes`
  );
  let html = marked(body);
  return { slug, html, title: attributes.title };
}
```

💿 Render the HTML in the route

```tsx filename=app/routes/posts/$slug.tsx lines=[5]
// ...
export default function PostSlug() {
  let post = useLoaderData();
  return (
    <div dangerouslySetInnerHTML={{ __html: post.html }} />
  );
}
```

Holy smokes, you did it. You have a blog.

## Creating Blog Posts

Right now our blog posts (and typo fixes) are tied to deploys. That's gross. The idea here is that your posts would be backed by a database, so we need a way to create a new blog post. We're going to be using actions for that.

Let's make a new "admin" section of the app.

💿 Create an admin route

```sh
touch app/routes/admin.tsx
```

```tsx filename=app/routes/admin.tsx
import { Link, useLoaderData } from "remix";
import { getPosts } from "~/post";
import type { Post } from "~/post";

export let loader = () => {
  return getPosts();
};

export default function Admin() {
  let posts = useLoaderData<Post[]>();
  return (
    <div className="admin">
      <nav>
        <h1>Admin</h1>
        <ul>
          {posts.map(post => (
            <li key={post.slug}>
              <Link to={post.slug}>{post.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <main>...</main>
    </div>
  );
}
```

You should recognize a lot of that code from the posts route. We set up some extra HTML structure cause we're going to style this real quick.

💿 Create an admin stylesheet

```sh
touch app/styles/admin.css
```

```css filename=app/styles/admin.css
.admin {
  display: flex;
}

.admin > nav {
  padding-right: 2rem;
}

.admin > main {
  flex: 1;
  border-left: solid 1px #ccc;
  padding-left: 2rem;
}

em {
  color: red;
}
```

💿 Link to the stylesheet in the admin route

```tsx filename=app/routes/admin.tsx lines=[4,6-8]
import { Link, useLoaderData } from "remix";
import { getPosts } from "~/post";
import type { Post } from "~/post";
import adminStyles from "~/styles/admin.css";

export let links = () => {
  return [{ rel: "stylesheet", href: adminStyles }];
};

// ...
```

Each route can export a `links` function that returns array of `<link>` tags, except in object form instead of HTML. So we use `{ rel: "stylesheet", href: adminStyles}` instead of `<link rel="stylesheet" href="..." />`. This allows Remix to merge all of your rendered routes links together and render them in the `<Links/>` element at the top of your document. You can see it in `root.tsx` if you're curious.

Alright, you should have a a decent looking page with the posts on the left and a placeholder on the right.

## Index Routes

Let's fill in that placeholder with an index route for admin. Hang with us, we're introducing "nested routes" here where your route file nesting becomes UI component nesting.

💿 Create a folder for `admin.tsx`'s child routes, with an index inside

```sh
mkdir app/routes/admin
touch app/routes/admin/index.tsx
```

```tsx filename=app/routes/admin/index.tsx
import { Link } from "remix";

export default function AdminIndex() {
  return (
    <p>
      <Link to="new">Create a New Post</Link>
    </p>
  );
}
```

If you refresh you're not going to see it yet. Every route inside of `app/routes/admin/` can now render _inside_ of `app/routes/admin.tsx` when their URL matches. You get to control which part of the `admin.tsx` layout the child routes render.

💿 Add an outlet to the admin page

```tsx filename=app/routes/admin.tsx lines=[19]
import { Outlet, Link, useLoaderData } from "remix";

//...
export default function Admin() {
  let posts = useLoaderData<Post[]>();
  return (
    <div className="admin">
      <nav>
        <h1>Admin</h1>
        <ul>
          {posts.map(post => (
            <li key={post.slug}>
              <Link to={post.slug}>{post.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

Hang with us for a minute, index routes can be confusing at first. Just know that when the URL matches the parent route's path, the index will render inside the outlet.

Maybe this will help, let's add the "/admin/new" route and see what happens when we click the link.

💿 Create the `app/routes/admin/new.tsx` route

```sh
touch app/routes/admin/new.tsx
```

```tsx filename=app/routes/admin/new.tsx
export default function NewPost() {
  return <h2>New Post</h2>;
}
```

Now click the link from the index route and watch the `<Outlet/>` automatically swap out the index route for the "new" route!

## Actions

We're gonna get serious now. Let's build a form to create a new post in the our new "new" route.

💿 Add a form to the new route

```tsx filename=app/routes/admin/new.tsx lines=[1,5-22]
import { Form } from "remix";

export default function NewPost() {
  return (
    <Form method="post">
      <p>
        <label>
          Post Title: <input type="text" name="title" />
        </label>
      </p>
      <p>
        <label>
          Post Slug: <input type="text" name="slug" />
        </label>
      </p>
      <p>
        <label htmlFor="markdown">Markdown</label>
        <br />
        <textarea rows={20} name="markdown" />
      </p>
      <p>
        <button type="submit">Create Post</button>
      </p>
    </Form>
  );
}
```

If you love HTML like us, you should be getting pretty excited. If you've been doing a lot of `<form onSubmit>` and `<button onClick>` you're about to have your mind blown by HTML.

All you really need for a feature like this is a form to get data from the user and a backend action to handle it. And in Remix, that's all you have to.

Let's create the essential code that knows how to save a post first in our `post.ts` module.

💿 Add `createPost` anywhere inside of `app/post.ts`

```tsx filename=app/post.ts
// ...
export async function createPost(post) {
  let md = `---\ntitle: ${post.title}\n---\n\n${post.markdown}`;
  await fs.writeFile(
    path.join(postsPath, post.slug + ".md"),
    md
  );
  return getPost(post.slug);
}
```

💿 Call `createPost` from the new post route's action

```tsx filename=app/routes/admin/new.tsx lines=[1,2,4-14]
import { redirect, Form } from "remix";
import { createPost } from "~/post";

export let action = async ({ request }) => {
  let formData = await request.formData();

  let title = formData.get("title");
  let slug = formData.get("slug");
  let markdown = formData.get("markdown");

  await createPost({ title, slug, markdown });

  return redirect("/admin");
};

export default function NewPost() {
  // ...
}
```

That's it. Remix (and the browser) will take of the rest. Click the submit button and watch the sidebar that lists our posts update automatically.

In HTML an input's `name` attribute is sent over the network and available by the same name on the request's `formData`.

TypeScript is mad again, let's add some types.

💿 Add the types to both files we changed

```tsx filename=app/post.ts lines=[2-6,8]
// ...
type NewPost = {
  title: string;
  slug: string;
  markdown: string;
};

export async function createPost(post: NewPost) {
  let md = `---\ntitle: ${post.title}\n---\n\n${post.markdown}`;
  await fs.writeFile(
    path.join(postsPath, post.slug + ".md"),
    md
  );
  return getPost(post.slug);
}

//...
```

```tsx filename=app/routes/admin/new.tsx lines=[2,5]
import { Form, redirect } from "remix";
import type { ActionFunction } from "remix";
import { createPost } from "~/post";

export let action: ActionFunction = async ({ request }) => {
  let formData = await request.formData();

  let title = formData.get("title");
  let slug = formData.get("slug");
  let markdown = formData.get("markdown");

  await createPost({ title, slug, markdown });

  return redirect("/admin");
};
```

Whether you're using TypeScript or not, we've got a problem when the user doesn't provide values on some of these fields (and TS is still mad about that call to `createPost`).

Let's add some validation before we create the post.

💿 Validate if the form data contains what we need, and return the errors if not

```tsx filename=app/routes/admin/new.tsx lines=[9-12,14-16]
//...
export let action: ActionFunction = async ({ request }) => {
  let formData = await request.formData();

  let title = formData.get("title");
  let slug = formData.get("slug");
  let markdown = formData.get("markdown");

  let errors = {};
  if (!title) errors.title = true;
  if (!slug) errors.slug = true;
  if (!markdown) errors.markdown = true;

  if (Object.keys(errors).length) {
    return errors;
  }

  await createPost({ title, slug, markdown });

  return redirect("/admin");
};
```

Notice we don't return a redirect this time, we actually return the errors. These errors are available to the component via `useActionData`. It's just like `useLoaderData` but the data comes from the action after a form POST.

💿 Add validation messages to the UI

```tsx filename=app/routes/admin/new.tsx lines=[1,12-13,19-20,25-26]
import { useActionData, Form, redirect } from "remix";

// ...

export default function NewPost() {
  let errors = useActionData();

  return (
    <Form method="post">
      <p>
        <label>
          Post Title:{" "}
          {errors?.title && <em>Title is required</em>}
          <input type="text" name="title" />
        </label>
      </p>
      <p>
        <label>
          Post Slug:{" "}
          {errors?.slug && <em>Slug is required</em>}
          <input type="text" name="slug" />
        </label>
      </p>
      <p>
        <label htmlFor="markdown">Markdown:</label>{" "}
        {errors?.markdown && <em>Markdown is required</em>}
        <br />
        <textarea rows={20} name="markdown" />
      </p>
      <p>
        <button type="submit">Create Post</button>
      </p>
    </Form>
  );
}
```

TypeScript is still mad, so let's add some invariants to make it happy.

```tsx filename=app/routes/admin/new.tsx lines=[2,11-14,16-18]
//...
import invariant from "tiny-invariant";

export let action: ActionFunction = async ({ request }) => {
  // ...

  if (Object.keys(errors).length) {
    return errors;
  }

  invariant(typeof title === "string");
  invariant(typeof slug === "string");
  invariant(typeof markdown === "string");
  await createPost({ title, slug, markdown });

  return redirect("/admin");
};
```

For some real fun, disable JavaScript in your dev tools and try it out. Because Remix is built on the fundamentals of HTTP and HTML, this whole thing works without JavaScript in the browser. But that's not the point. Let's slow this down and add some "pending UI" to our form.

💿 Slow down our action with a fake delay

```tsx filename=app/routes/admin/new.tsx lines=[3]
// ...
export let action: ActionFunction = async ({ request }) => {
  await new Promise(res => setTimeout(res, 1000));
  let formData = await request.formData();
  let title = formData.get("title");
  let slug = formData.get("slug");
  let markdown = formData.get("markdown");
  // ...
};
//...
```

💿 Add some pending UI with `useTransition`

```tsx filename=app/routes/admin/new.tsx lines=[2,12,20-22]
import {
  useTransition,
  useActionData,
  Form,
  redirect
} from "remix";

// ...

export default function NewPost() {
  let errors = useActionData();
  let transition = useTransition();

  return (
    <Form method="post">
      {/* ... */}

      <p>
        <button type="submit">
          {transition.submission
            ? "Creating..."
            : "Create Post"}
        </button>
      </p>
    </Form>
  );
}
```

Now the user gets an enhanced experience than if we had just done this without JavaScript in the browser at all. Some other things that you could do to make it better is automatically slugify the title into the slug field or let the user override it (maybe we'll add that later).

That's it for today! You're homework is to make an `/admin/edit` page for your posts. The links are already there in the sidebar but they 404! Create a new route that reads the post, puts them into the fields. All the code you need is already in `app/routes/posts/$slug.ts` and `app/routes/posts/new.ts`. You just gotta put it together.

We hope you love Remix!
