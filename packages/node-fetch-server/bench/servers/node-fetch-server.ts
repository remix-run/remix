import * as http from 'node:http';
import { createRequestListener } from '@mjackson/node-fetch-server';

let server = http.createServer(
  createRequestListener(() => {
    return new Response('<p>Hello, world!</p>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }),
);

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000 ...');
});
