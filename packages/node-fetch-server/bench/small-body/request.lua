wrk.method = 'POST'
wrk.body = 'Hello from wrk'
wrk.headers['Content-Type'] = 'text/plain'
wrk.headers['X-Bench'] = 'small-body'
