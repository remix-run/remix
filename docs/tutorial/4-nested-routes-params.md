---
title: Nested Routes and Params
order: 4
---

Nested routes and layouts are a critical idea to understand in Remix, so we're going to build some UI with nested routes and data fetching.

We'll fetch a list of users for navigation, and then fetch their gists below it.

## Defining a "layout route" and loader

Layout routes are represented by two things on the file system: a file and a folder. The file is the React component, and the files inside the folder are the children that will render inside that component.

Create a folder at `app/routes/team` and a file at `app/routes/team.tsx`.

```bash
mkdir app/routes/team
touch app/routes/team.tsx
```

Now add this to `team.tsx`, it's another quick fetch to the GitHub API and a component to render it.

```tsx
import React from "react";
import { Link, Outlet, useLoaderData } from "remix";
import type { LoaderFunction } from "remix";

interface Member {
  id: string;
  login: string;
}

export let loader: LoaderFunction = () => {
  // you can point to whatever org you want, ofc
  return fetch(
    "https://api.github.com/orgs/reacttraining/members"
  );
};

export default function Team() {
  let data = useLoaderData<Member[]>();

  return (
    <div>
      <h2>Team</h2>
      <ul>
        {data.map((member) => (
          <li key={member.id}>
            <Link to={member.login}>{member.login}</Link>
          </li>
        ))}
      </ul>
      <hr />
      <Outlet />
    </div>
  );
}
```

We'll talk about that `<Outlet>` in a sec. First let's make a loader at `data/routes/team.ts`.

Alright, you should be able to visit http://localhost:3000/team and see a few users there. We've now defined our "layout route".

## Index Routes

At the moment, this isn't a layout at all, it's just a list of the team. Let's render a child route inside of our team route.

Make a file at `app/routes/team/index.tsx`.

```bash
touch app/routes/team/index.tsx
```

And drop this into it:

```tsx
import React from "react";

export default function TeamIndex() {
  return (
    <div>
      <h3>Team</h3>
      <p>
        Here we could show cool stats about the team or
        recent activity, etc.
      </p>
    </div>
  );
}
```

Refresh the browser. Our "index route" is rendering inside the `<Outlet />`. The outlet is a placeholder for all of the child routes whenever they match, while the layout around it persists.

Nested files = nested layouts.

When a layout route's URL is matched exactly, the "index" route will render into it's outlet, otherwise we'd have a blank section of the layout like we did a minute ago!

## Defining a child route with params

In the Team component we linked to each member of the team, let's go add the route to display their information. Make a file named `routes/team/$member.tsx`. If you're doing it from the terminal you may need to escape the \$, but text editors usually handle this just fine.

```bash
touch app/routes/team/$member.tsx

# might have to escape it depending on your terminal
touch app/routes/team/\$member.tsx
```

Now create another loader and component combo:

```tsx
import React from "react";
import { useLoaderData } from "remix";
import type { LoaderFunction } from "remix";

interface User {
  avatar_url: string;
  bio: string;
  company: string;
  location: string;
  name: string;
}

export let loader: LoaderFunction = ({ params }) => {
  return fetch(
    `https://api.github.com/users/${params.member}`
  );
};

export default function TeamMember() {
  let user = useLoaderData<User>();
  return (
    <div>
      <h3>{user.name}</h3>
      <img
        alt="user avatar"
        src={user.avatar_url}
        height="50"
      />
      <p>{user.bio}</p>
      <dl>
        <dt>Company</dt>
        <dd>{user.company}</dd>
        <dt>Location</dt>
        <dd>{user.location}</dd>
      </dl>
    </div>
  );
}
```

Note that Remix parses the params from the url (the `$member` portion of `routes/team/$member`) and passes them to the loader.

You should be able to visit http://localhost:3000/team, click the members, and watch the data update.

## Reviewing the end result

Open up the network pane in the devtools and watch how the cache headers tell the browser not to refetch the member data for one minute. You should requests to `data?params=....` and then notice as you click through all the users, they all start coming from `(disk cache)` and not the server.

Also note that Remix is only fetching the data for the changed portion of the UI, the member. It doesn't need to refetch data from the `team.tsx`, because that part of the UI doesn't change. Remix has unique understanding of your app and can make optimizations like this thanks to nested routes.

You can watch this behavior by adding a `<Link to="/team">Team</Link>` in your "app/root.tsx" file, visiting http://localhost:3000, opening the network tab, and watching the data requests come through.

## Homework

Using the `meta` export from the last lesson, add titles to `team.tsx` and `$member.tsx`, and on the member page, display their name in the title.
