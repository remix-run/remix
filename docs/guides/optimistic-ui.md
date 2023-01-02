---
title: Optimistic UI
---

# Optimistic UI

Optimistic UI is a pattern to avoid showing busy spinners in your UI and make your application feel like it's responding instantly to user interactions that change data on the server. Even though it will take some time to make it to the server to be processed, we often have enough information in the UI that sent it to fake it. If for some reason it fails, we can then notify the user that there was a problem. In the vast majority of cases, it doesn't fail, and the app can respond instantly to the user's interactions.

Remix can help you build optimistic UI with [`useTransition`][use-transition] and [`useFetcher`][use-fetcher].

## Strategy

1. User submits a form (or you do with [`useSubmit`][use-submit] or [`fetcher.submit`][fetcher-submission])
2. Remix makes the submission and its data immediately available to you on [`transition.submission`][transition-submission] or [`fetcher.submission`][fetcher-submission]
3. App uses [`submission.formData`][form-data] to render an optimistic version of _what it will render_ when the submission completes successfully
4. Remix automatically revalidates all the data
   - If successful, the user doesn't even notice
   - If it fails, the page data is automatically in sync with the server so the UI reverts automatically
     - App notifies the user of a problem (which is also likely automatic in Remix with [error boundaries][error-boundary]).

## Example

Consider the workflow for viewing and creating a new project. The project route loads the project and renders it.

```tsx filename=app/routes/project/$id.tsx
import type { LoaderArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

import { ProjectView } from "~/components/project";

export async function loader({ params }: LoaderArgs) {
  return json(await findProject(params.id));
}

export default function ProjectRoute() {
  const project = useLoaderData<typeof loader>();
  return <ProjectView project={project} />;
}
```

One of the critical pieces here is that the project route renders a reusable component like `<ProjectView>`, because we'll be using it later for our optimistic version. Perhaps it looks like this:

```tsx filename=app/component/project.js
export function ProjectView({ project }) {
  return (
    <div>
      <h2>{project.title}</h2>
      <p>{project.description}</p>
      <ul>
        {project.tasks.map((task) => (
          <li key={task.id}>{task.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

Now we can get to the fun part. Here's what a "new project" route might look like:

```tsx filename=app/routes/projects/new.tsx
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { redirect } from "@remix-run/node"; // or cloudflare/deno
import { Form } from "@remix-run/react";

import { createProject } from "~/utils";

export const action = async ({ request }: ActionArgs) => {
  const body = await request.formData();
  const newProject = Object.fromEntries(body);
  const project = await createProject(newProject);
  return redirect(`/projects/${project.id}`);
};

export default function NewProject() {
  return (
    <>
      <h2>New Project</h2>
      <Form method="post">
        <label>
          Title: <input name="title" type="text" />
        </label>
        <label htmlFor="description">Description:</label>
        <textarea name="description" id="description" />
        <button type="submit">Create Project</button>
      </Form>
    </>
  );
}
```

At this point, typically you'd render a busy spinner on the page while the user waits for the project to be sent to the server, added to the database, and sent back to the browser and then redirected to the project. Remix makes that pretty easy:

```tsx filename=app/routes/projects/new.tsx lines=[3,15,27,29-31]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { redirect } from "@remix-run/node"; // or cloudflare/deno
import { Form, useTransition } from "@remix-run/react";

import { createProject } from "~/utils";

export const action = async ({ request }: ActionArgs) => {
  const body = await request.formData();
  const newProject = Object.fromEntries(body);
  const project = await createProject(newProject);
  return redirect(`/projects/${project.id}`);
};

export default function NewProject() {
  const transition = useTransition();
  return (
    <>
      <h2>New Project</h2>
      <Form method="post">
        <label>
          Title: <input name="title" type="text" />
        </label>
        <label htmlFor="description">Description:</label>
        <textarea name="description" id="description" />
        <button
          type="submit"
          disabled={transition.submission}
        >
          {transition.submission
            ? "Creating project..."
            : "Create Project"}
        </button>
      </Form>
    </>
  );
}
```

Since we know that almost every time this form is submitted it's going to succeed, we can just skip the busy spinners and show the UI as we know it's going to be: the `<ProjectView>`.

```tsx filename=app/routes/projects/new.tsx lines=[5,17-23,31-32]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { redirect } from "@remix-run/node"; // or cloudflare/deno
import { Form, useTransition } from "@remix-run/react";

import { ProjectView } from "~/components/project";
import { createProject } from "~/utils";

export const action = async ({ request }: ActionArgs) => {
  const body = await request.formData();
  const newProject = Object.fromEntries(body);
  const project = await createProject(newProject);
  return redirect(`/projects/${project.id}`);
};

export default function NewProject() {
  const transition = useTransition();
  return transition.submission ? (
    <ProjectView
      project={Object.fromEntries(
        transition.submission.formData
      )}
    />
  ) : (
    <>
      <h2>New Project</h2>
      <Form method="post">
        <label>
          Title: <input name="title" type="text" />
        </label>
        <label htmlFor="description">Description:</label>
        <textarea name="description" id="description" />
        <button type="submit">Create Project</button>
      </Form>
    </>
  );
}
```

When the user clicks "Create Project" the UI immediately changes to the `<ProjectView />` while Remix posts the form to the server. When the server succeeds, the app is redirected to the project route. Because they show the same component (`<ProjectView>`), the only thing the user might notice is the URL changed.

One of the hardest parts about implementing optimistic UI is how to handle failures and notify the user. In Remix this happens automatically. In the unlikely event that our server side action fails, Remix will automatically render the nearest [error boundary][error-boundary] to tell the user something is wrong. The action won't even make it to the `redirect` so the user didn't actually go anywhere. You can even export an error boundary on the new project route to have more contextual information, but there's nothing wrong with letting some other boundary catch it.

## Maintain Form State

If you want to have more control over the UI when an error occurs and put the user right back where they were without losing any state, you can catch your own error and send it down through action data.

```tsx filename=app/routes/projects/new.tsx lines=[5,15-23,27,47]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import {
  Form,
  useActionData,
  useTransition,
} from "@remix-run/react";

import { ProjectView } from "~/components/project";
import { createProject } from "~/utils";

export const action = async ({ request }: ActionArgs) => {
  const body = await request.formData();
  const newProject = Object.fromEntries(body);
  try {
    const project = await createProject(newProject);
    return redirect(`/projects/${project.id}`);
  } catch (error: unknown) {
    console.error(error);
    return json("Sorry, we couldn't create the project", {
      status: 500,
    });
  }
};

export default function NewProject() {
  const error = useActionData<typeof action>();
  const transition = useTransition();

  return transition.submission ? (
    <ProjectView
      project={Object.fromEntries(
        transition.submission.formData
      )}
    />
  ) : (
    <>
      <h2>New Project</h2>
      <Form method="post">
        <label>
          Title: <input name="title" type="text" />
        </label>
        <label htmlFor="description">Description:</label>
        <textarea name="description" id="description" />
        <button type="submit">Create Project</button>
      </Form>
      {error ? <p>{error}</p> : null}
    </>
  );
}
```

Now in the rare case of an error on the server, the UI reverts back to the form, all the state is still there and they have an error message. Nearly every other time, however, the UI responds instantly to the user, even though it's doing work in the background.

## Client-side Validation

For this to work best, you'll want a bit of client-side validation so that form validation issues on the server don't cause the app to flash between optimistic UI and validation messages. Fortunately [HTML usually has everything you need][html-input] built-in. The browser will validate the fields before the form is even submitted to the server to avoid sending bad data and getting flashes of optimistic UI.

```tsx filename=app/routes/projects/new.tsx lines=[43,45]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import {
  Form,
  useActionData,
  useTransition,
} from "@remix-run/react";

import { ProjectView } from "~/components/project";
import { createProject } from "~/utils";

export const action = async ({ request }: ActionArgs) => {
  const body = await request.formData();
  const newProject = Object.fromEntries(body);
  try {
    const project = await createProject(newProject);
    return redirect(`/projects/${project.id}`);
  } catch (e: unknown) {
    console.error(e);
    return json("Sorry, we couldn't create the project", {
      status: 500,
    });
  }
};

export default function NewProject() {
  const error = useActionData<typeof action>();
  const transition = useTransition();

  return transition.submission ? (
    <ProjectView
      project={Object.fromEntries(
        transition.submission.formData
      )}
    />
  ) : (
    <>
      <h2>New Project</h2>
      <Form method="post">
        <label>
          40 Title:{" "}
          <input
            minLength={3}
            name="title"
            required
            type="text"
          />
        </label>
        <label htmlFor="description">Description:</label>
        <textarea name="description" id="description" />
        <button type="submit">Create Project</button>
      </Form>
      {error ? <p>{error}</p> : null}
    </>
  );
}
```

[use-fetcher]: ../hooks/use-fetcher
[fetcher-submit]: ../hooks/use-fetcher#fetchersubmit
[fetcher-submission]: ../hooks/use-fetcher#fetchersubmission
[use-transition]: ../hooks/use-transition
[transition-submission]: ../hooks/use-transition/#transitionsubmission
[use-submit]: ../hooks/use-submit
[error-boundary]: ../route/error-boundary
[form-data]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
[html-input]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/text#additional_attributes
