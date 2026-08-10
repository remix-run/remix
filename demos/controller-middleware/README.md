# Controller middleware demo

This demo makes mount, controller, and action middleware execution visible across nested route maps
and controller boundaries. Each response includes the request's execution trace as JSON.

Controller middleware still applies only to direct actions in that controller. Mount middleware
applies across every controller and nested mount registered by the route installer, so it can define
one boundary for a complete route group.

The project URL contract remains nested:

```ts
projects: route('projects', {
  index: get('/'),
  activity: route(':projectId/activity', {
    index: get('/'),
  }),
})
```

The relative project routes are mounted once with shared middleware, then each route map is mapped
to its own controller:

```ts
router.mount('/projects', { middleware: [traceMount('projects')] }, (projects) => {
  projects.map(projectRoutes, projectsController)
  projects.map(projectRoutes.activity, activityController)
})
```

## Run

```sh
pnpm -C demos/controller-middleware dev
```

Then request each route:

```sh
curl http://localhost:44100/
curl http://localhost:44100/projects
curl http://localhost:44100/projects/alpha/activity
```

The project activity route responds with a trace like:

```json
{
  "route": "projects.activity.index",
  "params": { "projectId": "alpha" },
  "trace": [
    "router middleware",
    "projects mount middleware",
    "activity controller middleware",
    "projects.activity.index action"
  ]
}
```

The projects controller middleware is absent from the activity response because controller
middleware does not inherit. The projects mount middleware is present because the activity
controller was registered inside that mounted route group.

Run the focused regression tests with:

```sh
pnpm -C demos/controller-middleware test
```
