Keep session flash messages available to server-rendered frames

Same-origin internal frame requests, including redirects and streamed frames, now share the outer request's session. Previously, with server-side session storage, an earlier frame response could save the session and clear its flash messages before a sibling frame, a redirected frame, or a streamed frame read them.
