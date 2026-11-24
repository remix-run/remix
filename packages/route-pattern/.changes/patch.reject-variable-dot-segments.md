Reject pathname variables that produce a standalone `.` or `..` segment in `createHref()`. The generated href can resolve to a different route when the URL parser removes these segments.
