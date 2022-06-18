# Example app with [feathersjs](https://feathersjs.com/)

Feathersjs is a framework for real-time node applications and this example will show you how to connect to the feathers backend from remix and use it to view events, borrowing heavily from the socket.io example and adapting it for feathersjs. 

To use run `npm run watch` to build and watch for remix changes and `npm run start` to start our server

## Preview

Open this example on [CodeSandbox](https://codesandbox.io/s/fervent-kate-co1cgn):

<!-- TODO: update this link to the path for your example: -->

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/fervent-kate-co1cgn)

## Example
We use @feathersjs/cli to autogenerate a basic feathers project which will act as our server and serve our remix frontend
On the server side, we simply use the remix express adapter to create our request handler, and have our server host our public folder
For remix, there's a couple fo things we do: 
1. we use a `feathers.server.ts` which will set up server to server connection (Remix server to feathers)
2. we set up a normal socket.io connection on the client with useEffect and send events to feathers

The reason we don't use a feathers connection on the client, is that emits just don't like the feathers connection and even though feathers is supposed to expose a reference to the socket connection it uses, it doesn't. And either way, all the feathers connection does is set up a socket.io connection to our server but it also can handle authentication and such. 

For number one, I've set up a basic message service that will store messages. 
On the client, using remix form and an Action function, you can submit a message and it will get created on our server. 

Now, the real cool part is if you open up two clients, messages will get synced between multiple clients without reloads. 
For this to work, we need to tell feathers to publish an event anytime a message is created. This is done in server/channels.ts.
As well, we use our client socket to listen for the message created event and call `fetcher.load('/?index')` function


For number two, we simply do the same thing done in the socket.io example and send a ping event.

## Related Links

* [feathersjs](https://feathersjs.com)
* [socket.io example](https://github.com/remix-run/remix/tree/main/examples/socket.io)
