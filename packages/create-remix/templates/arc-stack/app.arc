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
  email *String

notes
  id **String
  userEmail *String
