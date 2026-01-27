BREAKING CHANGE: simplify protocol to only accept `http`, `https`, and `http(s)`

Previously, we allowed arbitrary `PartPattern` for protocol, but in reality the request/response server only directly receives `http` and `https` protocols (`ws` and `wss` are upgraded from `http` and `https` respectively).

That means params or arbitrary optionals are no longer allowed within the protocol and will result in a `ParseError`.