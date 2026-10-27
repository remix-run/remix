import * as process from 'node:process'
import { runRemix } from 'remix/cli'

// Force test mode here rather than with an inline `NODE_ENV=test` shell variable in
// package.json, which cmd.exe on Windows cannot parse. Assigning it (instead of
// defaulting) keeps an inherited NODE_ENV, such as `production`, from overriding it.
process.env.NODE_ENV = 'test'

process.exit(await runRemix(['test', ...process.argv.slice(2)]))
