import { get, post, route } from 'remix/routes'

export const routes = route({
  home: get('/'),
  about: get('/about'),
  greet: get('/greet'),
  submitGreet: post('/greet'),
})
