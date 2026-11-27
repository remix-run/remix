Add `inheritSession(request, context)` to share the current session with internal requests

Requests dispatched back through the router for the same response, such as server-rendered frames, previously loaded the session from storage on their own. With server-side storage, the first of them to save the session cleared its incoming flash messages before the others could read them. An internal request that inherits the session reuses it instead, so flash messages stay available to the whole response and are cleared for the next independent request.
