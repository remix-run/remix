import { removeRemixReadmes, syncRemixReadmes } from './utils/remix-readmes.ts'

const clean = process.argv.includes('--clean')

if (clean) {
  await removeRemixReadmes()
  console.log('Removed generated remix README mirrors.')
} else {
  let copies = await syncRemixReadmes()
  console.log(`Synced ${copies.length} generated remix README mirrors.`)
}
