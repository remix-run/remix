Improve request throughput by avoiding an extra URL object allocation when creating Fetch API requests and by skipping request/client construction for handlers that declare no parameters.
