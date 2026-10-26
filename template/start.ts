// Opt into production mode here rather than with an inline `NODE_ENV=production`
// shell variable in package.json. npm runs scripts through cmd.exe on Windows,
// which cannot parse a leading `NAME=value` assignment. Setting it before the
// server is imported keeps the `start` script portable while still letting the
// asset pipeline see the right mode.
process.env.NODE_ENV = 'production'

await import('./server.ts')
