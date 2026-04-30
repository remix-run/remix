wrk.method = 'POST'
wrk.body = string.rep('x', 1000 * 1000)
wrk.headers['Content-Type'] = 'text/plain'
wrk.headers['X-Bench'] = 'large-body'
