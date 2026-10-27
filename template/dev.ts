// Force development mode here rather than with an inline `NODE_ENV=development`
// shell variable in package.json, which cmd.exe on Windows cannot parse. Assigning
// it (instead of defaulting) keeps an inherited NODE_ENV, such as `production` set
// by CI or the system, from overriding the mode this script exists to run.
process.env.NODE_ENV = 'development'

await import('./server.ts')
