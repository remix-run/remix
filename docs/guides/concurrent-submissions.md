---
title: Concurrent Submissions
---

When you use a `<Form submissionKey>` or `useSubmit(submissionKey)` you put your Remix app into "concurrent submissions" mode.

<docs-info>This guide assumes you are familiar with data mutations and actions in Remix. If you're not, go read the <a href="../../mutations/">Data Mutations Guide</a>.</docs-info>

As you probalby know, Remix uses form navigation as the model for data mutations. You might be thinking that using form navigation in a highly interactive, dynamic, modern web app isn't going to cut it. Even a simple "todo app" seems like it needs something more than filling out a form and submitting it to the server--what about when the user clicks a bunch of checkboxes really fast?!

If that's what you're thinking, you're not alone!

We hope this guide will help you catch the vision about how to build highly dynamic apps--with optimistic UI and pending mutation indicators and animations and bells and whistles and everything you think about when you think about a solid modern web app--with plain ol', boring HTML forms and HTTP.

If you model your mutations with these boring web fundamentals, Remix can give you everything you need to make it fancy, no sweat. Stuff like:

- Automatically keeping your UI in sync with your server's freshest data
- Aborting stale or interrupted data requests for click-happy users
- Providing simple hooks for pending/optimistic UI to make your UX feel super solid
- Avoiding unexpected UI states when the network connection is poor
- Avoiding Spinnageddon and content layout shifts
- Allowing the fundamental features to work without any clientside JavaScript (that's not the point, just a happy side-effect)

## Consider a Task Management App

Imagine (a much better looking) task management app:

```
URL: /projects/home
┌────────────────┬──────────────────────────────────────┐
│ PROJECTS       │   Project: Home                      │
├────────────────┤                                      │
│ Soccer    2/10 │   Tasks:                             │
│----------------|                                      │
│ Home      3/5  >   [ ] Change battery in              │
│----------------|       smoke alarm downstairs         │
│ Work      1/50 │                                      │
│----------------|   [ ] Go grocery shopping            │
│                │                                      │
│                │   [X] Make meal plan list for        │
│                │        the week                      │
│                │                                      │
│                │   [X] Pressure wash garbage can      │
│                │                                      │
│                │   [X] Get Utah Driver License        │
│                │        (you've lived here a year!)   │
│                │                                      │
└────────────────┴──────────────────────────────────────┘
```

The screen is composed of the following route files:

```
├── root.js
└── routes
    ├── projects.js
    └── projects
        └── $projectId.js
```

Which results in a component hierarchy that looks like this when we're at `/projects/home`.

```tsx
<Root>
  <Projects>
    <Project />
  </Projects>
</Root>
```

Each route loads the following data

- `root.js` loads nothing
- `projects.js` loads all the projects from database
- `$projectId.js` loads the data for the project

And here's what the routes might look like as a basic starting point:

```tsx
// routes/projects.js
export function loader() {
  return fakeDb.projects.findAll();
}

export default function Projects() {
  let projects = useLoaderData();

  return (
    <div>
      <nav>
        <h1>PROJECTS</h1>
        {projects.map((project) => (
          <NavLink to={project.id}>
            {project.name}{" "}
            <TaskCount tasks={projects.tasks} />
          </NavLink>
        ))}
      </nav>

      <AddProjectForm />
    </div>
  );
}

function TaskCount({ tasks }) {
  let complete = 0;
  for (let task of tasks) {
    if (task.complete) {
      complete++;
    }
  }
  return (
    <span>
      {complete}/{tasks.length}
    </span>
  );
}
```

```tsx
// routes/projects/$projectId.js
import fakeDb from "fakeDb";

export function loader({ params }) {
  return fakeDb.projects.find({
    where: { id: params.projectId },
  });
}

export default function Project() {
  let project = useLoaderData();

  return (
    <div>
      <h2>Project: {project.name}</h2>
      <h3>Tasks</h3>
      <ul>
        {project.tasks.map((task) => (
          <TaskListItem task={task} />
        ))}
      </ul>
    </div>
  );
}

function TaskListItem({ task }) {
  return (
    <li>
      <input checked={task.complete} type="checkbox" />{" "}
      {task.body}
    </li>
  );
}
```

Alright, with all of that background, there are a couple interactions we're going to talk about:

1. Marking Tasks Complete
2. Clicking a project link

## Marking Tasks Complete w/o Remix

If you've been building SPAs with React for a while, you're natural instinct for this interaction is probably to add the following stuff to `$projectId.js`:

1. Put an `onChange` handler on the checkbox
2. In that handler change some state
3. Set up a pile of `useState` and `useEffect` hooks to
   - Manage the fetch result
   - Handle errors
   - Add pending UI
4. In a `useEffect` make a request to an API route to change the data
   1. (Maybe have to wait for somebody else to implement the API route)

If you look at the UI again, you'll then realize you put the state in the wrong place to be able to update the task counts in the navigation sidebar and now need to move the state up to `projects.js`. But that's gonna be weird because now it has to fetch EVERYTHING about every project, instead of just the data that it displays ...

You'll also want the interaction to feel instant so you'll just assume all the mutations work and set the checkbox state based on the interactions instead of the data from the server.

What you probably don't worry much about is:

- How to alert the user of errors if the requests fail
- What happens when the user clicks the checkboxes really fast
- What hapepns when the user navigates away while a mutation is pending

When you get to production you'll realize it's really easy to get the UI and the actual server state out of sync because there are race conditions for when the requests make it to the server without good abstractions or very careful code.

Apps that create confidence in users should:

- ensure UI and server state stay in sync
- gracefully handle interruption (or prevent it)
- handle errors
- provide pending UI and/or optimistic UI that doesn't ignore errors

So now you have to start thinking about `AbortControllers`, `useEffect` cleanup functions, and making sure you get the freshest data from the right request to present to the user.

Whew ... that's a lot of work and a high bar. And that's just for this UI, other mutation interactions have even more things to consider.

Let's take a quick stab at this:

<docs-error>This is not how you would do this in Remix, we're just contrasting</docs-error>

```tsx bad lines=2-4,6-38,43-46,50
function TaskListItem({ task }) {
  let [isLoading, setIsLoading] = useState(false);
  let [error, setError] = useState(null);
  let [isChecked, setIsChecked] = useState(task.complete);

  useEffect(() => {
    let controller = new AbortController();
    setIsLoading(true);
    async function load() {
      try {
        let res = await fetch(`/api/tasks/${task.id}`, {
          signal: controller.signal,
          method: "POST",
          body: JSON.stringify({
            complete: String(isChecked),
            id: task.id,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });
        let json = await res.json();
        if (json.error) {
          setError(json.error);
        }
        setIsLoading(false);
      } catch (error) {
        setError(error.message);
        setIsLoading(false);
      }
    }

    load();

    return () => {
      controller.abort();
    };
  }, [isChecked]);

  return (
    <li>
      <input
        onChange={(event) => {
          setIsChecked(event.target.checked);
        }}
        checked={isChecked}
        type="checkbox"
      />{" "}
      {task.body}
      {error && <p>{error}</p>}
    </li>
  );
}
```

Hot dang. This doesn't even show the API route we need and it only gets us to the point where we realize the state is in the wrong place because we have no way to update the `<TaskCount>` components in the `projects.js` parent route.

Fortunately, Remix handles nearly all of this for you.

## Marking Tasks Complete

If these checkboxes were `<button>` instead of `<input>`, we could make them full-blown forms like this:

```tsx [4,5,11]
function TaskListItem({ task }) {
  return (
    <li>
      <Form method="post">
        <input type="hidden" name="id" value={task.id} />
        <input
          checked={task.complete}
          type="checkbox"
          name="complete"
        /> {task.body}
      </Form>
    </li>
  );
}
```

Buttons will submit the form when clicked, but checkboxes don't. It could work really well if we styled the buttons to look like checkboxes.

We're going to use checkboxes though, so we'll bring in the imperative way to submit form data: `useSubmit`.

```tsx [1,4]
import { useSubmit } from "remix";

function TaskListItem({ task }) {
  let submit = useSubmit();

  return (
    <li>
      <input
        checked={task.complete}
        type="checkbox"
        onChange={(event) => {
          submit(
            {
              complete: String(event.target.checked),
              id: task.id,
            },
            { method: "post" }
          );
        }}
      />{" "}
      {task.body}
    </li>
  );
}
```
