import { runRemix } from 'remix/cli'

process.exitCode = await runRemix(process.argv.slice(2))
