---
"@remix-run/react": patch
---

Fixed a problem with live reload and firefox infinitely reloading the page

The problem is:

1. Firefox is calling `ws.onclose` immediately upon connecting (?!)
2. Then we’re trying to reconnect, and upon reconnection, we reload the page.
3. Firefox then calls `ws.onclose` again after reconnecting and the loop starts over

This fix is to check `event.code === 1006` before actually trying to reconnect and the reload the page. 1006 means the connection was closed abnormally (https://www.rfc-editor.org/rfc/rfc6455#section-7.4.1). In our case, that means the server was shut down in local dev and then the socket can reconnect again when the server is back up.

It’s unclear to me why Firefox is calling `onclose` immediately upon connecting to the web socket, but it does.
