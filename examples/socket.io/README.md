# Express + Socket.io

Socket.io is the simples way to work with WebSockets in Node.js

This examples shows how to setup socket.io inside a Express server and together with a Remix app and how to connect from the browser.

> Note: The code here needs the Express adapter and because of that it needs Node.js. This is only deployable to platforms supporting a persistent running process (unlike Serverless platforms).

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/socket.io)

## Example

This examples uses the Express adapter to setup the HTTP server.

Then it attach socket.io to it and listen a few basic events.

Client-side, it imports `io` from socket.io-client and use it to connect to the WebSocket server on the root component.

It stores the socket instance in a React context and make it available for the whole app.

In the `routes/index` file it access it to listen for more events and renders a button which sends a message to the server on each click.

## Related Links

- [Express adapter](https://remix.run/other-api/adapter#createrequesthandler)
- [socket.io](https://socket.io/)
- [socket.io-client](https://www.npmjs.com/package/socket.io-client)
