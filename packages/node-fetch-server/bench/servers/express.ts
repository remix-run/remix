import express from 'express';

let app = express();

app.get('/', (_req, res) => {
  res.type('text/html');
  res.send('<p>Hello, world!</p>');
});

app.listen(3000, () => {
  console.log('Listening on http://localhost:3000 ...');
});
