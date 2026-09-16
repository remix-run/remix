import { removeRemixIndex, syncRemixIndex } from './utils/remix-index.ts'
import { removeRemixReadmes, syncRemixReadmes } from './utils/remix-readmes.ts'
import { removeRemixSchema, syncRemixSchema } from './utils/remix-schema.ts'

const clean = process.argv.includes('--clean')

if (clean) {
  await removeRemixIndex()
  await removeRemixReadmes()
  await removeRemixSchema()
  console.log('Removed generated Remix package index.')
  console.log('Removed generated Remix README mirrors.')
  console.log('Removed generated Remix schema.')
} else {
  let copies = await syncRemixReadmes()
  await syncRemixIndex()
  await syncRemixSchema()
  console.log('Synced Remix package index.')
  console.log(`Synced ${copies.length} generated Remix README mirrors.`)
  console.log('Synced Remix schema.')
}
