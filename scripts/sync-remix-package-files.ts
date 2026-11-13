import { removeRemixSchema, syncRemixSchema } from './utils/remix-schema.ts'

const clean = process.argv.includes('--clean')

if (clean) {
  await removeRemixSchema()
  console.log('Removed generated Remix schema.')
} else {
  await syncRemixSchema()
  console.log('Synced Remix schema.')
}
