@app
remix-aws-stack

@http
/*
  method any
  src server

@static

@aws
region us-east-1

@tables
people
  pk *String

notes
  pk **String
  sk *String

arc-sessions
  _idx *String
  _ttl TTL
