import * as http from 'node:http';

let server = http.createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end('<p>Hello, world!</p>');
});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000 ...');
});
