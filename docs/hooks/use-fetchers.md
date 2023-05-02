---
title: useFetchers
toc: false
---

# `useFetchers`

Returns an array of all inflight fetchers.

This is useful for components throughout the app that didn't create the fetchers but want to use their submissions to participate in optimistic UI.

For example, imagine a UI where the sidebar lists projects, and the main view displays a list of checkboxes for the current project. The sidebar could display the number of completed and total tasks for each project.

```
+-----------------+----------------------------+
|                 |                            |
|   Soccer  (8/9) | [x] Do the dishes          |
|                 |                            |
| > Home    (2/4) | [x] Fold laundry           |
|                 |                            |
|                 | [ ] Replace battery in the |
|                 |     smoke alarm            |
|                 |                            |
|                 | [ ] Change lights in kids  |
|                 |     bathroom               |
|                 |                            |
+-----------------+----------------------------┘
```

When the user clicks a checkbox, the submission goes to the action to change the state of the task. Instead of creating a "loading state" we want to create an "optimistic UI" that will **immediately** update the checkbox to appear checked even though the server hasn't processed it yet. In the checkbox component, we can use `fetcher.formData`:

```tsx
function Task({ task }) {
  const toggle = useFetcher();
  const checked = toggle.formData
    ? // use the optimistic version
      Boolean(toggle.formData.get("complete"))
    : // use the normal version
      task.complete;

  const { projectId, id } = task;
  return (
    <toggle.Form
      method="put"
      action={`/project/${projectId}/tasks/${id}`}
    >
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => toggle.submit(e.target.form)}
        />
      </label>
    </toggle.Form>
  );
}
```

This is awesome for the checkbox, but the sidebar will say 2/4 while the checkboxes show 3/4 when the user clicks one of them!

```
+-----------------+----------------------------+
|                 |                            |
|   Soccer  (8/9) | [x] Do the dishes          |
|                 |                            |
| > Home    (2/4) | [x] Fold laundry           |
|                 |                            |
|          CLICK!-->[x] Replace battery in the |
|                 |     smoke alarm            |
|                 |                            |
|                 | [ ] Change lights in kids  |
|                 |     bathroom               |
|                 |                            |
+-----------------+----------------------------┘
```

Because Remix will automatically reload the routes, the sidebar will quickly update and be correct. But for a moment, it's going to feel a little funny.

This is where `useFetchers` comes in. Up in the sidebar, we can access all the inflight fetcher states from the checkboxes - even though it's not the component that created them.

The strategy has three steps:

1. Find the submissions for tasks in a specific project
2. Use the `fetcher.formData` to immediately update the count
3. Use the normal task's state if it's not inflight

Here's some sample code:

```tsx
function ProjectTaskCount({ project }) {
  const fetchers = useFetchers();
  let completedTasks = 0;

  // 1) Find my task's submissions
  const myFetchers = new Map();
  for (const f of fetchers) {
    if (
      f.formAction &&
      f.formAction.startsWith(
        `/projects/${project.id}/task`
      )
    ) {
      const taskId = f.formData.get("id");
      myFetchers.set(
        parseInt(taskId),
        f.formData.get("complete") === "on"
      );
    }
  }

  for (const task of project.tasks) {
    // 2) use the optimistic version
    if (myFetchers.has(task.id)) {
      if (myFetchers.get(task.id)) {
        completedTasks++;
      }
    }
    // 3) use the normal version
    else if (task.complete) {
      completedTasks++;
    }
  }

  return (
    <small>
      {completedTasks}/{project.tasks.length}
    </small>
  );
}
```
