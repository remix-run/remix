import { get, route } from 'remix/routes'

const projectRouteDefinitions = {
  index: get('/'),
  activity: route(':projectId/activity', {
    index: get('/'),
  }),
}

export const projectRoutes = route(projectRouteDefinitions)

export const routes = route({
  home: get('/'),
  projects: route('projects', projectRouteDefinitions),
})
